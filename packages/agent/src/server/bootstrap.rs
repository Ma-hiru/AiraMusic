use crate::constants::{CONTROL_TOKEN_ENV, MCP_TOKEN_ENV, STORE_SECRET_ENV};
use crate::utils::validate_mcp_url;
use std::ffi::OsString;
use std::fmt::{Debug, Formatter};
use std::path::PathBuf;
use tracing::level_filters::LevelFilter;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentLogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    None,
}
impl<T: Into<String>> From<T> for AgentLogLevel {
    fn from(value: T) -> Self {
        match value.into().to_ascii_uppercase().as_str() {
            "TRACE" => Self::Trace,
            "DEBUG" => Self::Debug,
            "INFO" => Self::Info,
            "WARN" => Self::Warn,
            "ERROR" => Self::Error,
            "NONE" => Self::None,
            _ => panic!("--log-level 必须是 TRACE、DEBUG、INFO、WARN、ERROR 或 NONE"),
        }
    }
}
impl From<AgentLogLevel> for LevelFilter {
    fn from(value: AgentLogLevel) -> Self {
        match value {
            AgentLogLevel::Trace => LevelFilter::TRACE,
            AgentLogLevel::Debug => LevelFilter::DEBUG,
            AgentLogLevel::Info => LevelFilter::INFO,
            AgentLogLevel::Warn => LevelFilter::WARN,
            AgentLogLevel::Error => LevelFilter::ERROR,
            AgentLogLevel::None => LevelFilter::OFF,
        }
    }
}

#[derive(Clone)]
pub struct AgentSecrets {
    pub control_token: String,
    pub store_secret: String,
    pub mcp_token: String,
}
impl Debug for AgentSecrets {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AgentSecrets")
            .field("control_token", &"[REDACTED]")
            .field("store_secret", &"[REDACTED]")
            .field("mcp_token", &"[REDACTED]")
            .finish()
    }
}

#[derive(Debug, Clone)]
pub struct AgentBootstrap {
    pub port: u16,
    pub data_dir: PathBuf,
    pub mcp_url: String,
    pub log_level: AgentLogLevel,
    pub secrets: AgentSecrets,
}
impl AgentBootstrap {
    pub fn from_process() -> anyhow::Result<Self> {
        Self::parse(std::env::args_os())
    }

    pub fn parse<I, T>(args: I) -> anyhow::Result<Self>
    where
        I: IntoIterator<Item = T>,
        T: Into<OsString>,
    {
        let mut args = args.into_iter().map(Into::into);
        let _executable = args.next();
        let mut port = None;
        let mut data_dir = None;
        let mut mcp_url = None;
        let mut log_level = None;

        while let Some(argument) = args.next() {
            let argument = argument
                .into_string()
                .map_err(|_| anyhow::anyhow!("启动参数必须是 UTF-8"))?;
            let mut value = || {
                args.next()
                    .ok_or_else(|| anyhow::anyhow!("参数 {argument} 缺少值"))?
                    .into_string()
                    .map_err(|_| anyhow::anyhow!("参数 {argument} 的值必须是 UTF-8"))
            };
            match argument.as_str() {
                "--port" => {
                    port = Some(
                        value()?
                            .parse::<u16>()
                            .map_err(|_| anyhow::anyhow!("port 必须是 0 到 65535 的整数"))?,
                    );
                }
                "--data-dir" => data_dir = Some(PathBuf::from(value()?)),
                "--mcp-url" => mcp_url = Some(validate_mcp_url(value()?)?),
                "--log-level" => log_level = Some(value()?.into()),
                _ => anyhow::bail!("未知 Agent 启动参数: {argument}"),
            }
        }

        let required_secret = move |name: &str| -> anyhow::Result<String> {
            std::env::var(name)
                .ok()
                .filter(|value| !value.is_empty())
                .ok_or_else(|| anyhow::anyhow!("缺少或为空的环境变量 {name}"))
        };
        let secrets = AgentSecrets {
            control_token: required_secret(CONTROL_TOKEN_ENV)?,
            store_secret: required_secret(STORE_SECRET_ENV)?,
            mcp_token: required_secret(MCP_TOKEN_ENV)?,
        };

        Ok(Self {
            port: port.ok_or_else(|| anyhow::anyhow!("缺少 --port"))?,
            data_dir: data_dir.ok_or_else(|| anyhow::anyhow!("缺少 --data-dir"))?,
            mcp_url: mcp_url.ok_or_else(|| anyhow::anyhow!("缺少 --mcp-url"))?,
            log_level: log_level.ok_or_else(|| anyhow::anyhow!("缺少 --log-level"))?,
            secrets,
        })
    }
}
