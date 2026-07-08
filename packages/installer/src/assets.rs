use std::{
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
};

use anyhow::{anyhow, Context, Result};

const LOGO_PNG: &[u8] = include_bytes!("../assets/logo.png");

static ASSETS_DIR: OnceLock<PathBuf> = OnceLock::new();
static LOGO_URI: OnceLock<String> = OnceLock::new();

pub fn assets_prepare() -> Result<()> {
    if LOGO_URI.get().is_some() {
        return Ok(());
    }

    let assets_dir = std::env::temp_dir()
        .join("AiraDeployer")
        .join(env!("CARGO_PKG_VERSION"));

    fs::create_dir_all(&assets_dir).context("failed to create temporary assets directory")?;

    let logo_path = assets_dir.join("logo.png");

    write_if_changed(&logo_path, LOGO_PNG)?;

    let logo_uri = url::Url::from_file_path(&logo_path)
        .map_err(|_| anyhow!("failed to convert logo path to file URI"))?
        .to_string();

    let _ = ASSETS_DIR.set(assets_dir);
    let _ = LOGO_URI.set(logo_uri);

    Ok(())
}

pub fn logo_uri() -> &'static str {
    LOGO_URI
        .get()
        .expect("assets::prepare() must be called before rendering")
}

fn write_if_changed(path: &Path, bytes: &[u8]) -> Result<()> {
    let unchanged = fs::metadata(path)
        .map(|metadata| metadata.len() == bytes.len() as u64)
        .unwrap_or(false);

    if !unchanged {
        fs::write(path, bytes).with_context(|| format!("failed to write {}", path.display()))?;
    }

    Ok(())
}
