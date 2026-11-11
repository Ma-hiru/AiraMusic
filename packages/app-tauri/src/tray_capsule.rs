//! macOS 菜单栏歌词胶囊的数据侧：`packages/app/src/lib/tray/darwin.ts` 的移植。
//!
//! Electron 版在**主进程**里监听 `bus_deliver_track_meta` / `bus_deliver_track_progress`，
//! 按当前进度解析出应显示的那一行，再喂给 `@mahiru/native` 绘制。
//! Tauri 版结构相同：`aira_message_send` 转发消息前先旁路观察这两类事件，
//! 解析走 [`crate::menu_lyric`]（`menu-lyric.ts` 的移植），绘制走
//! [`crate::platform_macos::menubar`]。
//!
//! 这里只做「状态机 + 去重」，不碰 AppKit，所以能在任意平台编译和测试。

use std::sync::{Mutex, OnceLock};

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::menu_lyric::{MenuLyricLine, MenuLyricTimeline, MenuLyricWord};

/// 应用名：与 Electron 的 `process.env.APP_NAME` 同源，取不到就用包名兜底
pub fn app_name() -> String {
    std::env::var("APP_NAME")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "AiraMusic".to_string())
}

/// 胶囊设置在主进程的落盘键：仅用于启动瞬间还原，渲染层随后会再同步一次
pub const CAPSULE_CONFIG_KEY: &str = "main.trayCapsule";
/// 默认胶囊宽度（歌词视口，pt）
pub const DEFAULT_WIDTH: f64 = 150.0;

/// 绘制侧回调类型（拆成别名，避免 `Box<dyn Fn...>` 触发 type_complexity）
pub type LyricSink = Box<dyn Fn(&str, &[MenuLyricWord]) + Send + Sync>;
pub type ProgressSink = Box<dyn Fn(f64, bool) + Send + Sync>;
pub type TipSink = Box<dyn Fn(&str) + Send + Sync>;

/// 绘制侧（macOS 上是原生状态栏项；其他平台为空实现）
pub struct Sink {
    pub set_lyric: LyricSink,
    pub set_progress: ProgressSink,
    pub set_tool_tip: TipSink,
}

/// 歌词条的喂数据状态机
pub struct Capsule {
    sink: Sink,
    /// 最近一次 `bus_deliver_track_meta`
    player: Option<Value>,
    /// 最近一次 `bus_deliver_track_progress`
    progress: Option<Value>,
    /// 当前歌词的时间轴（换歌/换歌词时重建，等价 JS 版的 WeakMap 缓存）
    timeline: Option<MenuLyricTimeline>,
    /// 最近一次播放进度（秒），切歌/暂停时用它重算行
    current_time: f64,
    /// 当前已应用的行；None = 尚未应用或已回到空闲标题
    applied: Option<MenuLyricLine>,
    idle_applied: bool,
}

impl Capsule {
    pub fn new(sink: Sink) -> Self {
        Self {
            sink,
            player: None,
            progress: None,
            timeline: None,
            current_time: 0.0,
            applied: None,
            idle_applied: false,
        }
    }

    /// `bus_deliver_track_meta`
    pub fn meta(&mut self, data: &Value) {
        let previous_lyric = self.player.as_ref().and_then(|player| player.get("lyric"));
        let lyric_changed = !json_eq(data.get("lyric"), previous_lyric);
        let current_track = track_id(data);
        let track_changed = current_track != self.player.as_ref().and_then(track_id);
        self.player = Some(data.clone());

        if track_changed {
            let progress_track = self.progress.as_ref().and_then(progress_track_id);
            self.current_time = if progress_track.is_some() && progress_track == current_track {
                self.progress
                    .as_ref()
                    .and_then(|progress| progress.get("currentTime"))
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0)
            } else {
                0.0
            };
        }
        if lyric_changed {
            self.timeline = Some(MenuLyricTimeline::new(data.get("lyric")));
        }

