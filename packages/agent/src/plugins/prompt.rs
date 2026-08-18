use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use serde_json::Value;
use std::sync::{Arc, Mutex};

#[derive(Clone, Default, Debug)]
pub struct PromptSection {
    /// 段落名
    pub name: String,
    /// 排序号， 越小越靠前
    /// 约定:
    /// - 0 => 人设
    /// - 100-199 => 工具引导
    pub order: i32,
    /// 正文
    pub text: String,
}

#[derive(Clone)]
pub struct PromptRegistry {
    /// 段落列表(未排序)
    sections: Arc<Mutex<Vec<PromptSection>>>,
}
impl PromptRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, section: PromptSection) -> anyhow::Result<Disposer> {
        let name = section.name.clone();

        {
            let mut sections = self
                .sections
                .lock()
                .map_err(|e| anyhow::anyhow!("提示词段落 \"{name}\" 注册失败: {}", e))?;

            if sections.iter().any(|s| s.name == name) {
                anyhow::bail!("提示词段落 \"{name}\" 重复注册");
            }

            sections.push(section);
        }

        let sections = Arc::clone(&self.sections);
        Ok(Box::new(move || {
            sections.lock().unwrap().retain(|s| s.name != name);
        }))
    }

    pub fn sections(&self) -> Vec<String> {
        let mut sections = self.sections.lock().unwrap().clone();
        // 升序排,order小的段落排在前面
        sections.sort_by_key(|s| s.order);
        sections.into_iter().map(|s| s.text).collect()
    }
}
impl Default for PromptRegistry {
    fn default() -> Self {
        Self {
            sections: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

pub struct PromptPlugin;
impl PromptPlugin {
    pub fn name() -> &'static str {
        "prompt"
    }

    pub fn service_name() -> &'static str {
        "prompt_registry"
    }

    fn register_service(ctx: &Arc<Ctx>) -> anyhow::Result<Disposer> {
        Ok(ctx.provide(Self::service_name(), PromptRegistry::new())?)
    }

    pub fn get_service(ctx: &Arc<Ctx>) -> anyhow::Result<Arc<PromptRegistry>> {
        Ok(ctx.get::<PromptRegistry>(Self::service_name())?)
    }
}
impl Plugin for PromptPlugin {
    fn name(&self) -> &'static str {
        Self::name()
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> anyhow::Result<Option<Disposer>> {
        Ok(Some(Self::register_service(ctx)?))
    }
}
