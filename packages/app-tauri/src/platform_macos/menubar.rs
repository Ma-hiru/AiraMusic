//! macOS 菜单栏胶囊：托盘图标与逐字歌词合并到同一个 NSStatusItem。
//!
//! 这是 `packages/native/src/darwin.rs` 的移植：去掉 napi 层，事件回调换成
//! `Fn(MenuLyricEvent)`，主线程转投改用 `AppHandle::run_on_main_thread`
//! （等价于原来的 `Queue::main()`，少一个 dispatch 依赖）。
//!
//! 单个自定义 `NSView` 负责全部绘制（胶囊底、图标、歌词），
//! 逐字高亮通过「未唱/已唱」两次文本绘制 + 进度裁剪实现，
//! 跑马灯则让已唱位置保持在视口内，避免与音频时钟各跑一套。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{define_class, msg_send, AnyThread, ClassType, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSAttributedStringNSStringDrawing, NSBezierPath, NSColor, NSCompositingOperation, NSEvent,
    NSFont, NSFontAttributeName, NSForegroundColorAttributeName, NSGraphicsContext, NSImage,
    NSScreen, NSStatusBar, NSStatusItem, NSView,
};
use objc2_foundation::{
    NSMutableAttributedString, NSObjectProtocol, NSPoint, NSRange, NSRect, NSSize, NSString,
};
use tauri::AppHandle;

use crate::menu_lyric::MenuLyricWord;

/// 状态栏项高度兜底值（pt），正常取 `NSStatusBar::thickness`
const ITEM_HEIGHT: f64 = 22.0;
/// 胶囊相对状态栏项的留白
const CAPSULE_INSET_X: f64 = 1.0;
const CAPSULE_INSET_Y: f64 = 2.0;
/// 胶囊底色透明度（跟随 labelColor，亮暗色自动反转）
const CAPSULE_ALPHA: f64 = 0.1;
/// 胶囊内边距
const CONTENT_PAD_LEFT: f64 = 6.0;
const CONTENT_PAD_RIGHT: f64 = 8.0;
const ICON_SIZE: f64 = 14.0;
const ICON_GAP: f64 = 5.0;
/// 歌词视口宽度默认值（固定值，不随行长度伸缩，避免菜单栏项左右抖动）
const LYRIC_WIDTH: f64 = 150.0;
/// 歌词视口宽度上下限（pt）
const MIN_LYRIC_WIDTH: f64 = 60.0;
const MAX_LYRIC_WIDTH: f64 = 400.0;
/// 帧间隔（ms）
const TICK_MS: u64 = 16;
/// 跑马灯跟随的时间常数（s），越小越快
const FOLLOW_TAU: f64 = 0.12;
/// 已唱字在视口中的目标位置占比：唱到这一带才开始滚动，右侧只留一个字的下文
const FOLLOW_RATIO: f64 = 0.8;
/// 右侧被截断时的提示符
const ELLIPSIS: &str = "…";
/// 省略号与截断文本之间的间隙
const ELLIPSIS_GAP: f64 = 2.0;
/// 进度对齐阈值（ms）：小于此漂移视为播放器粒度抖动，不重设锚点
const RESYNC_TOLERANCE_MS: f64 = 120.0;

/// 菜单栏歌词交互事件（AppKit 屏幕坐标，左下原点）。
#[derive(Clone, Debug)]
pub struct MenuLyricEvent {
    /// "click" | "right-click" | "double-click"
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// CGDirectDisplayID，与 Electron `display.id` 同源；取不到时为 0
    pub display_id: u32,
}

type EventHandler = Arc<dyn Fn(MenuLyricEvent) + Send + Sync>;

define_class!(
    #[unsafe(super = NSView)]
    #[thread_kind = MainThreadOnly]
    #[name = "AiraMenuBarCapsuleView"]
    struct CapsuleView;

    unsafe impl NSObjectProtocol for CapsuleView {}

    impl CapsuleView {
        #[unsafe(method(acceptsFirstMouse:))]
        fn accepts_first_mouse(&self, _event: Option<&NSEvent>) -> bool {
            true
        }

        #[unsafe(method(mouseDown:))]
        fn mouse_down(&self, event: Option<&NSEvent>) {
            let Some(event) = event else { return };
            let kind = if event.clickCount() >= 2 {
                "double-click"
            } else {
                "click"
            };
            emit_menu_lyric_event(self.as_super(), kind);
        }

        #[unsafe(method(rightMouseDown:))]
        fn right_mouse_down(&self, _event: Option<&NSEvent>) {
            emit_menu_lyric_event(self.as_super(), "right-click");
        }

        #[unsafe(method(drawRect:))]
        fn draw_rect(&self, _dirty_rect: NSRect) {
            draw_capsule(self.as_super());
        }

        #[unsafe(method(viewDidChangeEffectiveAppearance))]
        fn view_did_change_effective_appearance(&self) {
            // 亮暗切换后动态色要重新解析，必须重绘一次
            let _: () = unsafe { msg_send![super(self), viewDidChangeEffectiveAppearance] };
            self.setNeedsDisplay(true);
        }
    }
);

