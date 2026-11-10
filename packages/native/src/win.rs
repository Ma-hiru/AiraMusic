//! Windows 任务栏缩略图与预览工具栏。
//!
//! 三个属性各司其职，缺一不可：
//!
//! - `DWMWA_HAS_ICONIC_BITMAP`(10)：告诉 DWM「这个窗口自己会出图」；
//! - `DWMWA_FORCE_ICONIC_REPRESENTATION`(7)：真正让 DWM 用这张图**替代**实时画面
//!   （只设 10 的实测结果是任务栏卡片退化成窗口实时画面，封面根本不出现）；
//! - `DWMWA_DISALLOW_PEEK`(11)：这个窗口不参与 Peek。
//!
//! 第 3 个并**不能**真正拦住 Peek：实测设了 11 之后 0x326 照发（ARM 日志可见）。
//! 所以 Peek 一直是我们交的静态帧——官方的做法是在这里交 1×1 全透明把 Peek 挖成洞，
//! 再由 `PH-PC-TASKBAR_ICON_WINDOW` 覆盖窗口重画；我们没有那个覆盖窗口，挖洞只剩空白，
//! 交截图至少画面是对的。
//!
//! 于是分工是：
//!
//! 1. `WM_DWMSENDICONICTHUMBNAIL`：**按卡片比例**出图——正方形封面居中，四周是同一张
//!    封面模糊压暗后的底。位图比例必须等于卡片比例，因为 DWM 是**拉伸**填充
//!    （实测交 107×107 会被拉成 400×214，封面就扁了）。
//!
//!    **例外**：探测结果是 1/1（原尺寸就收得下）时仍交 `min(w,h)` 纯正方形。
//!    这类环境（窗口有重定向表面，如 ARM 虚拟机）DWM 是**等比放置**的，
//!    纯正方形就是一直以来正常的表现，没必要去改它。
//!
//!    **尺寸必须运行时探测**：DWM 接受的位图大小取决于窗口类型。有重定向表面的窗口
//!    （ARM 虚拟机，GDI 呈现）接受请求尺寸；带 `WS_EX_NOREDIRECTIONBITMAP` 的窗口
//!    （DirectComposition 呈现，x86 上 Electron 默认如此）只接受很小的位图——
//!    实测 `400x214` 与 `214x214` 都被拒，`107x107` 才通过。所以按 1/2、1/4… 逐级
//!    缩小整个画布，把第一个被接受的档位记进 `thumb_divisor`。
//!
//! 2. `WM_DWMSENDICONICLIVEPREVIEWBITMAP`：把窗口画面截下来交上去兜底。
//!
//! 两条消息都有同一个兜底：**应用没在限定时间内交出位图，DWM 就退回它自己的
//! 默认表示**（那个转圈的占位图）。所以两条路径都必须保证"要么交图，要么撤销表示"。
//!
//! 播放按钮走 ITaskbarList4 的工具栏（与缩略图内容互相独立），点击通过
//! `WM_COMMAND` + `THBN_CLICKED` 回传给 JS。

use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    ffi::c_void,
    mem::{size_of, zeroed},
    ptr::{null, null_mut},
    rc::Rc,
    sync::Mutex,
    time::Instant,
};

use crate::utils::{
    MAX_THUMBNAIL_EDGE, bounded, fill_geometry, packed_size, square_inset, square_side,
};
use image::{RgbaImage, imageops};
use napi::bindgen_prelude::Uint8Array;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Error, Result, Status};
use napi_derive::napi;
use once_cell::sync::Lazy;
use windows::Win32::{
    Foundation::HWND as ComHwnd,
    System::Com::{
        CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
        CoUninitialize,
    },
    UI::{
        Shell::{
            ITaskbarList4, THB_FLAGS, THB_ICON, THB_TOOLTIP, THBF_ENABLED, THBN_CLICKED,
            THUMBBUTTON, TaskbarList,
        },
        WindowsAndMessaging::HICON as ComIcon,
    },
};
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
    Graphics::{
        Dwm::{
            DWMWA_CLOAKED, DWMWA_DISALLOW_PEEK, DWMWA_FORCE_ICONIC_REPRESENTATION,
            DWMWA_HAS_ICONIC_BITMAP, DwmGetWindowAttribute, DwmInvalidateIconicBitmaps,
            DwmIsCompositionEnabled, DwmSetIconicLivePreviewBitmap, DwmSetIconicThumbnail,
            DwmSetWindowAttribute,
        },
        Gdi::{
            BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BitBlt, ClientToScreen, CreateBitmap,
            CreateCompatibleDC, CreateDIBSection, DIB_RGB_COLORS, DeleteDC, DeleteObject, GdiFlush,
            GetObjectW, HBITMAP, HDC, HGDIOBJ, SRCCOPY, SelectObject,
        },
    },
    Storage::Xps::PrintWindow,
    System::Threading::GetCurrentThreadId,
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            CreateIconIndirect, DestroyIcon, GWL_EXSTYLE, GWL_STYLE, GetClientRect, GetWindowLongW,
            GetWindowRect, GetWindowThreadProcessId, HICON, ICONINFO, IsWindow, IsWindowVisible,
            RegisterWindowMessageW, WM_COMMAND, WM_NCDESTROY,
        },
    },
};

const WM_DWMSENDICONICTHUMBNAIL: u32 = 0x0323;
const WM_DWMSENDICONICLIVEPREVIEWBITMAP: u32 = 0x0326;
const SUBCLASS_ID: usize = 0x4149_5241;
const BUTTON_PREVIOUS: u32 = 0x4150;
const BUTTON_PLAY: u32 = 0x4151;
const BUTTON_NEXT: u32 = 0x4152;
const MAX_FRAMES: usize = 4;
/// 折半探测的下限：任一边小于它就没有显示价值了，直接放弃表示。
const MIN_THUMBNAIL_EDGE: u32 = 16;
/// 让 `PrintWindow` 把**渲染结果**画进 DC，而不是发 `WM_PRINT` 让窗口自己重画一遍。
/// Chromium 不实现 `WM_PRINTCLIENT`，只有这个标志能拿到真实画面。
const PW_RENDERFULLCONTENT: u32 = 0x0000_0002;
/// 诊断用：没有重定向表面的窗口（DirectComposition 呈现）无法提供 DWM 缩略图。
const WS_EX_NOREDIRECTIONBITMAP: i32 = 0x0020_0000;
const WS_EX_LAYERED: i32 = 0x0008_0000;
const WS_CHILD: i32 = 0x4000_0000;
/// `ThumbBarAddButtons` 在 Shell 尚未创建按钮窗口时的返回码。
const E_INVALIDARG: i32 = 0x8007_0057_u32 as i32;

thread_local! {
    // 取出 Rc 后立即释放表的借用，窗口过程和 COM 回调里都可以安全重入。
    static WINDOWS: RefCell<HashMap<isize, Rc<Window>>> = RefCell::new(HashMap::new());
}

