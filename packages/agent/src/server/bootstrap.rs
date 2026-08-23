use std::ffi::OsString;
use std::fmt::{Debug, Formatter};
use std::path::PathBuf;
use tracing::level_filters::LevelFilter;

pub const CONTROL_TOKEN_ENV: &str = "AIRA_AGENT_CONTROL_TOKEN";
pub const STORE_SECRET_ENV: &str = "AIRA_AGENT_STORE_SECRET";
pub const MCP_TOKEN_ENV: &str = "AIRA_AGENT_MCP_TOKEN";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentLogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    None,
}

impl AgentLogLevel {
    fn parse(value: String) -> anyhow::Result<Self> {
        match value.to_ascii_uppercase().as_str() {
            "TRACE" => Ok(Self::Trace),
            "DEBUG" => Ok(Self::Debug),
            "INFO" => Ok(Self::Info),
            "WARN" => Ok(Self::Warn),
            "ERROR" => Ok(Self::Error),
            "NONE" => Ok(Self::None),
            _ => anyhow::bail!("--log-level 必须是 TRACE、DEBUG、INFO、WARN、ERROR 或 NONE"),
        }
    }

    pub fn as_level_filter(self) -> LevelFilter {
        match self {
            Self::Trace => LevelFilter::TRACE,
            Self::Debug => LevelFilter::DEBUG,
            Self::Info => LevelFilter::INFO,
            Self::Warn => LevelFilter::WARN,
            Self::Error => LevelFilter::ERROR,
            Self::None => LevelFilter::OFF,
        }
    }
}

pub struct AgentSecrets {
    control_token: String,
    store_secret: String,
    mcp_token: String,
}

impl AgentSecrets {
    pub fn read(mut read_env: impl FnMut(&str) -> Option<String>) -> anyhow::Result<Self> {
        Ok(Self {
            control_token: required_secret(CONTROL_TOKEN_ENV, &mut read_env)?,
            store_secret: required_secret(STORE_SECRET_ENV, &mut read_env)?,
            mcp_token: required_secret(MCP_TOKEN_ENV, &mut read_env)?,
        })
    }

    pub fn control_token(&self) -> &str {
        &self.control_token
    }

    pub fn store_secret(&self) -> &str {
        &self.store_secret
    }

    pub fn mcp_token(&self) -> &str {
        &self.mcp_token
    }
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

#[derive(Debug)]
pub struct AgentBootstrap {
    pub port: u16,
    pub data_dir: PathBuf,
    pub mcp_url: String,
    pub log_level: AgentLogLevel,
    pub secrets: AgentSecrets,
}

impl AgentBootstrap {
    pub fn from_process() -> anyhow::Result<Self> {
        Self::parse(std::env::args_os(), |name| std::env::var(name).ok())
    }

    pub fn parse<I, T>(
        args: I,
        read_env: impl FnMut(&str) -> Option<String>,
    ) -> anyhow::Result<Self>
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
                .map_err(|_| anyhow::anyhow!("Agent 启动参数必须是 UTF-8"))?;
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
                            .map_err(|_| anyhow::anyhow!("--port 必须是 0 到 65535 的整数"))?,
                    );
                }
                "--data-dir" => data_dir = Some(PathBuf::from(value()?)),
                "--mcp-url" => mcp_url = Some(validate_mcp_url(value()?)?),
                "--log-level" => log_level = Some(AgentLogLevel::parse(value()?)?),
                _ => anyhow::bail!("未知 Agent 启动参数: {argument}"),
            }
        }

        Ok(Self {
            port: port.ok_or_else(|| anyhow::anyhow!("缺少 --port"))?,
            data_dir: data_dir.ok_or_else(|| anyhow::anyhow!("缺少 --data-dir"))?,
            mcp_url: mcp_url.ok_or_else(|| anyhow::anyhow!("缺少 --mcp-url"))?,
            log_level: log_level.ok_or_else(|| anyhow::anyhow!("缺少 --log-level"))?,
            secrets: AgentSecrets::read(read_env)?,
        })
    }
}

fn required_secret(
    name: &str,
    read_env: &mut impl FnMut(&str) -> Option<String>,
) -> anyhow::Result<String> {
    read_env(name)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow::anyhow!("缺少或为空的环境变量 {name}"))
}

fn validate_mcp_url(value: String) -> anyhow::Result<String> {
    let url = reqwest::Url::parse(&value).map_err(|_| anyhow::anyhow!("--mcp-url 不是有效 URL"))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        anyhow::bail!("--mcp-url 只支持 HTTP(S)");
    }
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1"));
    if !loopback {
        anyhow::bail!("--mcp-url 必须指向回环地址");
    }
    Ok(value)
}