impl CapsuleView {
    fn new(mtm: MainThreadMarker, frame: NSRect) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(());
        unsafe { msg_send![super(this), initWithFrame: frame] }
    }

    fn as_view(&self) -> &NSView {
        self.as_super()
    }
}

struct MenuBarUi {
    status_item: Retained<NSStatusItem>,
    view: Retained<CapsuleView>,
}

unsafe impl Send for MenuBarUi {}

struct MenuBarState {
    ui: Option<MenuBarUi>,
    icon: Option<Retained<NSImage>>,
    /// 歌词纯文本，由 words 拼接或空闲标题
    text: String,
    /// 逐字时间轴（相对行首），空表示静态文本
    words: Vec<MenuLyricWord>,
    word_ends: Vec<f64>,
    text_width: f64,
    text_height: f64,
    lyric_width: f64,
    item_height: f64,
    /// 是否在菜单栏显示（关闭胶囊时置 false）
    visible: bool,
    /// 跑马灯偏移，恒 <= 0
    offset: f64,
    /// 进度基准 + 锚点时刻，避免与音频时钟各跑一套
    elapsed_ms: f64,
    anchor: Instant,
    playing: bool,
    animating: bool,
    last_tick: Instant,
    normal: Option<Retained<NSMutableAttributedString>>,
    highlighted: Option<Retained<NSMutableAttributedString>>,
    ellipsis: Option<Retained<NSMutableAttributedString>>,
    ellipsis_width: f64,
    /// 视图是否已挂进菜单栏窗口（`/__diag` 自检：证明状态栏项真的入栏了）
    attached: bool,
    /// 宿主窗口类名（正常应为 `NSStatusBarWindow`）
    host_class: String,
    /// 宿主窗口在 AppKit 坐标里的顶边（菜单栏高度处）
    host_top: f64,
    on_event: Option<EventHandler>,
}

// 状态只在主线程读写；跨线程调用一律经 run_on_main_thread 转投
unsafe impl Send for MenuBarState {}

impl MenuBarState {
    fn new() -> Self {
        let now = Instant::now();
        Self {
            ui: None,
            icon: None,
            text: String::new(),
            words: Vec::new(),
            word_ends: Vec::new(),
            text_width: 0.0,
            text_height: 0.0,
            lyric_width: LYRIC_WIDTH,
            item_height: ITEM_HEIGHT,
            visible: true,
            offset: 0.0,
            elapsed_ms: 0.0,
            anchor: now,
            playing: false,
            animating: false,
            last_tick: now,
            normal: None,
            highlighted: None,
            ellipsis: None,
            ellipsis_width: 0.0,
            attached: false,
            host_class: String::new(),
            host_top: 0.0,
            on_event: None,
        }
    }

    /// 歌词绘制起点（图标右侧）
    fn text_origin_x(&self) -> f64 {
        CAPSULE_INSET_X + CONTENT_PAD_LEFT + ICON_SIZE + ICON_GAP
    }

    fn item_width(&self) -> f64 {
        CAPSULE_INSET_X * 2.0
            + CONTENT_PAD_LEFT
            + ICON_SIZE
            + ICON_GAP
            + self.lyric_width
            + CONTENT_PAD_RIGHT
    }

    fn min_offset(&self) -> f64 {
        (self.lyric_width - self.text_width).min(0.0)
    }

    fn current_elapsed(&self) -> f64 {
        if self.playing {
            self.elapsed_ms + self.anchor.elapsed().as_secs_f64() * 1000.0
        } else {
            self.elapsed_ms
        }
    }

    fn last_word_end(&self) -> f64 {
        self.words.last().map(|word| word.end_ms).unwrap_or(0.0)
    }

    /// 已唱部分的横向宽度（文字坐标系）
    fn sung_width(&self) -> f64 {
        if self.words.is_empty() {
            return 0.0;
        }
        let elapsed = self.current_elapsed();
        let mut width = 0.0;
        for (index, word) in self.words.iter().enumerate() {
            if elapsed <= word.start_ms {
                break;
            }
            let end_x = self.word_ends.get(index).copied().unwrap_or(width);
            if elapsed >= word.end_ms {
                width = end_x;
                continue;
            }
            let start_x = if index == 0 {
                0.0
            } else {
                self.word_ends.get(index - 1).copied().unwrap_or(0.0)
            };
            let span = (word.end_ms - word.start_ms).max(1.0);
            let ratio = ((elapsed - word.start_ms) / span).clamp(0.0, 1.0);
            width = start_x + (end_x - start_x) * ratio;
            break;
        }
        width
    }