static TRACE_ENABLED: Lazy<bool> =
    Lazy::new(|| std::env::var_os("AIRAMUSIC_TASKBAR_DEBUG").is_some());

/// JS 侧注册的日志回调；`None` 时退回 stderr。
static LOGGER: Lazy<Mutex<Option<TaskbarLogTsfn>>> = Lazy::new(|| Mutex::new(None));

struct Messages {
    button_created: u32,
}

fn messages() -> &'static Messages {
    static MESSAGES: Lazy<Messages> = Lazy::new(|| Messages {
        button_created: register_message("TaskbarButtonCreated"),
    });
    &MESSAGES
}

fn register_message(name: &str) -> u32 {
    unsafe { RegisterWindowMessageW(wide(name).as_ptr()) }
}

struct ComApartment(bool);

impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.0 {
            unsafe { CoUninitialize() };
        }
    }
}

struct Taskbar {
    // 字段按声明顺序析构：先释放接口，再平衡本模块的 CoInitializeEx。
    api: ITaskbarList4,
    _apartment: ComApartment,
}

impl Taskbar {
    fn new() -> Result<Self> {
        let initialized = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        // Electron 已经以别的模式初始化过 COM 时，沿用它。
        if initialized.is_err() && initialized.0 != 0x8001_0106_u32 as i32 {
            return Err(com_error("CoInitializeEx", initialized.0));
        }
        let apartment = ComApartment(initialized.is_ok());
        let api: ITaskbarList4 = unsafe {
            CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)
                .map_err(|err| com_error("CoCreateInstance(TaskbarList)", err.code().0))?
        };
        unsafe { api.HrInit() }.map_err(|err| com_error("ITaskbarList::HrInit", err.code().0))?;
        Ok(Self {
            api,
            _apartment: apartment,
        })
    }
}

/// 一个主窗口的任务栏状态。所有字段都在窗口线程上访问。
struct Window {
    hwnd: HWND,
    cover: RefCell<Option<Rc<Cover>>>,
    cover_bytes: RefCell<Vec<u8>>,
    frames: RefCell<HashMap<(u32, u32), Rc<Pixels>>>,
    /// 主窗口当前是否已经声明 iconic 表示。
    iconic: Cell<bool>,
    /// 缩略图相对请求尺寸的缩小倍数；1 表示原尺寸直接可用。
    ///
    /// 有重定向表面的窗口就是 1；`WS_EX_NOREDIRECTIONBITMAP` 的窗口上只接受很小的
    /// 位图，这个值是逐级折半试出来的。
    thumb_divisor: Cell<u32>,
    /// 首次交付失败时打一次环境诊断，之后不再重复。
    diagnosed: Cell<bool>,
    taskbar: RefCell<Option<Rc<Taskbar>>>,
    icons: RefCell<Option<Rc<ButtonIcons>>>,
    /// 上一代图标：工具栏更新成功前不能 DestroyIcon，否则 Shell 里是野句柄。
    retired: RefCell<Option<Rc<ButtonIcons>>>,
    playing: Cell<bool>,
    buttons_added: Cell<bool>,
    /// 截图期间置位。`PrintWindow` 会重入本窗口的窗口过程，DWM 若在这时又发
    /// 一次 Peek 请求就会递归截图，必须挡住。
    capturing: Cell<bool>,
    on_action: RefCell<Option<Rc<TaskbarActionTsfn>>>,
}

impl Window {
    fn new(hwnd: HWND) -> Self {
        Self {
            hwnd,
            cover: RefCell::new(None),
            cover_bytes: RefCell::new(Vec::new()),
            frames: RefCell::new(HashMap::new()),
            iconic: Cell::new(false),
            thumb_divisor: Cell::new(1),
            diagnosed: Cell::new(false),
            taskbar: RefCell::new(None),
            icons: RefCell::new(None),
            retired: RefCell::new(None),
            playing: Cell::new(false),
            buttons_added: Cell::new(false),
            capturing: Cell::new(false),
            on_action: RefCell::new(None),
        }
    }

    fn taskbar(&self) -> Result<Rc<Taskbar>> {
        if let Some(taskbar) = self.taskbar.borrow().clone() {
            return Ok(taskbar);
        }
        let taskbar = Rc::new(Taskbar::new()?);
        *self.taskbar.borrow_mut() = Some(taskbar.clone());
        Ok(taskbar)
    }

    // ---- 封面与 iconic 表示 ----

    fn store_cover(&self, cover: Cover, bytes: &[u8]) -> Result<()> {
        info(format!(
            "cover stored: {}x{}, {} bytes",
            cover.rgba.width(),
            cover.rgba.height(),
            bytes.len()
        ));
        *self.cover.borrow_mut() = Some(Rc::new(cover));
        *self.cover_bytes.borrow_mut() = bytes.to_vec();
        self.frames.borrow_mut().clear();
        // 不重置 thumb_divisor：它描述的是"DWM 接受多大位图"，属于窗口属性，
        // 换封面不会改变，重探只会白白多打几次必然失败的调用。
        if let Err(err) = self.enable_iconic() {
            self.clear_cover();
            return Err(err);
        }
        // 封面真的变了才让 DWM 丢弃旧位图重新索要。
        // 这一步失败只是"下次悬停才刷新"，不能因此回滚整次下发。
        let hr = unsafe { DwmInvalidateIconicBitmaps(self.hwnd) };
        if hr < 0 {
            warn(format!(
                "DwmInvalidateIconicBitmaps failed: 0x{:08x} (preview may be stale)",
                hr as u32
            ));
        }
        Ok(())
    }

    fn clear_cover(&self) {
        if self.cover.borrow().is_none() {
            return;
        }
        info("cover cleared, restoring the live thumbnail");
        self.cover.borrow_mut().take();
        self.cover_bytes.borrow_mut().clear();
        self.frames.borrow_mut().clear();
        if self.iconic.get() {
            let _ = self.disable_iconic();
        }
    }

    /// 两个属性都要声明：只设 `HAS_ICONIC_BITMAP` 时 DWM 仍会用窗口实时画面画卡片，
    /// 封面根本不出现；`FORCE_ICONIC_REPRESENTATION` 才是"用我这张图替代实时画面"。
    ///
    /// 代价是 Peek 从此只能由我们交静态位图。所以顺手声明 `DISALLOW_PEEK`：
    /// 这个窗口干脆不参与 Peek，悬停时看到的就是**真实的窗口**——那才是实时的。
    fn enable_iconic(&self) -> Result<()> {
        if self.iconic.get() {
            trace("iconic representation already enabled");
            return Ok(());
        }
        // 先 HAS 再 FORCE：FORCE 的前提是窗口声明了会自己出图。
        let result = set_attribute(self.hwnd, DWMWA_HAS_ICONIC_BITMAP, true)
            .and_then(|()| set_attribute(self.hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, true));
        if let Err(err) = result {
            // 半开状态比不声明更糟：DWM 会来索要位图，我们却不知道该不该给。
            error(format!("enabling iconic representation failed: {err}"));
            let _ = self.disable_iconic();
            return Err(err);
        }
        // 失败不致命：Peek 会退回我们交的截图（会定格，但至少不是空白）。
        if let Err(err) = set_attribute(self.hwnd, DWMWA_DISALLOW_PEEK, true) {
            warn(format!(
                "DWMWA_DISALLOW_PEEK failed ({err}), peek will use a static capture"
            ));
        }
        self.iconic.set(true);
        log_attributes(self.hwnd);
        info("iconic representation enabled");
        Ok(())
    }

