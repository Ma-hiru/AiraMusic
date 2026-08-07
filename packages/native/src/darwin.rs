//! macOS 菜单栏歌词：自建 NSStatusItem + 自定义 NSTextField（点击 + 像素跑马灯）。

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
    use objc2::{ClassType, MainThreadMarker, MainThreadOnly, define_class, msg_send};
    use objc2_app_kit::{
        NSColor, NSEvent, NSFont, NSStatusBar, NSStatusItem, NSTextAlignment, NSTextField, NSView,
    };
    use objc2_foundation::{NSObjectProtocol, NSPoint, NSRect, NSSize, NSString};

    use crate::MenuLyricEvent;

    const VIEWPORT_HEIGHT: f64 = 22.0;
    const TICK_MS: u64 = 16;
    const DEFAULT_VIEWPORT_WIDTH: f64 = 100.0;

    /// CalleeHandled=true → JS 签名 (err, event) => void
    type EventTsfn = ThreadsafeFunction<MenuLyricEvent, ()>;

    enum Phase {
        PauseStart,
        Scroll,
        PauseEnd,
    }

    define_class!(
        #[unsafe(super = NSTextField)]
        #[thread_kind = MainThreadOnly]
        #[name = "AiraMenuLyricTextField"]
        struct LyricTextField;

        unsafe impl NSObjectProtocol for LyricTextField {}

        impl LyricTextField {
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
                emit_menu_lyric_event(kind);
            }

            #[unsafe(method(rightMouseDown:))]
            fn right_mouse_down(&self, _event: Option<&NSEvent>) {
                emit_menu_lyric_event("right-click");
            }
        }
    );

    impl LyricTextField {
        fn new(mtm: MainThreadMarker, frame: NSRect) -> Retained<Self> {
            let this = Self::alloc(mtm).set_ivars(());
            let field: Retained<Self> = unsafe { msg_send![super(this), initWithFrame: frame] };
            field.setEditable(false);
            field.setSelectable(false);
            field.setBordered(false);
            field.setBezeled(false);
            field.setDrawsBackground(false);
            field.setFont(Some(&NSFont::menuBarFontOfSize(0.0)));
            field.setTextColor(Some(&NSColor::controlTextColor()));
            field.setStringValue(&NSString::from_str(""));
            field
        }
    }

    struct MenuLyricUi {
        status_item: Retained<NSStatusItem>,
        clip_view: Retained<NSView>,
        text_field: Retained<LyricTextField>,
    }

    unsafe impl Send for MenuLyricUi {}

    struct MenuLyricState {
        ui: Option<MenuLyricUi>,
        text: String,
        text_width: f64,
        viewport_width: f64,
        offset: f64,
        direction: f64,
        phase: Phase,
        phase_started: Instant,
        ping_pong: bool,
        duration_ms: u64,
        gap_ms: u64,
        animating: bool,
        on_event: Option<Arc<EventTsfn>>,
    }

    impl MenuLyricState {
        fn new() -> Self {
            Self {
                ui: None,
                text: String::new(),
                text_width: 0.0,
                viewport_width: DEFAULT_VIEWPORT_WIDTH,
                offset: 0.0,
                direction: -1.0,
                phase: Phase::PauseStart,
                phase_started: Instant::now(),
                ping_pong: false,
                duration_ms: 3000,
                gap_ms: 1000,
                animating: false,
                on_event: None,
            }
        }
    }

    fn state() -> &'static Mutex<MenuLyricState> {
        static STATE: OnceLock<Mutex<MenuLyricState>> = OnceLock::new();
        STATE.get_or_init(|| Mutex::new(MenuLyricState::new()))
    }

    pub fn set_menu_lyric(
        _handle: &[u8],
        lyric: String,
        ping_pong: bool,
        duration: i64,
        gap: i64,
        width: f64,
        on_event: Option<EventTsfn>,
    ) -> Result<()> {
        let duration_ms = duration.max(1) as u64;
        let gap_ms = gap.max(0) as u64;
        let viewport_width = if width.is_finite() && width > 0.0 {
            width
        } else {
            DEFAULT_VIEWPORT_WIDTH
        };
        let on_event = on_event.map(Arc::new);

        if MainThreadMarker::new().is_some() {
            apply_on_main(
                lyric,
                ping_pong,
                duration_ms,
                gap_ms,
                viewport_width,
                on_event,
            )?;
        } else {
            Queue::main().exec_sync(move || {
                apply_on_main(
                    lyric,
                    ping_pong,
                    duration_ms,
                    gap_ms,
                    viewport_width,
                    on_event,
                )
            })?;
        }

        Ok(())
    }

    fn apply_on_main(
        lyric: String,
        ping_pong: bool,
        duration_ms: u64,
        gap_ms: u64,
        viewport_width: f64,
        on_event: Option<Arc<EventTsfn>>,
    ) -> Result<()> {
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| Error::new(Status::GenericFailure, "AppKit requires main thread"))?;

        let mut guard = state()
            .lock()
            .map_err(|_| Error::new(Status::GenericFailure, "menu lyric state poisoned"))?;

        if let Some(cb) = on_event {
            guard.on_event = Some(cb);
        }

        let width_changed = (guard.viewport_width - viewport_width).abs() > f64::EPSILON;
        if guard.ui.is_none() {
            guard.ui = Some(create_ui(mtm, viewport_width)?);
            guard.viewport_width = viewport_width;
        } else if width_changed {
            apply_viewport_width(guard.ui.as_ref().unwrap(), viewport_width);
            guard.viewport_width = viewport_width;
        }

        let needs_restart = guard.text != lyric
            || guard.ping_pong != ping_pong
            || guard.duration_ms != duration_ms
            || guard.gap_ms != gap_ms
            || width_changed;

        guard.text = lyric.clone();
        guard.ping_pong = ping_pong;
        guard.duration_ms = duration_ms;
        guard.gap_ms = gap_ms;

        let text_field = guard.ui.as_ref().unwrap().text_field.clone();
        text_field.setStringValue(&NSString::from_str(&lyric));

        // 先按内容 intrinsic 量宽，再把 frame 裁回视口高度
        let fitted = {
            let tf: &NSTextField = text_field.as_super();
            tf.sizeToFit();
            tf.frame().size.width
        };
        guard.text_width = fitted;
        let viewport_width = guard.viewport_width;

        if fitted <= viewport_width {
            guard.offset = 0.0;
            guard.phase = Phase::PauseStart;
            guard.animating = false;
            // 短句铺满视口并居中，保证整块区域可点
            apply_offset(&text_field, 0.0, viewport_width, true);
            return Ok(());
        }

        if needs_restart {
            guard.offset = 0.0;
            guard.direction = -1.0;
            guard.phase = Phase::PauseStart;
            guard.phase_started = Instant::now();
        }

        apply_offset(&text_field, guard.offset, fitted, false);

        if !guard.animating {
            guard.animating = true;
            drop(guard);
            start_ticker();
        }

        Ok(())
    }

    fn create_ui(mtm: MainThreadMarker, viewport_width: f64) -> Result<MenuLyricUi> {
        let status_bar = NSStatusBar::systemStatusBar();
        let status_item = status_bar.statusItemWithLength(viewport_width);

        // 外层 clip 容器：固定视口；内部 LyricTextField 左右平移
        let clip = unsafe {
            let alloc = NSView::alloc(mtm);
            let view: Retained<NSView> = msg_send![
                alloc,
                initWithFrame: NSRect::new(
                    NSPoint::new(0.0, 0.0),
                    NSSize::new(viewport_width, VIEWPORT_HEIGHT),
                )
            ];
            view
        };
        clip.setWantsLayer(true);
        if let Some(layer) = clip.layer() {
            layer.setMasksToBounds(true);
        }

        let text_field = LyricTextField::new(
            mtm,
            NSRect::new(
                NSPoint::new(0.0, 0.0),
                NSSize::new(viewport_width, VIEWPORT_HEIGHT),
            ),
        );
        clip.addSubview(text_field.as_super().as_super());

        // 自定义 view 直接挂 status item，绕过 NSStatusBarButton 吞点击
        #[allow(deprecated)]
        status_item.setView(Some(&clip));

        Ok(MenuLyricUi {
            status_item,
            clip_view: clip,
            text_field,
        })
    }

    fn apply_viewport_width(ui: &MenuLyricUi, viewport_width: f64) {
        ui.status_item.setLength(viewport_width);
        ui.clip_view.setFrame(NSRect::new(
            NSPoint::new(0.0, 0.0),
            NSSize::new(viewport_width, VIEWPORT_HEIGHT),
        ));
    }

    fn apply_offset(text_field: &LyricTextField, offset: f64, width: f64, centered: bool) {
        let tf = text_field.as_super();
        tf.setAlignment(if centered {
            NSTextAlignment::Center
        } else {
            NSTextAlignment::Left
        });
        tf.setFrame(NSRect::new(
            NSPoint::new(offset, 0.0),
            NSSize::new(width.max(1.0), VIEWPORT_HEIGHT),
        ));
    }

    fn emit_menu_lyric_event(kind: &str) {
        let (payload, cb) = {
            let Ok(guard) = state().lock() else {
                return;
            };
            let Some(ui) = guard.ui.as_ref() else {
                return;
            };
            let Some(window) = ui.clip_view.window() else {
                return;
            };
            // 用固定 clip 视口的屏幕 frame，避免文字平移后锚点飘
            let bounds = ui.clip_view.bounds();
            let in_window = ui.clip_view.convertRect_toView(bounds, None);
            let screen_rect = window.convertRectToScreen(in_window);
            let payload = MenuLyricEvent {
                kind: kind.to_string(),
                x: screen_rect.origin.x,
                y: screen_rect.origin.y,
                width: screen_rect.size.width,
                height: screen_rect.size.height,
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

    fn start_ticker() {
        thread::Builder::new()
            .name("aira-menu-lyric".into())
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
        if !guard.animating {
            return false;
        }
        if guard.ui.is_none() {
            guard.animating = false;
            return false;
        }

        let max_offset = 0.0;
        let min_offset = (guard.viewport_width - guard.text_width).min(0.0);
        let travel = (max_offset - min_offset).abs().max(1.0);
        let speed = travel / (guard.duration_ms.max(1) as f64 / 1000.0);
        let dt = TICK_MS as f64 / 1000.0;
        let gap = Duration::from_millis(guard.gap_ms);

        match guard.phase {
            Phase::PauseStart => {
                if guard.phase_started.elapsed() >= gap {
                    guard.phase = Phase::Scroll;
                    guard.phase_started = Instant::now();
                    guard.direction = -1.0;
                }
            }
            Phase::Scroll => {
                guard.offset += guard.direction * speed * dt;
                if guard.direction < 0.0 && guard.offset <= min_offset {
                    guard.offset = min_offset;
                    guard.phase = Phase::PauseEnd;
                    guard.phase_started = Instant::now();
                } else if guard.direction > 0.0 && guard.offset >= max_offset {
                    guard.offset = max_offset;
                    guard.phase = Phase::PauseStart;
                    guard.phase_started = Instant::now();
                }
            }
            Phase::PauseEnd => {
                if guard.phase_started.elapsed() >= gap {
                    if guard.ping_pong {
                        // 来回：从尽头滚回起点
                        guard.direction = 1.0;
                        guard.phase = Phase::Scroll;
                        guard.phase_started = Instant::now();
                    } else {
                        // 单向：停在尽头，不再跳回开头
                        guard.offset = min_offset;
                        guard.animating = false;
                    }
                }
            }
        }

        let offset = guard.offset;
        let text_width = guard.text_width;
        let keep_going = guard.animating;
        let text_field = guard.ui.as_ref().unwrap().text_field.clone();
        drop(guard);
        apply_offset(&text_field, offset, text_width, false);
        keep_going
    }
}