    /// 省略号占用的横向槽位（含与正文的间隙）
    fn ellipsis_gutter(&self) -> f64 {
        if self.ellipsis_width > 0.0 {
            self.ellipsis_width + ELLIPSIS_GAP
        } else {
            0.0
        }
    }

    /// 右侧是否还有被截掉的歌词
    fn has_hidden_tail(&self) -> bool {
        self.offset + self.text_width > self.lyric_width + 0.5
    }

    /// 让已唱位置停在视口靠右处；唱完后滑到行尾，静态文本不滚动
    fn follow_offset(&self) -> f64 {
        if self.text_width <= self.lyric_width || self.words.is_empty() {
            return 0.0;
        }
        if self.current_elapsed() >= self.last_word_end() {
            return self.min_offset();
        }
        let target = self.lyric_width * FOLLOW_RATIO - self.sung_width();
        target.clamp(self.min_offset(), 0.0)
    }

    fn should_animate(&self) -> bool {
        if !self.visible {
            return false;
        }
        let karaoke =
            self.playing && !self.words.is_empty() && self.current_elapsed() < self.last_word_end();
        karaoke || (self.offset - self.follow_offset()).abs() > 0.25
    }
}

fn state() -> &'static Mutex<MenuBarState> {
    static STATE: OnceLock<Mutex<MenuBarState>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(MenuBarState::new()))
}

/// 跑马灯线程是否在跑：单独一个标志，避免与 state 锁互相等待
static TICKER_RUNNING: AtomicBool = AtomicBool::new(false);

/// AppHandle 只在 init 时写入，之后供跨线程转投使用。
fn app() -> &'static OnceLock<AppHandle> {
    static APP: OnceLock<AppHandle> = OnceLock::new();
    &APP
}

/// 在主线程执行：已经主线程就直接跑，否则投递过去（异步，与 `Queue::main().exec_async` 同义）。
fn on_main<F: FnOnce() + Send + 'static>(f: F) {
    if MainThreadMarker::new().is_some() {
        f();
        return;
    }
    match app().get() {
        Some(app) => {
            if let Err(error) = app.run_on_main_thread(f) {
                crate::host_err!("[menubar] 主线程转投失败: {error}");
            }
        }
        None => crate::host_err!("[menubar] 尚未初始化，丢弃这次更新"),
    }
}

/// 在主线程执行并等待结果（跑马灯 tick 用，等价 `Queue::main().exec_sync`）。
fn on_main_sync(f: impl FnOnce() -> bool + Send + 'static) -> bool {
    if MainThreadMarker::new().is_some() {
        return f();
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let Some(app) = app().get() else {
        return false;
    };
    if app
        .run_on_main_thread(move || {
            let _ = tx.send(f());
        })
        .is_err()
    {
        return false;
    }
    // 主线程被模态对话框之类占住时跳过这一帧，但不结束动画
    match rx.recv_timeout(Duration::from_millis(500)) {
        Ok(keep_going) => keep_going,
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => true,
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => false,
    }
}

/// 初始化菜单栏胶囊（托盘图标 + 歌词合并项），重复调用只更新图标与提示。
pub fn init(app_handle: &AppHandle, icon_path: &str, tooltip: &str) {
    let _ = app().set(app_handle.clone());
    let icon_path = icon_path.to_string();
    let tooltip = tooltip.to_string();
    on_main(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            crate::host_err!("[menubar] 初始化不在主线程，跳过");
            return;
        };
        let icon = if icon_path.is_empty() {
            None
        } else {
            let image =
                NSImage::initWithContentsOfFile(NSImage::alloc(), &NSString::from_str(&icon_path));
            image.inspect(|image| {
                // 菜单栏图标按模板图处理：只取 alpha，颜色交给绘制侧
                image.setTemplate(true);
            })
        };

        let Ok(mut guard) = state().lock() else {
            crate::host_err!("[menubar] 状态锁已损坏");
            return;
        };
        guard.icon = icon;

        if guard.ui.is_none() {
            // 先建项：菜单栏图标不等第一条歌词就该可见
            match create_ui(mtm) {
                Ok(ui) => {
                    guard.item_height = ui.view.as_view().frame().size.height;
                    ui.view
                        .as_view()
                        .setToolTip(Some(&NSString::from_str(&tooltip)));
                    guard.ui = Some(ui);
                }
                Err(error) => {
                    crate::host_err!("[menubar] 建项失败: {error}");
                    return;
                }
            }
        } else if let Some(ui) = guard.ui.as_ref() {
            ui.view
                .as_view()
                .setToolTip(Some(&NSString::from_str(&tooltip)));
        }

        let width = guard.item_width();
        let height = guard.item_height;
        let (status_item, view) = match guard.ui.as_ref() {
            Some(ui) => (ui.status_item.clone(), ui.view.clone()),
            None => return,
        };
        drop(guard);

        apply_metrics(&status_item, view.as_view(), width, height);
    });
}