    /// 撤销 iconic 表示，主窗口回到系统实时缩略图与实时 Peek。
    fn disable_iconic(&self) -> Result<()> {
        let force = set_attribute(self.hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, false);
        let has = set_attribute(self.hwnd, DWMWA_HAS_ICONIC_BITMAP, false);
        if let Err(err) = set_attribute(self.hwnd, DWMWA_DISALLOW_PEEK, false) {
            warn(format!("clearing DWMWA_DISALLOW_PEEK failed: {err}"));
        }
        self.iconic.set(false);
        log_attributes(self.hwnd);
        trace("iconic representation disabled");
        // 两次都要尝试：第一个失败不能阻止第二个被清除。
        force.and(has)
    }

    // ---- DWM 索要位图 ----

    fn render_thumbnail(&self, lparam: LPARAM) {
        let Some((width, height)) = packed_size(lparam as usize) else {
            warn(format!(
                "thumbnail request with a zero side: lparam={lparam:#x}"
            ));
            self.clear_cover();
            return;
        };
        trace(format!(
            "0x323 thumbnail request: lparam={lparam:#x} -> {width}x{height}"
        ));
        if self.cover.borrow().is_none() {
            // 没有图可交：立刻撤销表示，让 DWM 回落实时缩略图。
            // 留着表示却不交图，DWM 会退回它自己的默认占位图——就是"加载中"。
            warn("0x323 without a cover, dropping the iconic representation");
            self.clear_cover();
            return;
        }
        // 探测 DWM 接受多大。两个约束一起考虑：
        //
        // 1. 这台 x86 的窗口带 WS_EX_NOREDIRECTIONBITMAP，请求尺寸（400x214）被拒，
        //    107x107 却通过——存在一个远小于请求值的上限；
        // 2. DWM 是**拉伸**填充（不是等比放置），交正方形会被拉扁，
        //    所以位图必须保持请求的宽高比，只能整体等比缩小。
        //
        // 于是按 1/2、1/4… 逐级缩小**整个卡片**，第一个被接受的档位记进
        // `thumb_divisor`，后续请求直接用，不再重复试错。
        let known = self.thumb_divisor.get().max(1);
        let mut divisor = known;
        loop {
            // 1/1 意味着"DWM 收得下原尺寸"，也就是窗口有重定向表面（ARM 那类环境）。
            // 这类环境 DWM 会等比放置位图，交纯正方形最干净，也是这里一直以来的表现。
            // 只有被限速的机器（1/2 及以下）才需要按卡片比例自绘。
            let (width_at, height_at) = if divisor == 1 {
                let side = square_side(width, height);
                (side, side)
            } else {
                (width / divisor, height / divisor)
            };
            if width_at < MIN_THUMBNAIL_EDGE || height_at < MIN_THUMBNAIL_EDGE {
                // 唯一安全的善后是撤掉表示：否则 DWM 一直等我们交图，
                // 卡片会永久停在加载占位图上，比退回实时缩略图糟得多。
                error(format!(
                    "0x323 delivery failed at every scale down to 1/{divisor}, dropping the iconic representation"
                ));
                self.diagnose_thumbnail_failure(width, height);
                self.clear_cover();
                return;
            }
            match self.deliver_thumbnail(width_at, height_at) {
                Ok(elapsed) => {
                    if known != divisor {
                        info(format!(
                            "0x323 thumbnail scale settled at 1/{divisor} ({width_at}x{height_at}, request {width}x{height}, {})",
                            if divisor == 1 { "square" } else { "framed" }
                        ));
                        self.thumb_divisor.set(divisor);
                    }
                    info(format!(
                        "0x323 delivered {width_at}x{height_at} (request {width}x{height}, 1/{divisor}, {elapsed})"
                    ));
                    return;
                }
                Err(err) => {
                    trace(format!(
                        "0x323 {width_at}x{height_at} (1/{divisor}) rejected: {err}"
                    ));
                    divisor *= 2;
                }
            }
        }
    }

    /// 返回交付耗时，方便对照 DWM 的等待时限。
    fn deliver_thumbnail(&self, width: u32, height: u32) -> Result<String> {
        let start = Instant::now();
        let frame = self.frame(width, height).ok_or_else(|| {
            Error::new(
                Status::GenericFailure,
                "thumbnail requested without a cover",
            )
        })?;
        let rendered = millis(start);
        create_bitmap(&frame).map_or_else(
            || Err(last_error("CreateDIBSection(thumbnail)")),
            |bitmap| {
                let hr = unsafe { DwmSetIconicThumbnail(self.hwnd, bitmap, 0) };
                unsafe { DeleteObject(bitmap) };
                hresult(
                    hr,
                    &format!("DwmSetIconicThumbnail({}x{})", frame.width, frame.height),
                )
                .map(|()| format!("render {rendered}, total {}", millis(start)))
            },
        )
    }

    /// 按目标尺寸出图并缓存。探测阶段会连续试几个尺寸，各自是不同的缓存键。
    fn frame(&self, width: u32, height: u32) -> Option<Rc<Pixels>> {
        if let Some(frame) = self.frames.borrow().get(&(width, height)).cloned() {
            return Some(frame);
        }
        let cover = self.cover.borrow().clone()?;
        let frame = Rc::new(cover.render(width, height));
        let mut frames = self.frames.borrow_mut();
        if frames.len() >= MAX_FRAMES {
            frames.clear();
        }
        frames.insert((width, height), frame.clone());
        Some(frame)
    }

    // ---- 诊断 ----

