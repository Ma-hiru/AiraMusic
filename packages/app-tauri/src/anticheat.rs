//! 易盾（Watchman）反作弊 token。
//!
//! `playlist/subscribe` 这类接口要求 `X-antiCheatToken`，令牌只能由易盾的
//! 混淆 JS SDK 在真实浏览器环境里生成（依赖 canvas/WebGL 指纹 + rAF），纯 Rust 无解。
//!
//! 实现方式：**直接在主窗口里注入并调用 SDK**。
//! 试过两条隔离路线都不行 —— 独立隐藏窗被 WebKit 节流、sandbox iframe 里
//! SDK 初始化不回调；主窗口是唯一实测能出 token（170 字符）的环境。
//!
//! 暴露面控制：
//! - 只在需要时注入，SDK 实例复用（`window.__airaWatchman`）
//! - 单飞：同一时刻只允许一个取 token 请求
//! - token 由宿主缓存，5 分钟内不重复触发

use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::{AppHandle, Manager};

/// token 有效期保守取 5 分钟（易盾实际更短）
const TTL: Duration = Duration::from_secs(300);
const WAIT: Duration = Duration::from_secs(30);

static APP: OnceLock<AppHandle> = OnceLock::new();
static CACHE: Mutex<Option<(String, Instant)>> = Mutex::new(None);
static PENDING: Mutex<Option<tokio::sync::mpsc::Sender<Option<String>>>> = Mutex::new(None);

/// 注入到主窗口的脚本：按需加载 SDK、复用实例、单飞取 token。
const FETCH_JS: &str = r#"(function(){
  if (window.__airaACBusy) return 'busy';
  window.__airaACBusy = true;

  var PRODUCT = 'YD00000558929251';
  var BUSINESS = 'bd5d2f973ef74cd2a61325a412ae54d9';

  function report(payload) {
    window.__airaACBusy = false;
    try {
      window.__TAURI_INTERNALS__
        .invoke('aira_event', { event: 'event_anticheat_token', payload: payload })
        .catch(function(){});
    } catch (error) { /* 宿主不在时忽略 */ }
  }

  function loadSdk() {
    return new Promise(function(resolve, reject){
      if (typeof window.initWatchman === 'function') return resolve();
      var script = document.createElement('script');
      script.src = 'https://acstatic-dun.126.net/tool.min.js';
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error('sdk load failed')); };
      document.head.appendChild(script);
    });
  }

  function init() {
    return new Promise(function(resolve, reject){
      if (window.__airaWatchman) return resolve(window.__airaWatchman);
      if (typeof window.initWatchman !== 'function') return reject(new Error('no initWatchman'));
      var timer = setTimeout(function(){ reject(new Error('init timeout')); }, 15000);
      window.initWatchman({
        auto: true,
        productNumber: PRODUCT,
        onload: function(instance){ clearTimeout(timer); window.__airaWatchman = instance; resolve(instance); },
        onerror: function(){ clearTimeout(timer); reject(new Error('init failed')); }
      });
    });
  }

  loadSdk()
    .then(init)
    .then(function(instance){
      return new Promise(function(resolve){
        var timer = setTimeout(resolve, 15000);
        instance.getInstance().I(function(){ clearTimeout(timer); resolve(); });
      }).then(function(){
        return new Promise(function(resolve){
          var timer = setTimeout(function(){ resolve(''); }, 15000);
          instance.getToken(BUSINESS, function(token){
            clearTimeout(timer);
            resolve(typeof token === 'string' ? token : '');
          });
        });
      });
    })
    .then(function(token){
      report(token ? { ok: true, token: token } : { ok: false, error: 'empty token' });
    })
    .catch(function(error){
      report({ ok: false, error: String(error) });
    });

  return 'started';
})()"#;

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

fn cached() -> Option<String> {
    let guard = CACHE.lock().ok()?;
    let (token, at) = guard.as_ref()?;
    (at.elapsed() < TTL).then(|| token.clone())
}

/// 供 IPC 调用：主窗口把 token 回传过来
pub fn accept(payload: &Value) {
    let token = payload
        .get("token")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if let Some(token) = &token {
        if let Ok(mut guard) = CACHE.lock() {
            *guard = Some((token.clone(), Instant::now()));
        }
        crate::host_log!("[anticheat] token 已刷新（{} 字符）", token.len());
    } else {
        let error = payload
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        crate::host_err!("[anticheat] 获取失败: {error}");
    }

    if let Ok(mut guard) = PENDING.lock() {
        if let Some(sender) = guard.take() {
            // 回调是同步上下文，不能用异步的 `send`（不 await 的话消息根本不会入队）
            let _ = sender.try_send(token);
        }
    }
}

/// 取一个可用 token；有缓存直接返回，否则在主窗口里注入 SDK 并等待回传。
pub async fn token() -> Option<String> {
    if let Some(token) = cached() {
        return Some(token);
    }

    let app = APP.get()?.clone();
    let window = app.get_webview_window("main")?;

    let (sender, mut receiver) = tokio::sync::mpsc::channel(1);
    if let Ok(mut guard) = PENDING.lock() {
        *guard = Some(sender);
    }

    if let Err(error) = window.eval(FETCH_JS) {
        crate::host_err!("[anticheat] 注入失败: {error}");
        return None;
    }

    match tokio::time::timeout(WAIT, receiver.recv()).await {
        Ok(Some(Some(token))) => Some(token),
        Ok(_) => None,
        Err(_) => {
            crate::host_err!("[anticheat] 等待 token 超时");
            None
        }
    }
}