/// 更新菜单栏胶囊的悬浮提示。
pub fn set_tool_tip(tooltip: &str) {
    let tooltip = tooltip.to_string();
    on_main(move || {
        let Ok(guard) = state().lock() else { return };
        if let Some(ui) = guard.ui.as_ref() {
            ui.view
                .as_view()
                .setToolTip(Some(&NSString::from_str(&tooltip)));
        }
    });
}

/// 更新菜单栏歌词行；`words` 为空表示静态文本（无逐字高亮）。
pub fn set_lyric(text: &str, words: &[MenuLyricWord]) {
    let text = text.to_string();
    let words = words.to_vec();
    on_main(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        apply_on_main(mtm, text, words);
    });
}

/// 设置歌词视口宽度；胶囊总宽 = 固定留白 + 该值
pub fn set_width(width: f64) {
    on_main(move || {
        let Ok(mut guard) = state().lock() else {
            return;
        };
        let next = sanitize_width(width);
        if (guard.lyric_width - next).abs() < 0.5 {
            return;
        }
        guard.lyric_width = next;

        let (status_item, view) = match guard.ui.as_ref() {
            Some(ui) => (ui.status_item.clone(), ui.view.clone()),
            None => return,
        };
        let item_width = guard.item_width();
        let height = guard.item_height;
        drop(guard);

        apply_metrics(&status_item, view.as_view(), item_width, height);
        ensure_ticker();
    });
}

/// 显示/隐藏整个胶囊；关闭后菜单栏不再有此应用项
pub fn set_visible(visible: bool) {
    on_main(move || {
        let Ok(mut guard) = state().lock() else {
            return;
        };
        if guard.visible == visible {
            return;
        }
        guard.visible = visible;

        let view = match guard.ui.as_ref() {
            Some(ui) => ui.status_item.clone(),
            None => return,
        };
        let ns_view = guard
            .ui
            .as_ref()
            .map(|ui| ui.view.clone())
            .expect("ui 已判空");
        drop(guard);

        #[allow(deprecated)]
        view.setVisible(visible);
        if visible {
            ns_view.as_view().setNeedsDisplay(true);
            ensure_ticker();
        }
    });
}

/// 注册点击事件回调（原 napi 的 `on_event`，只注册一次）。
pub fn set_event_handler(handler: impl Fn(MenuLyricEvent) + Send + Sync + 'static) {
    if let Ok(mut guard) = state().lock() {
        guard.on_event = Some(Arc::new(handler));
    }
}

/// 同步播放进度（相对行首，ms）；原生以该基准自行推进逐字动画。
pub fn set_progress(elapsed: f64, playing: bool) {
    on_main(move || {
        let Ok(mut guard) = state().lock() else {
            return;
        };
        let view = match guard.ui.as_ref() {
            Some(ui) => ui.view.clone(),
            None => return,
        };

        // 稳态播放时不重设锚点，避免 player 粒度抖动让高亮来回跳；
        // 暂停/恢复/拖动进度（漂移超阈值）才重新对齐
        let drift = (elapsed - guard.current_elapsed()).abs();
        if !playing || !guard.playing || drift > RESYNC_TOLERANCE_MS {
            guard.elapsed_ms = elapsed.max(0.0);
            guard.anchor = Instant::now();
        }
        guard.playing = playing;
        drop(guard);

        view.as_view().setNeedsDisplay(true);
        note_attachment(view.as_view());
        ensure_ticker();
    });
}

/// 胶囊现状（`/__diag` 自检用，不触碰 AppKit，可在任意线程读）。
#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct Snapshot {
    pub created: bool,
    /// 视图已挂进菜单栏窗口
    pub attached: bool,
    /// 宿主窗口类名（`NSStatusBarWindow`）
    pub host_class: String,
    /// 宿主窗口顶边（AppKit 坐标）
    pub host_top: f64,
    pub visible: bool,
    pub width: f64,
    pub text: String,
    pub words: usize,
    pub offset: f64,
    pub playing: bool,
    pub animating: bool,
    pub elapsed_ms: f64,
}