        let name = data
            .get("track")
            .and_then(|track| track.get("name"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let app_name = app_name();
        let tip = if name.is_empty() {
            app_name
        } else {
            format!("{app_name} - {name}")
        };
        (self.sink.set_tool_tip)(&tip);

        // 换歌/歌词重新解析后强制重算当前行
        if lyric_changed || track_changed {
            self.applied = None;
        }
        self.sync_line();
        self.sync_progress();
    }

    /// `bus_deliver_track_progress`
    pub fn progress(&mut self, data: &Value) {
        self.progress = Some(data.clone());
        if progress_track_id(data) != self.player.as_ref().and_then(track_id) {
            return;
        }
        self.current_time = data
            .get("currentTime")
            .and_then(Value::as_f64)
            .unwrap_or(0.0);
        self.sync_line();
        self.sync_progress();
    }

    /// 回到空闲标题（初始化时用）
    pub fn reset(&mut self) {
        self.player = None;
        self.progress = None;
        self.timeline = None;
        self.current_time = 0.0;
        self.applied = None;
        self.idle_applied = false;
        self.apply_idle_title();
    }

    /// 按当前进度重算应显示的行
    fn sync_line(&mut self) {
        let line = {
            let status = self
                .player
                .as_ref()
                .and_then(|player| player.get("status"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if status == "idle" || status == "error" {
                None
            } else {
                self.timeline
                    .as_ref()
                    .and_then(|timeline| timeline.resolve(self.current_time * 1000.0))
            }
        };

        let Some(line) = line else {
            self.apply_idle_title();
            return;
        };
        // progress 高频回调绝不能重开高亮
        if let Some(applied) = self.applied.as_ref() {
            if applied.start_time == line.start_time && applied.text == line.text {
                return;
            }
        }
        self.apply_line(line);
    }

    fn apply_idle_title(&mut self) {
        if self.idle_applied {
            return;
        }
        self.idle_applied = true;
        self.applied = None;
        let name = app_name();
        (self.sink.set_lyric)(&name, &[]);
    }

    fn apply_line(&mut self, line: MenuLyricLine) {
        self.idle_applied = false;
        (self.sink.set_lyric)(&line.text, &line.words);
        self.applied = Some(line);
        // 切行瞬间就对齐进度：暂停状态下也能停在正确位置
        self.sync_progress();
    }

    /// 把播放进度折算到行内，原生据此推进逐字高亮
    fn sync_progress(&self) {
        let Some(line) = self.applied.as_ref() else {
            return;
        };
        let elapsed = (self.current_time * 1000.0 - line.start_time).max(0.0);
        let playing = self
            .player
            .as_ref()
            .and_then(|player| player.get("status"))
            .and_then(Value::as_str)
            == Some("playing");
        (self.sink.set_progress)(elapsed, playing);
    }
}

fn track_id(data: &Value) -> Option<i64> {
    data.get("track")
        .and_then(|track| track.get("id"))
        .and_then(Value::as_i64)
}

fn progress_track_id(data: &Value) -> Option<i64> {
    data.get("trackID").and_then(Value::as_i64)
}

/// 歌词对象深比较：bus 每次换歌都会给新对象，同一首歌内引用不变但内容相同
fn json_eq(left: Option<&Value>, right: Option<&Value>) -> bool {
    match (left, right) {
        (None, None) => true,
        (Some(left), Some(right)) => left == right,
        _ => false,
    }
}

fn slot() -> &'static Mutex<Option<Capsule>> {
    static SLOT: OnceLock<Mutex<Option<Capsule>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

/// 宿主侧入口：安装 macOS 菜单栏胶囊并套用落盘的配置。
pub fn init(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let icon = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("assets/menubar.png")
            .to_string_lossy()
            .to_string();
        let tooltip = app_name();
        crate::platform_macos::menubar::init(app, &icon, &tooltip);

        let mut capsule = Capsule::new(Sink {
            set_lyric: Box::new(|text, words| {
                crate::platform_macos::menubar::set_lyric(text, words);
            }),
            set_progress: Box::new(|elapsed, playing| {
                crate::platform_macos::menubar::set_progress(elapsed, playing);
            }),
            set_tool_tip: Box::new(|text| {
                crate::platform_macos::menubar::set_tool_tip(text);
            }),
        });
        // 启动瞬间先回到空闲标题（菜单栏图标立即可见）
        capsule.reset();
        if let Ok(mut guard) = slot().lock() {
            *guard = Some(capsule);
        }

        apply_values(&read_config(app));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }
}

/// 旁路观察渲染层消息：`bus_deliver_track_meta` / `bus_deliver_track_progress`。
pub fn observe(kind: &str, data: &Value) {
    if kind != "bus_deliver_track_meta" && kind != "bus_deliver_track_progress" {
        return;
    }
    let Ok(mut guard) = slot().lock() else { return };
    let Some(capsule) = guard.as_mut() else {
        return;
    };
    if kind == "bus_deliver_track_meta" {
        capsule.meta(data);
    } else {
        capsule.progress(data);
    }
}

/// 渲染层下发的胶囊配置（`event_tray_capsule`）：
/// 宽度是歌词视口宽度，胶囊总宽随之变化；同时落盘供下次启动还原。
pub fn apply_config(app: &AppHandle, config: &Value) {
    let enabled = config
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let width = config
        .get("width")
        .and_then(Value::as_f64)
        .unwrap_or(DEFAULT_WIDTH);
    let normalized = serde_json::json!({ "enabled": enabled, "width": width });
    let _ = app
        .state::<crate::state::AppState>()
        .kv
        .set(CAPSULE_CONFIG_KEY.to_string(), normalized.clone());
    apply_values(&normalized);
}

fn read_config(app: &AppHandle) -> Value {
    let stored = app
        .state::<crate::state::AppState>()
        .kv
        .get(CAPSULE_CONFIG_KEY);
    match stored {
        Some(value)
            if value.get("enabled").and_then(Value::as_bool).is_some()
                && value.get("width").and_then(Value::as_f64).is_some() =>
        {
            value
        }
        _ => serde_json::json!({ "enabled": true, "width": DEFAULT_WIDTH }),
    }
}

fn apply_values(config: &Value) {
    #[cfg(target_os = "macos")]
    {
        let enabled = config
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        let width = config
            .get("width")
            .and_then(Value::as_f64)
            .unwrap_or(DEFAULT_WIDTH);
        crate::platform_macos::menubar::set_width(width);
        crate::platform_macos::menubar::set_visible(enabled);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = config;
}

/// 播放状态快照：给托盘菜单决定「播放 / 暂停」文案与禁用态
#[derive(Clone, Copy, Default)]
pub struct PlayerState {
    pub playing: bool,
    pub has_track: bool,
}

/// 最近一次 meta 里的播放状态（未收到过 meta 时返回默认值）
pub fn player_state() -> PlayerState {
    let Ok(guard) = slot().lock() else {
        return PlayerState::default();
    };
    let Some(capsule) = guard.as_ref() else {
        return PlayerState::default();
    };
    let playing = capsule
        .player
        .as_ref()
        .and_then(|player| player.get("status"))
        .and_then(Value::as_str)
        == Some("playing");
    PlayerState {
        playing,
        has_track: track_id(capsule.player.as_ref().unwrap_or(&Value::Null)).is_some(),
    }
}

/// 胶囊现状（`/__diag` 自检用）
pub fn snapshot() -> Value {
    snapshot_impl()
}

#[cfg(target_os = "macos")]
fn snapshot_impl() -> Value {
    let native = crate::platform_macos::menubar::snapshot();
    let state = slot()
        .lock()
        .ok()
        .and_then(|guard| {
            guard.as_ref().map(|capsule| {
                serde_json::json!({
                    "applied": capsule.applied.as_ref().map(|line| serde_json::json!({
                        "text": line.text,
                        "startTime": line.start_time,
                        "words": line.words.len(),
                    })),
                    "currentTime": capsule.current_time,
                    "hasMeta": capsule.player.is_some(),
                    "hasProgress": capsule.progress.is_some(),
                    "idleApplied": capsule.idle_applied,
                })
            })
        })
        .unwrap_or(Value::Null);
    serde_json::json!({ "native": native, "state": state })
}

#[cfg(not(target_os = "macos"))]
fn snapshot_impl() -> Value {
    Value::Null
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    #[derive(Default)]
    struct Recorded {
        lyrics: Vec<(String, Vec<MenuLyricWord>)>,
        progress: Vec<(f64, bool)>,
        tips: Vec<String>,
    }

    fn capsule() -> (Capsule, Arc<Mutex<Recorded>>) {
        let recorded = Arc::new(Mutex::new(Recorded::default()));
        let sink_lyric = recorded.clone();
        let sink_progress = recorded.clone();
        let sink_tip = recorded.clone();
        let capsule = Capsule::new(Sink {
            set_lyric: Box::new(move |text, words| {
                sink_lyric
                    .lock()
                    .unwrap()
                    .lyrics
                    .push((text.to_string(), words.to_vec()));
            }),
            set_progress: Box::new(move |elapsed, playing| {
                sink_progress
                    .lock()
                    .unwrap()
                    .progress
                    .push((elapsed, playing));
            }),
            set_tool_tip: Box::new(move |text| {
                sink_tip.lock().unwrap().tips.push(text.to_string());
            }),
        });
        (capsule, recorded)
    }

    fn word(text: &str, start: f64, end: f64) -> Value {
        json!({ "word": text, "startTime": start, "endTime": end })
    }

    fn line(start: f64, end: f64, words: Vec<Value>) -> Value {
        json!({
            "startTime": start,
            "endTime": end,
            "words": words,
            "translatedLyric": "",
            "romanLyric": "",
        })
    }

    fn meta(id: i64, status: &str, lines: Vec<Value>) -> Value {
        json!({
            "status": status,
            "track": { "id": id, "name": format!("歌 {id}") },
            "lyric": { "data": lines },
        })
    }

    fn progress(id: i64, seconds: f64) -> Value {
        json!({ "trackID": id, "currentTime": seconds, "duration": 200.0 })
    }

    #[test]
    fn meta_without_lyric_shows_app_name() {
        let (mut capsule, recorded) = capsule();
        capsule.meta(&json!({ "status": "idle", "track": null, "lyric": null }));

        let recorded = recorded.lock().unwrap();
        assert_eq!(recorded.lyrics.len(), 1);
        assert_eq!(recorded.lyrics[0].0, app_name());
        assert!(recorded.lyrics[0].1.is_empty());
        assert_eq!(recorded.tips.last().map(String::as_str), Some(&*app_name()));
    }

    #[test]
    fn progress_selects_line_and_reports_elapsed() {
        let (mut capsule, recorded) = capsule();
        let data = meta(
            1,
            "playing",
            vec![
                line(10_000.0, 13_000.0, vec![word("沿着", 10_000.0, 10_800.0)]),
                line(13_000.0, 16_000.0, vec![word("城市", 13_000.0, 16_000.0)]),
            ],
        );
        capsule.meta(&data);
        capsule.progress(&progress(1, 13.5));

        let recorded = recorded.lock().unwrap();
        let (text, words) = recorded.lyrics.last().unwrap();
        assert_eq!(text, "城市");
        assert_eq!(words.len(), 1);
        // 行内进度 = 13.5s - 13s = 500ms
        let (elapsed, playing) = *recorded.progress.last().unwrap();
        assert!((elapsed - 500.0).abs() < 1e-9);
        assert!(playing);
        let expected = format!("{} - 歌 1", app_name());
        assert_eq!(
            recorded.tips.last().map(String::as_str),
            Some(expected.as_str())
        );
    }

    #[test]
    fn same_line_is_not_reapplied() {
        let (mut capsule, recorded) = capsule();
        capsule.meta(&meta(
            1,
            "playing",
            vec![line(0.0, 10_000.0, vec![word("整行", 0.0, 10_000.0)])],
        ));
        let applied = recorded.lock().unwrap().lyrics.len();
        capsule.progress(&progress(1, 1.0));
        capsule.progress(&progress(1, 2.0));
        // 始终同一行：只推过一次歌词，但进度每次都要下发
        assert_eq!(recorded.lock().unwrap().lyrics.len(), applied);
        assert!(recorded.lock().unwrap().progress.len() >= 3);
    }

    #[test]
    fn progress_from_other_track_is_ignored() {
        let (mut capsule, recorded) = capsule();
        capsule.meta(&meta(
            1,
            "playing",
            vec![line(0.0, 10_000.0, vec![word("甲", 0.0, 10_000.0)])],
        ));
        let before = recorded.lock().unwrap().progress.len();
        capsule.progress(&progress(2, 5.0));
        assert_eq!(recorded.lock().unwrap().progress.len(), before);
    }

    #[test]
    fn switching_track_resets_to_idle_when_lyric_missing() {
        let (mut capsule, recorded) = capsule();
        capsule.meta(&meta(
            1,
            "playing",
            vec![line(0.0, 10_000.0, vec![word("甲", 0.0, 10_000.0)])],
        ));
        capsule.progress(&progress(1, 1.0));
        capsule.meta(
            &json!({ "status": "loading", "track": { "id": 2, "name": "乙" }, "lyric": null }),
        );

        let recorded = recorded.lock().unwrap();
        assert_eq!(recorded.lyrics.last().unwrap().0, app_name());
        assert!(recorded.lyrics.last().unwrap().1.is_empty());
    }

    #[test]
    fn idle_status_falls_back_to_app_name_once() {
        let (mut capsule, recorded) = capsule();
        let data = meta(
            1,
            "paused",
            vec![line(0.0, 10_000.0, vec![word("甲", 0.0, 10_000.0)])],
        );
        capsule.meta(&data);
        let count = recorded.lock().unwrap().lyrics.len();

        // status 变 idle：回到空闲标题
        let mut idle = data.clone();
        idle["status"] = json!("idle");
        capsule.meta(&idle);
        assert_eq!(recorded.lock().unwrap().lyrics.len(), count + 1);

        // 再 idle 一次不重复推
        capsule.meta(&idle);
        assert_eq!(recorded.lock().unwrap().lyrics.len(), count + 1);
    }

    #[test]
    fn new_track_picks_up_progress_of_same_track() {
        let (mut capsule, recorded) = capsule();
        // 先进度后 meta（重连场景）：同 trackID 的进度应被用来定位行
        capsule.progress(&progress(7, 13.5));
        capsule.meta(&meta(
            7,
            "playing",
            vec![line(
                13_000.0,
                16_000.0,
                vec![word("城市", 13_000.0, 16_000.0)],
            )],
        ));

        let recorded = recorded.lock().unwrap();
        assert_eq!(recorded.lyrics.last().unwrap().0, "城市");
    }

    #[test]
    fn reset_returns_to_idle_title() {
        let (mut capsule, recorded) = capsule();
        capsule.meta(&meta(
            1,
            "playing",
            vec![line(0.0, 10_000.0, vec![word("甲", 0.0, 10_000.0)])],
        ));
        capsule.reset();
        assert_eq!(
            recorded.lock().unwrap().lyrics.last().unwrap().0,
            app_name()
        );

        // reset 之后进度不再影响歌词条
        let count = recorded.lock().unwrap().lyrics.len();
        capsule.progress(&progress(1, 5.0));
        assert_eq!(recorded.lock().unwrap().lyrics.len(), count);
    }

    #[test]
    fn tooltip_stays_app_name_without_track() {
        let (mut capsule, recorded) = capsule();
        capsule.meta(&json!({ "status": "idle", "track": null, "lyric": null }));
        assert_eq!(recorded.lock().unwrap().tips.last().unwrap(), &app_name());
    }
}
