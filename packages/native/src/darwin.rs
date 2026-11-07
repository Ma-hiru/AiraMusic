//! macOS 菜单栏胶囊：托盘图标与逐字歌词合并到同一个 NSStatusItem。
//!
//! 单个自定义 `NSView` 负责全部绘制（胶囊底、图标、歌词），
//! 逐字高亮通过“未唱/已唱”两次文本绘制 + 进度裁剪实现，
//! 跑马灯则让已唱位置保持在视口内，避免与音频时钟各跑一套。

#[cfg(target_os = "macos")]
pub mod darwin_menu {
    use std::{
        sync::{Arc, Mutex, OnceLock},
        thread,
        time::{Duration, Instant},
    };

    use dispatch::Queue;
    use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
    use napi::{Error, Result, Status};
    use objc2::rc::Retained;
    use objc2::{AnyThread, ClassType, MainThreadMarker, MainThreadOnly, define_class, msg_send};
    use objc2_app_kit::{
        NSAttributedStringNSStringDrawing, NSBezierPath, NSColor, NSCompositingOperation, NSEvent,
        NSFont, NSFontAttributeName, NSForegroundColorAttributeName, NSGraphicsContext, NSImage,
        NSScreen, NSStatusBar, NSStatusItem, NSView,
    };
    use objc2_foundation::{
        NSMutableAttributedString, NSObjectProtocol, NSPoint, NSRange, NSRect, NSSize, NSString,
    };

    use crate::{MenuBarLyricWord, MenuLyricEvent};

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

