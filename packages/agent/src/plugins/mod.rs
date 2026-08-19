//! 十个插件, 三种角色(合同见 plugins/models.rs 的 Plugin trait):
//!
//!   提供者(把能力挂上公告板): session / llm_fake / tools / prompt / session_loader / compact
//!   贡献者(往注册表里塞东西): calculator / persona
//!   监听者(挂广播):           max_turns(否决链) + telemetry(观察)
//!
//! 注意: 循环(loop)一个都不认识 —— 它只认识公告板上的服务名和接口。
//! 加新能力 = 在本目录加一个新文件 + 在 main.rs 清单里加一行, 循环不用动。

// 每个 pub mod 对应一个插件文件。
pub mod calculator; // 贡献者: add 工具
pub mod compact; // 提供者: 上下文压缩(会话日志投影)
pub mod llm_fake; // 提供者: 假模型
pub mod max_turns; // 监听者(否决): 轮数上限
pub mod models;
pub mod persona; // 贡献者: 人设提示词
pub mod prompt;
pub mod session; // 提供者: 会话日志(唯一事实源)
pub mod session_loader; // 提供者: 初始历史
pub mod telemetry;
pub mod tools;