    /// 交付失败时打一次环境快照。
    ///
    /// 同一份代码在 ARM 虚拟机上成功、在 x86 笔记本上恒失败，差异只可能来自
    /// 窗口状态或位图本身。这里把能查的全打出来，并且额外用一张 8×8 的纯色位图
    /// 再试一次：**连极小图也被拒，就说明问题在窗口，跟尺寸、内容都无关**。
    fn diagnose_thumbnail_failure(&self, width: u32, height: u32) {
        if self.diagnosed.replace(true) {
            return;
        }
        let style = unsafe { GetWindowLongW(self.hwnd, GWL_STYLE) };
        let ex_style = unsafe { GetWindowLongW(self.hwnd, GWL_EXSTYLE) };
        let visible = unsafe { IsWindowVisible(self.hwnd) } != 0;
        let mut cloaked = 0_i32;
        let cloaked_hr = unsafe {
            DwmGetWindowAttribute(
                self.hwnd,
                DWMWA_CLOAKED as u32,
                (&raw mut cloaked).cast::<c_void>(),
                size_of::<i32>() as u32,
            )
        };
        let mut window = RECT::default();
        let _ = unsafe { GetWindowRect(self.hwnd, &mut window) };

        // 确认我们交出去的确实是 32bpp 的 DIB，并且尺寸没被吞掉。
        let frame = Pixels {
            width,
            height,
            data: vec![0xff2b_2b2b; width as usize * height as usize],
        };
        let bitmap_state = create_bitmap(&frame).map_or_else(
            || "create-failed".to_owned(),
            |bitmap| {
                let mut measured: BITMAP = unsafe { zeroed() };
                let got = unsafe {
                    GetObjectW(
                        bitmap,
                        size_of::<BITMAP>() as i32,
                        (&raw mut measured).cast::<c_void>(),
                    )
                };
                unsafe { DeleteObject(bitmap) };
                if got == 0 {
                    "invalid-handle".to_owned()
                } else {
                    format!(
                        "{}x{}x{}bpp/{}planes",
                        measured.bmWidth,
                        measured.bmHeight,
                        measured.bmBitsPixel,
                        measured.bmPlanes
                    )
                }
            },
        );

        error(format!(
            "diagnostics: style={style:#010x} ex_style={ex_style:#010x} child={} layered={} noredirection={} visible={visible} cloaked={} window={}x{} bitmap={bitmap_state}",
            style & WS_CHILD != 0,
            ex_style & WS_EX_LAYERED != 0,
            ex_style & WS_EX_NOREDIRECTIONBITMAP != 0,
            if cloaked_hr < 0 {
                "read-failed".to_owned()
            } else {
                cloaked.to_string()
            },
            window.right - window.left,
            window.bottom - window.top,
        ));

        // 极小位图探测：用来区分"窗口不接受任何缩略图"与"尺寸/内容有问题"。
        let tiny = Pixels {
            width: 8,
            height: 8,
            data: vec![0xff2b_2b2b; 64],
        };
        if let Some(bitmap) = create_bitmap(&tiny) {
            let hr = unsafe { DwmSetIconicThumbnail(self.hwnd, bitmap, 0) };
            unsafe { DeleteObject(bitmap) };
            error(format!(
                "diagnostics: 8x8 probe -> 0x{:08x} (S_OK means the window still accepts thumbnails)",
                hr as u32
            ));
        }
    }

    // ---- Peek ----

    /// Peek 里要看到的是**窗口本身**，不是封面。
    ///
    /// 设了 `FORCE_ICONIC_REPRESENTATION` 之后 DWM 手里只有 iconic 表示可用，
    /// 不交图就退回默认占位图，所以只能把窗口当前画面截下来交上去。
    /// 截图失败时退回封面——一张图总比一块空白强。
    fn render_live_preview(&self) {
        trace("0x326 live preview requested");
        if self.capturing.replace(true) {
            warn("0x326 re-entered during capture, skipping this round");
            return;
        }
        self.draw_live_preview();
        self.capturing.set(false);
    }

    fn draw_live_preview(&self) {
        let start = Instant::now();
        match self.capture_client() {
            Ok(bitmap) => {
                let hr = unsafe { DwmSetIconicLivePreviewBitmap(self.hwnd, bitmap, null(), 0) };
                unsafe { DeleteObject(bitmap) };
                if hr < 0 {
                    error(format!(
                        "DwmSetIconicLivePreviewBitmap rejected: 0x{:08x} ({})",
                        hr as u32,
                        millis(start)
                    ));
                } else {
                    trace(format!(
                        "0x326 delivered window capture ({})",
                        millis(start)
                    ));
                }
            }
            Err(err) => {
                warn(format!(
                    "0x326 window capture failed ({err}), falling back to the cover"
                ));
                self.deliver_cover_preview();
            }
        }
    }

    fn deliver_cover_preview(&self) {
        let Some((width, height)) = self.client_size() else {
            warn("0x326 fallback skipped: window has no client area");
            return;
        };
        let Some(frame) = self.frame(width, height) else {
            warn("0x326 fallback skipped: no cover");
            return;
        };
        let Some(bitmap) = create_bitmap(&frame) else {
            error(format!(
                "0x326 fallback bitmap failed: {}",
                last_error("CreateDIBSection(preview)")
            ));
            return;
        };
        let hr = unsafe { DwmSetIconicLivePreviewBitmap(self.hwnd, bitmap, null(), 0) };
        unsafe { DeleteObject(bitmap) };
        if hr < 0 {
            error(format!("0x326 fallback rejected: 0x{:08x}", hr as u32));
        } else {
            trace(format!("0x326 delivered cover fallback {width}x{height}"));
        }
    }

    fn client_size(&self) -> Option<(u32, u32)> {
        let mut rect = RECT::default();
        if unsafe { GetClientRect(self.hwnd, &mut rect) } == 0 {
            return None;
        }
        let width = (rect.right - rect.left).max(0) as u32;
        let height = (rect.bottom - rect.top).max(0) as u32;
        match (width, height) {
            (0, _) | (_, 0) => None,
            _ => Some(bounded(width, height, MAX_THUMBNAIL_EDGE)),
        }
    }

    /// 把窗口当前画面截成一张 32bpp、顶朝下、尺寸等于**客户区**的 DIB。
    ///
    /// 先整窗打印再裁客户区，而不是用 `PW_CLIENTONLY`：后者的实现是发
    /// `WM_PRINTCLIENT` 让窗口自己重画，Chromium 不接这条消息，拿到的会是空白。
    fn capture_client(&self) -> Result<HBITMAP> {
        let start = Instant::now();
        let mut window = RECT::default();
        if unsafe { GetWindowRect(self.hwnd, &mut window) } == 0 {
            return Err(last_error("GetWindowRect"));
        }
        let mut client = RECT::default();
        if unsafe { GetClientRect(self.hwnd, &mut client) } == 0 {
            return Err(last_error("GetClientRect"));
        }
        let window_width = window.right - window.left;
        let window_height = window.bottom - window.top;
        let client_width = client.right - client.left;
        let client_height = client.bottom - client.top;
        if window_width <= 0 || window_height <= 0 || client_width <= 0 || client_height <= 0 {
            return Err(Error::new(
                Status::GenericFailure,
                format!(
                    "window has no area to capture (window {window_width}x{window_height}, client {client_width}x{client_height})"
                ),
            ));
        }
        let mut origin = POINT::default();
        if unsafe { ClientToScreen(self.hwnd, &mut origin) } == 0 {
            return Err(last_error("ClientToScreen"));
        }
        let offset_x = origin.x - window.left;
        let offset_y = origin.y - window.top;
        trace(format!(
            "capture: window {window_width}x{window_height}, client {client_width}x{client_height}, client origin ({offset_x},{offset_y})"
        ));

        let whole = CaptureSurface::new(window_width, window_height)
            .ok_or_else(|| last_error("CreateDIBSection(capture)"))?;
        let printed = unsafe { PrintWindow(self.hwnd, whole.dc, PW_RENDERFULLCONTENT) };
        if printed == 0 {
            return Err(last_error("PrintWindow"));
        }
        let printed_at = millis(start);
        let surface = CaptureSurface::new(client_width, client_height)
            .ok_or_else(|| last_error("CreateDIBSection(client)"))?;
        let copied = unsafe {
            BitBlt(
                surface.dc,
                0,
                0,
                client_width,
                client_height,
                whole.dc,
                offset_x,
                offset_y,
                SRCCOPY,
            )
        };
        if copied == 0 {
            return Err(last_error("BitBlt"));
        }
        // GDI 不写 alpha 通道，不补的话 DWM 会把整张图当成全透明。
        surface.make_opaque(client_width, client_height);
        trace(format!(
            "capture done: PrintWindow {printed_at}, crop+alpha {}",
            millis(start)
        ));
        Ok(surface.into_bitmap())
    }