pub fn snapshot() -> Snapshot {
    let Ok(guard) = state().try_lock() else {
        return Snapshot::default();
    };
    Snapshot {
        created: guard.ui.is_some(),
        attached: guard.attached,
        host_class: guard.host_class.clone(),
        host_top: guard.host_top,
        visible: guard.visible,
        width: guard.item_width(),
        text: guard.text.clone(),
        words: guard.words.len(),
        offset: guard.offset,
        playing: guard.playing,
        animating: guard.animating,
        elapsed_ms: guard.current_elapsed(),
    }
}

fn sanitize_width(width: f64) -> f64 {
    if width.is_finite() && width > 1.0 {
        width.clamp(MIN_LYRIC_WIDTH, MAX_LYRIC_WIDTH)
    } else {
        LYRIC_WIDTH
    }
}

fn apply_on_main(mtm: MainThreadMarker, text: String, words: Vec<MenuLyricWord>) {
    // 逐字文本以 words 为准，保证高亮位置与文本严格一致
    let text = if words.is_empty() {
        text
    } else {
        words.iter().map(|word| word.text.as_str()).collect()
    };
    let Ok(mut guard) = state().lock() else {
        return;
    };

    // progress 高频回调绝不该重建排版
    if guard.ui.is_some() && guard.text == text && guard.words == words {
        return;
    }

    if guard.ui.is_none() {
        match create_ui(mtm) {
            Ok(ui) => {
                guard.item_height = ui.view.as_view().frame().size.height;
                guard.ui = Some(ui);
            }
            Err(error) => {
                crate::host_err!("[menubar] 建项失败: {error}");
                return;
            }
        }
    }

    let lyric = build_lyric_text(&text, &words);
    guard.text = text;
    guard.words = words;
    guard.word_ends = lyric.word_ends;
    guard.text_width = lyric.width;
    guard.text_height = lyric.height;
    guard.normal = Some(lyric.normal);
    guard.highlighted = Some(lyric.highlighted);
    guard.ellipsis = Some(lyric.ellipsis);
    guard.ellipsis_width = lyric.ellipsis_width;
    guard.offset = 0.0;
    guard.elapsed_ms = 0.0;
    guard.anchor = Instant::now();

    let width = guard.item_width();
    let height = guard.item_height;
    let (status_item, view) = match guard.ui.as_ref() {
        Some(ui) => (ui.status_item.clone(), ui.view.clone()),
        None => return,
    };
    drop(guard);

    apply_metrics(&status_item, view.as_view(), width, height);
    ensure_ticker();
}

fn create_ui(mtm: MainThreadMarker) -> Result<MenuBarUi, String> {
    let status_bar = NSStatusBar::systemStatusBar();
    let thickness = status_bar.thickness();
    let height = if thickness.is_finite() && thickness > 0.0 {
        thickness
    } else {
        ITEM_HEIGHT
    };
    // 初始长度按“只有图标”算，避免先以 0 宽度入栏再被撑开
    let initial_width = CAPSULE_INSET_X * 2.0 + CONTENT_PAD_LEFT + ICON_SIZE + CONTENT_PAD_RIGHT;
    let status_item = status_bar.statusItemWithLength(initial_width);
    let view = CapsuleView::new(
        mtm,
        NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(initial_width, height)),
    );

    // 自定义 view 直接挂 status item，绕过 NSStatusBarButton 吞点击
    #[allow(deprecated)]
    status_item.setView(Some(view.as_view()));

    Ok(MenuBarUi { status_item, view })
}

fn apply_metrics(status_item: &NSStatusItem, view: &NSView, width: f64, height: f64) {
    status_item.setLength(width);
    view.setFrame(NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(width, height),
    ));
    view.setNeedsDisplay(true);
    note_attachment(view);
}

/// 记录视图挂在哪个窗口上（主线程调用，`/__diag` 只读缓存）。
///
/// `NSStatusBarWindow` + 屏幕顶边这两条能客观证明胶囊真的进了菜单栏，
/// 不依赖截图（截图需要「屏幕录制」权限）。
fn note_attachment(view: &NSView) {
    let mut attached = false;
    let mut host_class = String::new();
    let mut host_top = 0.0;
    if let Some(window) = view.window() {
        attached = true;
        let frame = window.frame();
        host_top = frame.origin.y + frame.size.height;
        host_class = unsafe {
            let name: *mut NSString = msg_send![&*window, className];
            name.as_ref().map(NSString::to_string).unwrap_or_default()
        };
    }
    if let Ok(mut guard) = state().try_lock() {
        guard.attached = attached;
        guard.host_class = host_class;
        guard.host_top = host_top;
    }
}

/// 一行歌词的排版结果
struct LyricText {
    /// 未唱部分
    normal: Retained<NSMutableAttributedString>,
    /// 已唱部分
    highlighted: Retained<NSMutableAttributedString>,
    /// 右侧被藏起歌词时的提示符
    ellipsis: Retained<NSMutableAttributedString>,
    /// 提示符宽度
    ellipsis_width: f64,
    /// 整行宽度
    width: f64,
    /// 行高
    height: f64,
    /// 每个词在整行中的横向结束位置
    word_ends: Vec<f64>,
}

