//! 插件清单(角色见各文件头注释):
//!
//!   提供者(把能力挂上公告板):
//!     session / llm_fake(假模型) / llm_openai(真模型) / tools / prompt
//!     / session_loader / context_compactor(截断压缩) / llm_compactor(LLM 压缩)
//!   贡献者(往注册表里塞东西): calculator / persona / history_search
//!   监听者(挂广播):           max_turns(否决链) + telemetry(观察)
//!
//! 注意: 循环(loop)一个都不认识 —— 它只认识公告板上的服务名和接口。

pub mod agui;
pub mod agui_stdout;
pub mod calculator;
pub mod context_compactor;
pub mod history_search;
pub mod max_turns;
pub mod model_router;
pub mod models;
pub mod persona;
pub mod prompt;
pub mod session_loader;
pub mod session_persistence;
pub mod telemetry;