    // ---- 工具栏按钮 ----

    fn sync_buttons(&self) -> Result<()> {
        let Some(icons) = self.icons.borrow().clone() else {
            trace("sync_buttons skipped: icons not set yet");
            return Ok(());
        };
        let buttons = icons.buttons(self.playing.get());
        let taskbar = self.taskbar()?;
        let added = self.buttons_added.get();
        let operation = if added {
            "ThumbBarUpdateButtons"
        } else {
            "ThumbBarAddButtons"
        };
        let result = unsafe {
            if added {
                taskbar
                    .api
                    .ThumbBarUpdateButtons(ComHwnd(self.hwnd), &buttons)
            } else {
                taskbar.api.ThumbBarAddButtons(ComHwnd(self.hwnd), &buttons)
            }
        };
        match result {
            Ok(()) => {
                self.buttons_added.set(true);
                trace(format!("{operation} ok (playing={})", self.playing.get()));
                Ok(())
            }
            Err(err) if err.code().0 == E_INVALIDARG => {
                // Shell 还没创建按钮窗口：等 TaskbarButtonCreated 再来一次。
                self.buttons_added.set(false);
                trace(format!(
                    "{operation} -> E_INVALIDARG (shell not ready), waiting for TaskbarButtonCreated"
                ));
                Ok(())
            }
            Err(err) if added => {
                // 状态与 Shell 不一致时反着再做一次，仍然失败才上报。
                self.buttons_added.set(false);
                match unsafe { taskbar.api.ThumbBarAddButtons(ComHwnd(self.hwnd), &buttons) } {
                    Ok(()) => {
                        self.buttons_added.set(true);
                        warn(format!(
                            "{operation} failed (0x{:08x}), recovered via ThumbBarAddButtons",
                            err.code().0 as u32
                        ));
                        Ok(())
                    }
                    Err(_) => Err(com_error("ITaskbarList::ThumbBarButtons", err.code().0)),
                }
            }
            Err(err) => Err(com_error("ITaskbarList::ThumbBarButtons", err.code().0)),
        }
    }

    fn dispatch_button(&self, wparam: WPARAM) -> bool {
        if ((wparam >> 16) & 0xffff) != THBN_CLICKED as usize {
            return false;
        }
        let action = match (wparam & 0xffff) as u32 {
            BUTTON_PREVIOUS => "previous",
            BUTTON_PLAY if self.playing.get() => "pause",
            BUTTON_PLAY => "play",
            BUTTON_NEXT => "next",
            other => {
                trace(format!("WM_COMMAND with unknown thumb button: {other:#x}"));
                return false;
            }
        };
        trace(format!("thumb button clicked: {action}"));
        if let Some(callback) = self.on_action.borrow().clone() {
            let status = callback.call(
                Ok(action.to_owned()),
                ThreadsafeFunctionCallMode::NonBlocking,
            );
            if status != Status::Ok {
                error(format!("thumb button callback dispatch failed: {status:?}"));
            }
        } else {
            warn("thumb button clicked but no handler is registered");
        }
        true
    }

    fn release(&self) {
        *self.cover.borrow_mut() = None;
        self.frames.borrow_mut().clear();
        *self.icons.borrow_mut() = None;
        *self.retired.borrow_mut() = None;
        trace("released all taskbar resources");
    }
}

struct Pixels {
    width: u32,
    height: u32,
    data: Vec<u32>,
}

struct Cover {
    rgba: RgbaImage,
}

impl Cover {
    fn decode(bytes: &[u8]) -> Result<Self> {
        let rgba = image::load_from_memory(bytes)
            .map_err(|err| Error::new(Status::InvalidArg, format!("decode image failed: {err}")))?
            .to_rgba8();
        if rgba.width() == 0 || rgba.height() == 0 {
            return Err(Error::new(Status::InvalidArg, "image is empty"));
        }
        Ok(Self { rgba })
    }

    /// 出图入口：按卡片比例画，正方形封面居中，四周是同一张封面模糊压暗后的底。
    ///
    /// **位图比例必须等于卡片比例**：实测 DWM 是**拉伸**填充（不是等比放置），
    /// 交一张 107×107 的正方形会被拉成 400×214，封面就扁了。所以这里按 `width x height`
    /// 出图，把正方形画在中间，缩放全程等比。
    fn render(&self, width: u32, height: u32) -> Pixels {
        let (width, height) = (width.max(1), height.max(1));
        if width == height {
            return self.fill(width, height);
        }
        self.framed(width, height)
    }

    /// 封面等比铺满目标尺寸（会裁掉超出的部分）。
    fn fill(&self, width: u32, height: u32) -> Pixels {
        let (scaled_width, scaled_height, offset_x, offset_y) =
            fill_geometry(self.rgba.width(), self.rgba.height(), width, height);
        let scaled = imageops::resize(
            &self.rgba,
            scaled_width,
            scaled_height,
            imageops::FilterType::Lanczos3,
        );
        let data = (0..height)
            .flat_map(|y| (0..width).map(move |x| (x, y)))
            .map(|(x, y)| {
                let [red, green, blue, alpha] = scaled.get_pixel(offset_x + x, offset_y + y).0;
                over(0xff00_0000, [red, green, blue, alpha])
            })
            .collect();
        Pixels {
            width,
            height,
            data,
        }
    }

    /// 宽幅卡片：正方形封面居中，四周用同一张封面模糊压暗后铺底。
    fn framed(&self, width: u32, height: u32) -> Pixels {
        let (side, left, top) = square_inset(width, height);
        let mut data = self.backdrop(width, height);
        let foreground = imageops::resize(&self.rgba, side, side, imageops::FilterType::Lanczos3);
        for y in 0..side {
            for x in 0..side {
                let index = ((top + y) * width + left + x) as usize;
                data[index] = over(data[index], foreground.get_pixel(x, y).0);
            }
        }
        Pixels {
            width,
            height,
            data,
        }
    }

