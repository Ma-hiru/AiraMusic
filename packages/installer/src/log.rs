use std::env;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

pub fn init_log() -> anyhow::Result<()> {
    dotenvy::dotenv()?;
    dotenvy::from_filename(env_name())?;

    let level = env::var("APP_LOG_LEVEL").unwrap_or_default();
    let subscriber = FmtSubscriber::builder()
        .with_max_level(parse_level(level))
        .finish();

    tracing::subscriber::set_global_default(subscriber)?;

    Ok(())
}

#[inline(always)]
fn env_name() -> &'static str {
    if cfg!(debug_assertions) {
        ".env.development"
    } else {
        ".env.production"
    }
}

#[inline(always)]
fn parse_level(level: String) -> Level {
    match level.to_uppercase().as_str() {
        "TRACE" => Level::TRACE,
        "DEBUG" => Level::DEBUG,
        "INFO" => Level::INFO,
        "WARN" => Level::WARN,
        "ERROR" => Level::ERROR,
        _ => Level::ERROR,
    }
}