fn build_lyric_text(text: &str, words: &[MenuLyricWord]) -> LyricText {
    let font = NSFont::menuBarFontOfSize(0.0);
    let normal_color = if words.is_empty() {
        NSColor::labelColor()
    } else {
        NSColor::secondaryLabelColor()
    };
    let normal = make_attributed(text, &font, &normal_color);
    let highlighted = make_attributed(text, &font, &NSColor::labelColor());
    // 省略号跟随未唱色，作为“右侧还有内容”的提示
    let ellipsis = make_attributed(ELLIPSIS, &font, &normal_color);
    let ellipsis_width = ellipsis.size().width;
    let size = normal.size();

    // 逐词前缀量宽：跨词 kerning 也算进去，高亮边界才贴合字形
    let mut word_ends = Vec::with_capacity(words.len());
    let mut prefix = String::new();
    for word in words {
        prefix.push_str(&word.text);
        word_ends.push(make_attributed(&prefix, &font, &normal_color).size().width);
    }

    LyricText {
        normal,
        highlighted,
        ellipsis,
        ellipsis_width,
        width: size.width,
        height: size.height,
        word_ends,
    }
}

fn make_attributed(
    text: &str,
    font: &NSFont,
    color: &NSColor,
) -> Retained<NSMutableAttributedString> {
    let string = NSString::from_str(text);
    let attributed =
        NSMutableAttributedString::initWithString(NSMutableAttributedString::alloc(), &string);
    let range = NSRange::new(0, string.length());
    unsafe {
        let _: () = msg_send![
            &attributed,
            addAttribute: NSFontAttributeName,
            value: font,
            range: range
        ];
        let _: () = msg_send![
            &attributed,
            addAttribute: NSForegroundColorAttributeName,
            value: color,
            range: range
        ];
    }
    attributed
}

fn draw_capsule(view: &NSView) {
    // 状态锁只在主线程被持有（改动后必定重绘），用 try_lock 防止
    // AppKit 在 setView/setFrame 内部同步绘制时重入死锁
    let Ok(guard) = state().try_lock() else {
        return;
    };
    let bounds = view.bounds();
    let width = bounds.size.width;
    let height = bounds.size.height;
    if width <= 0.0 || height <= 0.0 {
        return;
    }

    let capsule_height = (height - CAPSULE_INSET_Y * 2.0).max(1.0);
    let capsule = NSRect::new(
        NSPoint::new(CAPSULE_INSET_X, CAPSULE_INSET_Y),
        NSSize::new((width - CAPSULE_INSET_X * 2.0).max(1.0), capsule_height),
    );
    NSColor::labelColor()
        .colorWithAlphaComponent(CAPSULE_ALPHA)
        .setFill();
    NSBezierPath::bezierPathWithRoundedRect_xRadius_yRadius(
        capsule,
        capsule_height / 2.0,
        capsule_height / 2.0,
    )
    .fill();

    if let Some(icon) = guard.icon.as_ref() {
        let icon_rect = NSRect::new(
            NSPoint::new(
                CAPSULE_INSET_X + CONTENT_PAD_LEFT,
                (height - ICON_SIZE) / 2.0,
            ),
            NSSize::new(ICON_SIZE, ICON_SIZE),
        );
        icon.drawInRect(icon_rect);
        tint_template_icon(icon_rect);
    }

    let viewport = guard.lyric_width;
    if viewport <= 0.0 {
        return;
    }
    let (Some(normal), Some(highlighted)) = (guard.normal.as_ref(), guard.highlighted.as_ref())
    else {
        return;
    };

    let origin_x = guard.text_origin_x();
    let offset = guard.offset;
    let text_y = (height - guard.text_height) / 2.0;
    let point = NSPoint::new(origin_x + offset, text_y);
    // 还有隐藏内容时给省略号留槽位，槽位在整行内固定，滚动过程中不会跳
    let has_tail = guard.has_hidden_tail();
    let clip_width = if has_tail {
        (viewport - guard.ellipsis_gutter()).max(1.0)
    } else {
        viewport
    };

    NSGraphicsContext::saveGraphicsState_class();
    NSBezierPath::bezierPathWithRect(NSRect::new(
        NSPoint::new(origin_x, 0.0),
        NSSize::new(clip_width, height),
    ))
    .addClip();
    normal.drawAtPoint(point);

    let sung = guard.sung_width();
    if sung > 0.0 {
        NSGraphicsContext::saveGraphicsState_class();
        NSBezierPath::bezierPathWithRect(NSRect::new(
            NSPoint::new(origin_x + offset, 0.0),
            NSSize::new(sung, height),
        ))
        .addClip();
        highlighted.drawAtPoint(point);
        NSGraphicsContext::restoreGraphicsState_class();
    }
    NSGraphicsContext::restoreGraphicsState_class();

    if has_tail {
        if let Some(ellipsis) = guard.ellipsis.as_ref() {
            ellipsis.drawAtPoint(NSPoint::new(
                origin_x + viewport - guard.ellipsis_width,
                text_y,
            ));
        }
    }
}