    /// 卡片底：封面铺满整块后模糊、压暗，作为居中方图的背景。
    fn backdrop(&self, width: u32, height: u32) -> Vec<u32> {
        let (scaled_width, scaled_height, offset_x, offset_y) =
            fill_geometry(self.rgba.width(), self.rgba.height(), width, height);
        let scaled = imageops::resize(
            &self.rgba,
            scaled_width,
            scaled_height,
            imageops::FilterType::Triangle,
        );
        let cropped = imageops::crop_imm(&scaled, offset_x, offset_y, width, height).to_image();
        let blurred = imageops::fast_blur(&cropped, (height as f32 / 24.0).max(1.0));
        blurred
            .pixels()
            .map(|pixel| {
                let [red, green, blue, alpha] = pixel.0;
                let base = over(0xff00_0000, [red, green, blue, alpha]);
                // 压到 45%，让居中封面成为视觉主体。
                let dim = |channel: u32| channel * 45 / 100;
                0xff00_0000
                    | dim((base >> 16) & 0xff) << 16
                    | dim((base >> 8) & 0xff) << 8
                    | dim(base & 0xff)
            })
            .collect()
    }
}

/// 把带 alpha 的像素合成到不透明的目标像素上，结果恒为不透明。
fn over(destination: u32, [red, green, blue, alpha]: [u8; 4]) -> u32 {
    let alpha = u32::from(alpha);
    if alpha == 255 {
        return 0xff00_0000 | u32::from(red) << 16 | u32::from(green) << 8 | u32::from(blue);
    }
    let inverse = 255 - alpha;
    let mix = |source: u8, background: u32| -> u32 {
        (u32::from(source) * alpha + background * inverse + 127) / 255
    };
    let red = mix(red, (destination >> 16) & 0xff);
    let green = mix(green, (destination >> 8) & 0xff);
    let blue = mix(blue, destination & 0xff);
    0xff00_0000 | red << 16 | green << 8 | blue
}

struct Icon(HICON);

impl Drop for Icon {
    fn drop(&mut self) {
        unsafe { DestroyIcon(self.0) };
    }
}

struct ButtonIcons {
    previous: Icon,
    play: Icon,
    pause: Icon,
    next: Icon,
}

impl ButtonIcons {
    fn decode(icons: &TaskbarButtonIcons) -> Result<Self> {
        Ok(Self {
            previous: decode_icon(icons.previous.as_ref())?,
            play: decode_icon(icons.play.as_ref())?,
            pause: decode_icon(icons.pause.as_ref())?,
            next: decode_icon(icons.next.as_ref())?,
        })
    }

    fn buttons(&self, playing: bool) -> [THUMBBUTTON; 3] {
        [
            button(BUTTON_PREVIOUS, self.previous.0, "上一首"),
            button(
                BUTTON_PLAY,
                if playing { self.pause.0 } else { self.play.0 },
                if playing { "暂停" } else { "播放" },
            ),
            button(BUTTON_NEXT, self.next.0, "下一首"),
        ]
    }
}

/// `image` 为 None 时撤销 iconic 表示，主窗口恢复系统实时缩略图。
fn apply_cover(handle: &[u8], image: Option<&[u8]>) -> Result<()> {
    let window = attach(hwnd_from_buffer(handle)?)?;
    let Some(bytes) = image else {
        trace("setCover(null): keeping the system live thumbnail");
        window.clear_cover();
        return Ok(());
    };
    trace(format!("setCover: {} bytes", bytes.len()));
    // 同一张封面重复下发时只补一次表示声明，不重建缓存。
    if window.cover.borrow().is_some() && *window.cover_bytes.borrow() == bytes {
        trace("setCover: identical bytes, re-asserting the iconic attributes");
        return window.enable_iconic();
    }
    let cover = match Cover::decode(bytes) {
        Ok(cover) => cover,
        Err(err) => {
            error(format!("cover decode failed: {err}"));
            window.clear_cover();
            return Err(err);
        }
    };
    window.store_cover(cover, bytes)
}

fn apply_buttons(
    handle: &[u8],
    playing: bool,
    icons: &TaskbarButtonIcons,
    on_action: TaskbarActionTsfn,
) -> Result<()> {
    let window = attach(hwnd_from_buffer(handle)?)?;
    let icons = Rc::new(ButtonIcons::decode(icons)?);
    trace(format!("setTaskbarButtons: playing={playing}"));
    let previous_action = window.on_action.borrow_mut().replace(Rc::new(on_action));
    let previous_icons = window.icons.borrow_mut().replace(icons);
    // 上一代图标在这一刻已经确定不被工具栏引用，可以安全释放。
    let stalled = window.retired.replace(previous_icons);
    window.playing.set(playing);
    let result = window.sync_buttons();
    if result.is_ok() {
        // 工具栏已经指向新图标，上一代才可以析构。
        window.retired.borrow_mut().take();
    }
    drop(stalled);
    drop(previous_action);
    result
}

fn attach(hwnd: HWND) -> Result<Rc<Window>> {
    if unsafe { IsWindow(hwnd) } == 0 {
        return Err(Error::new(Status::InvalidArg, "taskbar window is gone"));
    }
    if unsafe { GetWindowThreadProcessId(hwnd, std::ptr::null_mut()) != GetCurrentThreadId() } {
        return Err(Error::new(
            Status::GenericFailure,
            "taskbar must run on the window thread",
        ));
    }
    if messages().button_created == 0 {
        return Err(last_error("RegisterWindowMessageW(TaskbarButtonCreated)"));
    }
    if let Some(window) = window(hwnd) {
        return Ok(window);
    }
    let window = Rc::new(Window::new(hwnd));
    WINDOWS.with(|windows| windows.borrow_mut().insert(hwnd as isize, window.clone()));
    if unsafe { SetWindowSubclass(hwnd, Some(proc_), SUBCLASS_ID, 0) } == 0 {
        WINDOWS.with(|windows| windows.borrow_mut().remove(&(hwnd as isize)));
        return Err(last_error("SetWindowSubclass"));
    }
    let composition = {
        let mut enabled = 0;
        let hr = unsafe { DwmIsCompositionEnabled(&mut enabled) };
        if hr < 0 {
            "unknown".to_owned()
        } else if enabled != 0 {
            "on".to_owned()
        } else {
            "off".to_owned()
        }
    };
    info(format!(
        "attached hwnd={:#x} thread={} composition={composition}",
        hwnd as isize,
        unsafe { GetCurrentThreadId() }
    ));
    Ok(window)
}

fn window(hwnd: HWND) -> Option<Rc<Window>> {
    WINDOWS.with(|windows| windows.borrow().get(&(hwnd as isize)).cloned())
}

