use crate::boot::BootRow;
use crate::ctx::Ctx;
use crate::ctx::models::{Disposer, DisposerLike};
use std::any::Any;
use std::sync::Arc;

/// 插件
pub trait Plugin<Config: Any + Send + 'static, Service: Any + Send + Sync>:
    Send + Sync + PluginMeta<Service>
{
    fn name(&self) -> &'static str {
        <Self as PluginMeta<Service>>::name()
    }

    /// 依赖的服务名列表。
    ///
    /// 装配器会等这些服务全部就绪才调用 apply
    /// 永远等不到的插件会让装配直接报错(见 boot.rs)
    /// 装载顺序由此推导: 谁依赖谁, 谁就先启动, 不用手写顺序
    /// 默认返回空列表 = 无依赖
    fn inject(&self) -> Vec<&'static str> {
        vec![]
    }

    /// 应用插件
    /// 返回 None 表示插件不需要注册服务/监听器
    /// 返回 Some(Service, Vec<Disposer>) 表示插件需要注册服务/处理监听器Disposer
    fn apply(&self, ctx: &Arc<Ctx>, config: Config) -> anyhow::Result<PluginApplyResult<Service>>;

    fn boot(&self, ctx: &Arc<Ctx>, config: Config) -> anyhow::Result<BootRow> {
        let PluginApplyResult {
            service,
            emit_disposers,
        } = self.apply(ctx, config)?;

        let mut disposers: Vec<Disposer> = vec![];
        if let Some(service) = service {
            disposers.push(Self::register_service(ctx, service)?);
        }
        if let Some(emit_disposers) = emit_disposers {
            disposers.extend(emit_disposers);
        }

        Ok(BootRow {
            id: self.name(),
            depends: self.inject(),
            disposer: disposers.to_option_disposer(),
        })
    }
}

pub trait PluginMeta<Service: Any + Send + Sync> {
    fn name() -> &'static str;

    fn service_name() -> &'static str {
        Self::name()
    }

    fn get_service(ctx: &Arc<Ctx>) -> anyhow::Result<Arc<Service>> {
        ctx.get::<Service>(Self::service_name())
    }

    fn register_service(ctx: &Arc<Ctx>, service: Service) -> anyhow::Result<Disposer> {
        ctx.provide(Self::service_name(), service)
    }
}

pub struct PluginApplyResult<Service: Any + Send + Sync> {
    pub service: Option<Service>,
    pub emit_disposers: Option<Vec<Disposer>>,
}