/// 模板图只提供 alpha：用当前外观的文字色压一遍，亮暗菜单栏都能看清。
/// `SourceAtop` 只作用在已有像素上；胶囊底色与着色同源（都是 labelColor），不会被压出方形色块。
fn tint_template_icon(rect: NSRect) {
    let Some(context) = NSGraphicsContext::currentContext() else {
        return;
    };
    context.setCompositingOperation(NSCompositingOperation::SourceAtop);
    NSColor::labelColor().setFill();
    NSBezierPath::bezierPathWithRect(rect).fill();
    context.setCompositingOperation(NSCompositingOperation::SourceOver);
}

/// `NSScreenNumber` 就是 CGDirectDisplayID，与 Electron 的 `display.id` 同源
fn display_id(screen: &NSScreen) -> u32 {
    let description = screen.deviceDescription();
    let key = NSString::from_str("NSScreenNumber");
    let number: *mut AnyObject = unsafe { msg_send![&*description, objectForKey: &*key] };
    if number.is_null() {
        return 0;
    }
    unsafe { msg_send![number, unsignedIntValue] }
}

/// 锚点必须取自被点中的那个视图：副屏的菜单栏项可能挂在另一个 NSStatusBarWindow 上，
/// 用全局 `ui.view` 会永远拿到建项时那块屏的坐标
fn emit_menu_lyric_event(view: &NSView, kind: &str) {
    let (payload, handler) = {
        let Ok(guard) = state().lock() else {
            return;
        };
        let Some(window) = view.window() else {
            return;
        };
        let in_window = view.convertRect_toView(view.bounds(), None);
        let screen_rect = window.convertRectToScreen(in_window);
        let payload = MenuLyricEvent {
            kind: kind.to_string(),
            x: screen_rect.origin.x,
            y: screen_rect.origin.y,
            width: screen_rect.size.width,
            height: screen_rect.size.height,
            display_id: window
                .screen()
                .map(|screen| display_id(&screen))
                .unwrap_or(0),
        };
        let Some(handler) = guard.on_event.clone() else {
            return;
        };
        (payload, handler)
    };

    // 点击回调里会建窗口 / 弹菜单：绝不能占用 mouseDown 的调用栈
    thread::Builder::new()
        .name("aira-menu-bar-event".into())
        .spawn(move || handler(payload))
        .ok();
}

fn ensure_ticker() {
    {
        let Ok(mut guard) = state().lock() else {
            return;
        };
        if guard.animating || guard.ui.is_none() || !guard.should_animate() {
            return;
        }
        guard.animating = true;
        guard.last_tick = Instant::now();
    }
    if TICKER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    start_ticker();
}

fn start_ticker() {
    let spawned = thread::Builder::new()
        .name("aira-menu-bar-capsule".into())
        .spawn(|| {
            let interval = Duration::from_millis(TICK_MS);
            loop {
                thread::sleep(interval);
                if !on_main_sync(tick_on_main) {
                    break;
                }
            }
            TICKER_RUNNING.store(false, Ordering::SeqCst);
        })
        .is_ok();

    if !spawned {
        TICKER_RUNNING.store(false, Ordering::SeqCst);
        if let Ok(mut guard) = state().lock() {
            guard.animating = false;
        }
    }
}