unsafe extern "system" fn proc_(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    let Some(window) = window(hwnd) else {
        return unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
    };
    match msg {
        WM_DWMSENDICONICTHUMBNAIL => {
            window.render_thumbnail(lparam);
            return 0;
        }
        WM_DWMSENDICONICLIVEPREVIEWBITMAP => {
            window.render_live_preview();
            return 0;
        }
        _ if msg == messages().button_created => {
            trace("TaskbarButtonCreated received, re-adding the thumb buttons");
            window.buttons_added.set(false);
            if let Err(err) = window.sync_buttons() {
                error(format!(
                    "thumb buttons failed after TaskbarButtonCreated: {err}"
                ));
            }
        }
        WM_COMMAND if window.dispatch_button(wparam) => return 0,
        WM_NCDESTROY => {
            trace("WM_NCDESTROY, detaching the subclass");
            WINDOWS.with(|windows| windows.borrow_mut().remove(&(hwnd as isize)));
            unsafe { RemoveWindowSubclass(hwnd, Some(proc_), SUBCLASS_ID) };
            window.release();
        }
        _ => {}
    }
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

fn set_attribute(hwnd: HWND, attribute: i32, enabled: bool) -> Result<()> {
    let value = i32::from(enabled);
    let hr = unsafe {
        DwmSetWindowAttribute(
            hwnd,
            attribute as u32,
            (&raw const value).cast::<c_void>(),
            size_of::<i32>() as u32,
        )
    };
    let name = attribute_name(attribute);
    if hr < 0 {
        error(format!(
            "DwmSetWindowAttribute({name}={enabled}) rejected: 0x{:08x}",
            hr as u32
        ));
        return Err(com_error(&format!("DwmSetWindowAttribute({name})"), hr));
    }
    trace(format!(
        "DwmSetWindowAttribute({name}={enabled}) -> 0x{:08x}",
        hr as u32
    ));
    Ok(())
}

/// 回读属性，确认它真的生效了。设置成功不等于生效（例如窗口尚未创建完成）。
fn read_attribute(hwnd: HWND, attribute: i32) -> Option<i32> {
    let mut value = 0_i32;
    let hr = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            attribute as u32,
            (&raw mut value).cast::<c_void>(),
            size_of::<i32>() as u32,
        )
    };
    (hr >= 0).then_some(value)
}

fn attribute_name(attribute: i32) -> &'static str {
    match attribute {
        DWMWA_HAS_ICONIC_BITMAP => "HAS_ICONIC_BITMAP",
        DWMWA_FORCE_ICONIC_REPRESENTATION => "FORCE_ICONIC_REPRESENTATION",
        DWMWA_DISALLOW_PEEK => "DISALLOW_PEEK",
        _ => "UNKNOWN",
    }
}

/// 把三个属性的当前值打出来，出问题时一眼能看出表示有没有挂上。
///
/// 这三个属性是**只写**的：`DwmGetWindowAttribute` 读不回来（返回 E_INVALIDARG），
/// 所以正常情况就是 `n/a`，不代表设置失败——设置本身的 HRESULT 上面已经记了。
fn log_attributes(hwnd: HWND) {
    let flag = |attribute: i32| {
        read_attribute(hwnd, attribute).map_or_else(|| "n/a".to_owned(), |v| v.to_string())
    };
    trace(format!(
        "attributes: HAS={} FORCE={} DISALLOW_PEEK={}",
        flag(DWMWA_HAS_ICONIC_BITMAP),
        flag(DWMWA_FORCE_ICONIC_REPRESENTATION),
        flag(DWMWA_DISALLOW_PEEK)
    ));
}

/// 一块临时的 32bpp DIB 和一个绑好它的内存 DC，专门用于窗口截图。
///
/// 位图始终选中在 DC 里，所以析构时必须先 `SelectObject` 还原再删，否则
/// `DeleteObject` 会静默失败，句柄一直泄漏。
struct CaptureSurface {
    bitmap: HBITMAP,
    previous: HGDIOBJ,
    dc: HDC,
    bits: *mut u32,
    taken: bool,
}

impl CaptureSurface {
    fn new(width: i32, height: i32) -> Option<Self> {
        let mut info: BITMAPINFO = unsafe { zeroed() };
        info.bmiHeader = BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            // 负高度 = 顶朝下，内存里的行序与截图一致。
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            ..unsafe { zeroed() }
        };
        let mut bits = null_mut();
        let bitmap = unsafe {
            CreateDIBSection(null_mut(), &info, DIB_RGB_COLORS, &mut bits, null_mut(), 0)
        };
        if bitmap.is_null() || bits.is_null() {
            return None;
        }
        let dc = unsafe { CreateCompatibleDC(null_mut()) };
        if dc.is_null() {
            unsafe { DeleteObject(bitmap) };
            return None;
        }
        let previous = unsafe { SelectObject(dc, bitmap) };
        Some(Self {
            bitmap,
            previous,
            dc,
            bits: bits.cast(),
            taken: false,
        })
    }

    /// 把 alpha 通道补成不透明。GDI 只写 RGB，alpha 会保持建位图时的 0，
    /// DWM 拿到全 0 alpha 的位图会当作完全透明，Peek 上就是一片空白。
    fn make_opaque(&self, width: i32, height: i32) {
        unsafe { GdiFlush() };
        let length = (width as usize).saturating_mul(height as usize);
        for index in 0..length {
            unsafe { *self.bits.add(index) |= 0xff00_0000 };
        }
    }

    /// 交出位图所有权：DC 照常释放，位图由调用方销毁。
    fn into_bitmap(mut self) -> HBITMAP {
        self.taken = true;
        self.bitmap
    }
}

impl Drop for CaptureSurface {
    fn drop(&mut self) {
        unsafe {
            SelectObject(self.dc, self.previous);
            if !self.taken {
                DeleteObject(self.bitmap);
            }
            DeleteDC(self.dc);
        }
    }
}

fn create_bitmap(frame: &Pixels) -> Option<HBITMAP> {
    let length = (frame.width as usize).checked_mul(frame.height as usize)?;
    if length == 0 || frame.data.len() < length {
        return None;
    }
    let mut info: BITMAPINFO = unsafe { zeroed() };
    info.bmiHeader = BITMAPINFOHEADER {
        biSize: size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: frame.width as i32,
        biHeight: -(frame.height as i32),
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB,
        ..unsafe { zeroed() }
    };
    let mut bits = std::ptr::null_mut();
    let bitmap = unsafe {
        CreateDIBSection(
            std::ptr::null_mut(),
            &info,
            DIB_RGB_COLORS,
            &mut bits,
            std::ptr::null_mut(),
            0,
        )
    };
    if bitmap.is_null() {
        return None;
    }
    if bits.is_null() {
        unsafe { DeleteObject(bitmap) };
        return None;
    }
    unsafe {
        std::slice::from_raw_parts_mut(bits.cast::<u32>(), length)
            .copy_from_slice(&frame.data[..length]);
    }
    Some(bitmap)
}

