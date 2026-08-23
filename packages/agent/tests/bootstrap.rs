use agent::server::bootstrap::{AgentBootstrap, AgentLogLevel, AgentSecrets};
use std::collections::HashMap;
use std::path::PathBuf;

#[test]
fn bootstrap_separates_arguments_from_required_secrets() {
    let env = HashMap::from([
        ("AIRA_AGENT_CONTROL_TOKEN", "control-secret"),
        ("AIRA_AGENT_STORE_SECRET", "store-secret"),
        ("AIRA_AGENT_MCP_TOKEN", "mcp-secret"),
    ]);
    let bootstrap = AgentBootstrap::parse(
        [
            "agent",
            "--port",
            "0",
            "--data-dir",
            "D:/agent-data",
            "--mcp-url",
            "http://127.0.0.1:32123/mcp",
            "--log-level",
            "warn",
        ],
        |name| env.get(name).map(|value| value.to_string()),
    )
    .unwrap();

    assert_eq!(bootstrap.port, 0);
    assert_eq!(bootstrap.data_dir, PathBuf::from("D:/agent-data"));
    assert_eq!(bootstrap.mcp_url, "http://127.0.0.1:32123/mcp");
    assert_eq!(bootstrap.log_level, AgentLogLevel::Warn);
    assert_eq!(bootstrap.secrets.control_token(), "control-secret");
    assert_eq!(bootstrap.secrets.store_secret(), "store-secret");
    assert_eq!(bootstrap.secrets.mcp_token(), "mcp-secret");

    let debug = format!("{bootstrap:?}");
    assert!(!debug.contains("control-secret"));
    assert!(!debug.contains("store-secret"));
    assert!(!debug.contains("mcp-secret"));
}

#[test]
fn bootstrap_rejects_an_invalid_log_level() {
    let env = HashMap::from([
        ("AIRA_AGENT_CONTROL_TOKEN", "control-secret"),
        ("AIRA_AGENT_STORE_SECRET", "store-secret"),
        ("AIRA_AGENT_MCP_TOKEN", "mcp-secret"),
    ]);
    let result = AgentBootstrap::parse(
        [
            "agent",
            "--port",
            "0",
            "--data-dir",
            "D:/agent-data",
            "--mcp-url",
            "http://127.0.0.1:32123/mcp",
            "--log-level",
            "verbose",
        ],
        |name| env.get(name).map(|value| value.to_string()),
    );

    assert!(result.unwrap_err().to_string().contains("--log-level"));
}

#[test]
fn bootstrap_rejects_missing_or_empty_secrets() {
    let result = AgentSecrets::read(|name| match name {
        "AIRA_AGENT_CONTROL_TOKEN" => Some("control-secret".to_string()),
        "AIRA_AGENT_STORE_SECRET" => Some(String::new()),
        _ => None,
    });

    let error = result.unwrap_err().to_string();
    assert!(error.contains("AIRA_AGENT_STORE_SECRET"));
    assert!(!error.contains("control-secret"));
}