fn tick_on_main() -> bool {
    let Ok(mut guard) = state().lock() else {
        return false;
    };
    let view = match guard.ui.as_ref() {
        Some(ui) => ui.view.clone(),
        None => {
            guard.animating = false;
            return false;
        }
    };

    let now = Instant::now();
    let dt = now
        .duration_since(guard.last_tick)
        .as_secs_f64()
        .clamp(0.0, 0.1);
    guard.last_tick = now;

    // 指数逼近目标位置：帧率无关，切行时也不会跳
    let diff = guard.follow_offset() - guard.offset;
    if diff.abs() < 0.25 {
        guard.offset += diff;
    } else {
        guard.offset += diff * (1.0 - (-dt / FOLLOW_TAU).exp());
    }

    let keep_going = guard.should_animate();
    guard.animating = keep_going;
    drop(guard);

    view.as_view().setNeedsDisplay(true);
    note_attachment(view.as_view());
    keep_going
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn width_is_clamped_to_limits() {
        assert_eq!(sanitize_width(150.0), 150.0);
        assert_eq!(sanitize_width(10.0), MIN_LYRIC_WIDTH);
        assert_eq!(sanitize_width(9_999.0), MAX_LYRIC_WIDTH);
        // 非有限值 / 明显无效值回落到默认宽度
        assert_eq!(sanitize_width(f64::NAN), LYRIC_WIDTH);
        assert_eq!(sanitize_width(0.0), LYRIC_WIDTH);
        assert_eq!(sanitize_width(-3.0), LYRIC_WIDTH);
    }

    #[test]
    fn item_width_follows_lyric_viewport() {
        let mut state = MenuBarState::new();
        state.lyric_width = 150.0;
        // 留白 + 图标 + 间距 + 视口
        assert_eq!(
            state.item_width(),
            CAPSULE_INSET_X * 2.0
                + CONTENT_PAD_LEFT
                + ICON_SIZE
                + ICON_GAP
                + 150.0
                + CONTENT_PAD_RIGHT
        );
        assert_eq!(
            state.text_origin_x(),
            CAPSULE_INSET_X + CONTENT_PAD_LEFT + ICON_SIZE + ICON_GAP
        );
    }

    #[test]
    fn sung_width_walks_word_boundaries() {
        let mut state = MenuBarState::new();
        state.words = vec![
            MenuLyricWord {
                start_ms: 0.0,
                end_ms: 1000.0,
                text: "a".into(),
            },
            MenuLyricWord {
                start_ms: 1000.0,
                end_ms: 2000.0,
                text: "b".into(),
            },
        ];
        state.word_ends = vec![10.0, 20.0];
        state.text_width = 20.0;
        state.playing = false;

        state.elapsed_ms = 0.0;
        assert_eq!(state.sung_width(), 0.0);

        state.elapsed_ms = 500.0;
        assert!((state.sung_width() - 5.0).abs() < 1e-9);

        state.elapsed_ms = 1000.0;
        assert!((state.sung_width() - 10.0).abs() < 1e-9);

        state.elapsed_ms = 1500.0;
        assert!((state.sung_width() - 15.0).abs() < 1e-9);

        state.elapsed_ms = 2500.0;
        assert!((state.sung_width() - 20.0).abs() < 1e-9);
    }

    #[test]
    fn follow_offset_keeps_sung_position_and_settles_at_end() {
        let mut state = MenuBarState::new();
        state.lyric_width = 100.0;
        state.text_width = 300.0;
        state.words = vec![
            MenuLyricWord {
                start_ms: 0.0,
                end_ms: 1000.0,
                text: "abc".into(),
            },
            MenuLyricWord {
                start_ms: 1000.0,
                end_ms: 2000.0,
                text: "def".into(),
            },
        ];
        state.word_ends = vec![60.0, 300.0];
        state.playing = false;

        // 未开始：目标位置把已唱（0 宽）放在视口 80% 处 → 80，被夹到 0
        state.elapsed_ms = 0.0;
        assert_eq!(state.follow_offset(), 0.0);

        // 第一个词唱完、第二个词到一半：已唱 60 + 240*0.5 = 180 → 目标 80-180 = -100
        state.elapsed_ms = 1500.0;
        assert!((state.follow_offset() + 100.0).abs() < 1e-9);

        // 唱完：滑到行尾，即最小偏移（视口 - 文本宽度）
        state.elapsed_ms = 5000.0;
        assert!((state.follow_offset() - (100.0 - 300.0)).abs() < 1e-9);

        // 静态文本（无词表）不滚动
        state.words.clear();
        assert_eq!(state.follow_offset(), 0.0);
    }

    #[test]
    fn hidden_tail_detects_overflow() {
        let mut state = MenuBarState::new();
        state.lyric_width = 100.0;
        state.text_width = 120.0;
        assert!(state.has_hidden_tail());
        state.offset = -20.0;
        assert!(!state.has_hidden_tail());
    }

    #[test]
    fn animation_stops_when_hidden_or_settled() {
        let mut state = MenuBarState::new();
        state.lyric_width = 100.0;
        state.text_width = 300.0;
        state.words = vec![MenuLyricWord {
            start_ms: 0.0,
            end_ms: 1000.0,
            text: "abc".into(),
        }];
        state.word_ends = vec![300.0];

        state.visible = false;
        assert!(!state.should_animate());

        state.visible = true;
        state.playing = true;
        state.elapsed_ms = 0.0;
        assert!(state.should_animate(), "逐字进行中应继续跑马灯");

        // 唱完且已滑到行尾 → 停
        state.elapsed_ms = 5000.0;
        state.offset = state.min_offset();
        assert!(!state.should_animate());
    }
}