fn decode_icon(bytes: &[u8]) -> Result<Icon> {
    let image = Cover::decode(bytes)?.rgba;
    let width = image.width();
    let height = image.height();
    let frame = Pixels {
        width,
        height,
        data: image.pixels().map(|pixel| premultiplied(pixel.0)).collect(),
    };
    let color = create_bitmap(&frame).ok_or_else(|| last_error("CreateDIBSection(icon)"))?;
    let mask_bits = vec![0_u8; (width as usize).div_ceil(16) * 2 * height as usize];
    let mask =
        unsafe { CreateBitmap(width as i32, height as i32, 1, 1, mask_bits.as_ptr().cast()) };
    if mask.is_null() {
        unsafe { DeleteObject(color) };
        return Err(last_error("CreateBitmap(icon mask)"));
    }
    let info = ICONINFO {
        fIcon: 1,
        xHotspot: 0,
        yHotspot: 0,
        hbmMask: mask,
        hbmColor: color,
    };
    let icon = unsafe { CreateIconIndirect(&info) };
    unsafe {
        DeleteObject(mask);
        DeleteObject(color);
    }
    if icon.is_null() {
        return Err(last_error("CreateIconIndirect"));
    }
    Ok(Icon(icon))
}

/// `CreateIconIndirect` 吃预乘 alpha 的 32bpp 位图，直接给直通颜色会出现白边。
fn premultiplied([red, green, blue, alpha]: [u8; 4]) -> u32 {
    let premultiply = |color: u8| (u32::from(color) * u32::from(alpha) + 127) / 255;
    premultiply(blue) | premultiply(green) << 8 | premultiply(red) << 16 | u32::from(alpha) << 24
}

fn button(id: u32, icon: HICON, tip: &str) -> THUMBBUTTON {
    let mut button = THUMBBUTTON {
        dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
        iId: id,
        hIcon: ComIcon(icon),
        dwFlags: THBF_ENABLED,
        ..Default::default()
    };
    for (out, ch) in button.szTip.iter_mut().zip(tip.encode_utf16()) {
        *out = ch;
    }
    button
}

fn hwnd_from_buffer(handle: &[u8]) -> Result<HWND> {
    let bytes: [u8; size_of::<isize>()] = handle
        .get(..size_of::<isize>())
        .and_then(|bytes| bytes.try_into().ok())
        .ok_or_else(|| Error::new(Status::InvalidArg, "native window handle is too short"))?;
    let hwnd = isize::from_le_bytes(bytes) as HWND;
    if hwnd.is_null() {
        return Err(Error::new(
            Status::InvalidArg,
            "native window handle is null",
        ));
    }
    Ok(hwnd)
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

// ---- 日志 ----
//
// 原生侧跑在窗口线程里，自己写文件不合适，所以把日志回传给 JS，由主进程的
// `Log` 统一落盘（`APP_LOG_LEVEL` 控制级别、按天分文件、带时间戳）。
// 没注册回调时退回 stderr，`yarn dev` 的终端里照样能看到。

fn trace(message: impl AsRef<str>) {
    emit(LogLevel::Debug, message.as_ref());
}

fn info(message: impl AsRef<str>) {
    emit(LogLevel::Info, message.as_ref());
}

fn warn(message: impl AsRef<str>) {
    emit(LogLevel::Warn, message.as_ref());
}

fn error(message: impl AsRef<str>) {
    emit(LogLevel::Error, message.as_ref());
}

fn emit(level: LogLevel, message: &str) {
    if let Ok(guard) = LOGGER.lock()
        && let Some(logger) = guard.as_ref()
    {
        let record = TaskbarLogRecord {
            level: level.as_str().to_owned(),
            message: message.to_owned(),
        };
        if logger.call(Ok(record), ThreadsafeFunctionCallMode::NonBlocking) == Status::Ok {
            return;
        }
    }
    // 没有 logger 时只把非 debug 的写出来，避免刷屏。
    if level != LogLevel::Debug || *TRACE_ENABLED {
        eprintln!("[taskbar] ({}) {message}", level.as_str());
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(self) -> &'static str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Warn => "warn",
            Self::Error => "error",
        }
    }
}

/// 耗时格式化。DWM 对交出位图有时限，超了就用它自己的占位图，所以每次都记时长。
fn millis(start: Instant) -> String {
    format!("{}ms", start.elapsed().as_millis())
}

fn hresult(hr: i32, operation: &str) -> Result<()> {
    if hr < 0 {
        Err(com_error(operation, hr))
    } else {
        Ok(())
    }
}

fn com_error(operation: &str, code: i32) -> Error {
    Error::new(
        Status::GenericFailure,
        format!("{operation} failed: 0x{:08x}", code as u32),
    )
}

fn last_error(operation: &str) -> Error {
    Error::new(
        Status::GenericFailure,
        format!("{operation} failed: {}", std::io::Error::last_os_error()),
    )
}

/// 任务栏按钮图标，PNG 编码。
#[napi(object)]
pub struct TaskbarButtonIcons {
    pub previous: Uint8Array,
    pub play: Uint8Array,
    pub pause: Uint8Array,
    pub next: Uint8Array,
}

/// 按钮点击回调：只传播放动作，位图与窗口交互都在原生侧完成。
pub type TaskbarActionTsfn = ThreadsafeFunction<String, ()>;

/// 一条原生日志。
#[napi(object)]
pub struct TaskbarLogRecord {
    /// `debug` / `info` / `warn` / `error`
    pub level: String,
    pub message: String,
}

/// 原生日志回调。原生侧不直接写文件，交给主进程的 logger 统一落盘。
pub type TaskbarLogTsfn = ThreadsafeFunction<TaskbarLogRecord, ()>;

/// 注册原生日志回调。重复调用会替换旧回调。
///
/// 注册后原生侧的所有 `[taskbar]` 输出都会走这里；不注册则退回 stderr。
#[napi(js_name = "setTaskbarLogger")]
pub fn set_taskbar_logger(logger: TaskbarLogTsfn) {
    if let Ok(mut guard) = LOGGER.lock() {
        *guard = Some(logger);
    }
    info("logger attached");
}

/// 设置主窗口的任务栏缩略图封面；`image` 为 null 时撤销 iconic 表示，回到系统实时预览。
#[napi(js_name = "setCover")]
pub fn set_cover(handle: napi::bindgen_prelude::Buffer, image: Option<Uint8Array>) -> Result<()> {
    apply_cover(handle.as_ref(), image.as_ref().map(|bytes| bytes.as_ref()))
}

/// 在主窗口的任务栏预览工具栏上挂三个播放按钮。
#[napi(js_name = "setTaskbarButtons")]
pub fn set_taskbar_buttons(
    handle: napi::bindgen_prelude::Buffer,
    playing: bool,
    icons: TaskbarButtonIcons,
    on_action: TaskbarActionTsfn,
) -> Result<()> {
    apply_buttons(handle.as_ref(), playing, &icons, on_action)
}