    /// CalleeHandled=true → JS 签名 (err, event) => void
    type EventTsfn = ThreadsafeFunction<MenuLyricEvent, ()>;

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
                emit_menu_lyric_event(self, kind);
            }

            #[unsafe(method(rightMouseDown:))]
            fn right_mouse_down(&self, _event: Option<&NSEvent>) {
                emit_menu_lyric_event(self, "right-click");
            }

            #[unsafe(method(drawRect:))]
            fn draw_rect(&self, _dirty_rect: NSRect) {
                draw_capsule(self);
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
    }

    struct MenuBarUi {
        status_item: Retained<NSStatusItem>,
        view: Retained<CapsuleView>,
    }

    unsafe impl Send for MenuBarUi {}

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

    struct MenuBarState {
        ui: Option<MenuBarUi>,
        icon: Option<Retained<NSImage>>,
        /// 歌词纯文本，由 words 拼接或空闲标题
        text: String,
        /// 逐字时间轴（相对行首），空表示静态文本
        words: Vec<MenuBarLyricWord>,
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
        on_event: Option<Arc<EventTsfn>>,
    }

    // 状态只在主线程读写；跨线程调用一律经 Queue::main() 转投
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
            let karaoke = self.playing
                && !self.words.is_empty()
                && self.current_elapsed() < self.last_word_end();
            karaoke || (self.offset - self.follow_offset()).abs() > 0.25
        }
    }

    fn state() -> &'static Mutex<MenuBarState> {
        static STATE: OnceLock<Mutex<MenuBarState>> = OnceLock::new();
        STATE.get_or_init(|| Mutex::new(MenuBarState::new()))
    }

    pub fn init_menu_bar(icon_path: String, tooltip: String) -> Result<()> {
        let apply = move || -> Result<()> {
            let mtm = MainThreadMarker::new()
                .ok_or_else(|| Error::new(Status::GenericFailure, "AppKit requires main thread"))?;
            let icon = if icon_path.is_empty() {
                None
            } else {
                NSImage::initWithContentsOfFile(NSImage::alloc(), &NSString::from_str(&icon_path))
                    .inspect(|image| {
                        // 菜单栏图标按模板图处理：只取 alpha，颜色交给绘制侧
                        image.setTemplate(true);
                    })
            };

            let mut guard = state()
                .lock()
                .map_err(|_| Error::new(Status::GenericFailure, "menu bar state poisoned"))?;
            guard.icon = icon;

            if guard.ui.is_none() {
                // 先建项：菜单栏图标不等第一条歌词就该可见
                let ui = create_ui(mtm)?;
                guard.item_height = ui.view.frame().size.height;
                ui.view.setToolTip(Some(&NSString::from_str(&tooltip)));
                guard.ui = Some(ui);
            } else if let Some(ui) = guard.ui.as_ref() {
                ui.view.setToolTip(Some(&NSString::from_str(&tooltip)));
            }

            let width = guard.item_width();
            let height = guard.item_height;
            let (status_item, view) = match guard.ui.as_ref() {
                Some(ui) => (ui.status_item.clone(), ui.view.clone()),
                None => return Ok(()),
            };
            drop(guard);

            apply_metrics(&status_item, &view, width, height);
            Ok(())
        };

        if MainThreadMarker::new().is_some() {
            apply()
        } else {
            Queue::main().exec_sync(apply)
        }
    }

    pub fn set_menu_bar_tool_tip(tooltip: String) -> Result<()> {
        let apply = move || -> Result<()> {
            let guard = state()
                .lock()
                .map_err(|_| Error::new(Status::GenericFailure, "menu bar state poisoned"))?;
            if let Some(ui) = guard.ui.as_ref() {
                ui.view.setToolTip(Some(&NSString::from_str(&tooltip)));
            }
            Ok(())
        };

        if MainThreadMarker::new().is_some() {
            apply()
        } else {
            Queue::main().exec_sync(apply)
        }
    }

    pub fn set_menu_lyric(
        text: String,
        words: Vec<MenuBarLyricWord>,
        on_event: Option<EventTsfn>,
    ) -> Result<()> {
        let apply = move || -> Result<()> { apply_on_main(text, words, on_event.map(Arc::new)) };

        if MainThreadMarker::new().is_some() {
            apply()
        } else {
            Queue::main().exec_sync(apply)
        }
    }

    /// 设置歌词视口宽度；胶囊总宽 = 固定留白 + 该值
    pub fn set_menu_bar_width(width: f64) -> Result<()> {
        let apply = move || -> Result<()> {
            let mut guard = state()
                .lock()
                .map_err(|_| Error::new(Status::GenericFailure, "menu bar state poisoned"))?;
            let next = sanitize_width(width);
            if (guard.lyric_width - next).abs() < 0.5 {
                return Ok(());
            }
            guard.lyric_width = next;

            let (status_item, view) = match guard.ui.as_ref() {
                Some(ui) => (ui.status_item.clone(), ui.view.clone()),
                None => return Ok(()),
            };
            let item_width = guard.item_width();
            let height = guard.item_height;
            drop(guard);

            apply_metrics(&status_item, &view, item_width, height);
            ensure_ticker();
            Ok(())
        };

        if MainThreadMarker::new().is_some() {
            apply()
        } else {
            Queue::main().exec_sync(apply)
        }
    }

    /// 显示/隐藏整个胶囊；关闭后菜单栏不再有此应用项
    pub fn set_menu_bar_visible(visible: bool) -> Result<()> {
        let apply = move || -> Result<()> {
            let mut guard = state()
                .lock()
                .map_err(|_| Error::new(Status::GenericFailure, "menu bar state poisoned"))?;
            if guard.visible == visible {
                return Ok(());
            }
            guard.visible = visible;

            let (status_item, view) = match guard.ui.as_ref() {
                Some(ui) => (ui.status_item.clone(), ui.view.clone()),
                None => return Ok(()),
            };
            drop(guard);

            #[allow(deprecated)]
            status_item.setVisible(visible);
            if visible {
                view.setNeedsDisplay(true);
                ensure_ticker();
            }
            Ok(())
        };

        if MainThreadMarker::new().is_some() {
            apply()
        } else {
            Queue::main().exec_sync(apply)
        }
    }

    fn sanitize_width(width: f64) -> f64 {
        if width.is_finite() && width > 1.0 {
            width.clamp(MIN_LYRIC_WIDTH, MAX_LYRIC_WIDTH)
        } else {
            LYRIC_WIDTH
        }
    }

    pub fn set_menu_lyric_progress(elapsed: f64, playing: bool) -> Result<()> {
        let apply = move || -> Result<()> {
            let mut guard = state()
                .lock()
                .map_err(|_| Error::new(Status::GenericFailure, "menu bar state poisoned"))?;
            let view = match guard.ui.as_ref() {
                Some(ui) => ui.view.clone(),
                None => return Ok(()),
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

            view.setNeedsDisplay(true);
            ensure_ticker();
            Ok(())
        };

        if MainThreadMarker::new().is_some() {
            apply()
        } else {
            Queue::main().exec_sync(apply)
        }
    }

    fn apply_on_main(
        text: String,
        words: Vec<MenuBarLyricWord>,
        on_event: Option<Arc<EventTsfn>>,
    ) -> Result<()> {
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| Error::new(Status::GenericFailure, "AppKit requires main thread"))?;
        // 逐字文本以 words 为准，保证高亮位置与文本严格一致
        let text = if words.is_empty() {
            text
        } else {
            words.iter().map(|word| word.text.as_str()).collect()
        };
        let mut guard = state()
            .lock()
            .map_err(|_| Error::new(Status::GenericFailure, "menu bar state poisoned"))?;

        if let Some(cb) = on_event {
            guard.on_event = Some(cb);
        }
        // progress 高频回调绝不该重建排版
        if guard.ui.is_some() && guard.text == text && guard.words == words {
            return Ok(());
        }

        if guard.ui.is_none() {
            let ui = create_ui(mtm)?;
            guard.item_height = ui.view.frame().size.height;
            guard.ui = Some(ui);
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
            None => return Ok(()),
        };
        drop(guard);

        apply_metrics(&status_item, &view, width, height);
        ensure_ticker();
        Ok(())
    }

    fn create_ui(mtm: MainThreadMarker) -> Result<MenuBarUi> {
        let status_bar = NSStatusBar::systemStatusBar();
        let thickness = status_bar.thickness();
        let height = if thickness.is_finite() && thickness > 0.0 {
            thickness
        } else {
            ITEM_HEIGHT
        };
        // 初始长度按“只有图标”算，避免先以 0 宽度入栏再被撑开
        let initial_width =
            CAPSULE_INSET_X * 2.0 + CONTENT_PAD_LEFT + ICON_SIZE + CONTENT_PAD_RIGHT;
        let status_item = status_bar.statusItemWithLength(initial_width);
        let view = CapsuleView::new(
            mtm,
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(initial_width, height)),
        );

        // 自定义 view 直接挂 status item，绕过 NSStatusBarButton 吞点击
        #[allow(deprecated)]
        status_item.setView(Some(view.as_super()));

        Ok(MenuBarUi { status_item, view })
    }

    fn apply_metrics(status_item: &NSStatusItem, view: &CapsuleView, width: f64, height: f64) {
        status_item.setLength(width);
        view.setFrame(NSRect::new(
            NSPoint::new(0.0, 0.0),
            NSSize::new(width, height),
        ));
        view.setNeedsDisplay(true);
    }

    fn build_lyric_text(text: &str, words: &[MenuBarLyricWord]) -> LyricText {
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

        if has_tail && let Some(ellipsis) = guard.ellipsis.as_ref() {
            ellipsis.drawAtPoint(NSPoint::new(
                origin_x + viewport - guard.ellipsis_width,
                text_y,
            ));
        }
    }

    /// 模板图只提供 alpha：用当前外观的文字色压一遍，亮暗菜单栏都能看清     /// `SourceAtop` 只作用在已有像素上；胶囊底色与着色同源（都是 labelColor），不会被压出方形色块
    /// `NSScreenNumber` 就是 CGDirectDisplayID，与 Electron 的 `display.id` 同源
    fn display_id(screen: &NSScreen) -> u32 {
        let description = screen.deviceDescription();
        let key = NSString::from_str("NSScreenNumber");
        let Some(number) = description.objectForKey(&key) else {
            return 0;
        };
        unsafe { msg_send![&*number, unsignedIntValue] }
    }

    fn tint_template_icon(rect: NSRect) {
        let Some(context) = NSGraphicsContext::currentContext() else {
            return;
        };
        context.setCompositingOperation(NSCompositingOperation::SourceAtop);
        NSColor::labelColor().setFill();
        NSBezierPath::bezierPathWithRect(rect).fill();
        context.setCompositingOperation(NSCompositingOperation::SourceOver);
    }

    /// 锚点必须取自被点中的那个视图：副屏的菜单栏项可能挂在另一个 NSStatusBarWindow 上，
    /// 用全局 `ui.view` 会永远拿到建项时那块屏的坐标
    fn emit_menu_lyric_event(view: &NSView, kind: &str) {
        let (payload, cb) = {
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
            let Some(cb) = guard.on_event.clone() else {
                return;
            };
            (payload, cb)
        };

        Queue::main().exec_async(move || {
            let _ = cb.call(Ok(payload), ThreadsafeFunctionCallMode::NonBlocking);
        });
    }

    fn ensure_ticker() {
        let start = {
            let Ok(mut guard) = state().lock() else {
                return;
            };
            if guard.animating || guard.ui.is_none() || !guard.should_animate() {
                return;
            }
            guard.animating = true;
            guard.last_tick = Instant::now();
            true
        };
        if start {
            start_ticker();
        }
    }

    fn start_ticker() {
        thread::Builder::new()
            .name("aira-menu-bar-capsule".into())
            .spawn(|| {
                let interval = Duration::from_millis(TICK_MS);
                loop {
                    thread::sleep(interval);
                    let keep_going = Queue::main().exec_sync(tick_on_main);
                    if !keep_going {
                        break;
                    }
                }
            })
            .ok();
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

        view.setNeedsDisplay(true);
        keep_going
    }
}
