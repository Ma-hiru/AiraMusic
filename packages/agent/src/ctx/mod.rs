pub mod models;

use models::*;
use std::any::Any;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct Ctx {
    /// 服务表: 名字 → 实现(擦成 Any 存储)
    services: Arc<Mutex<HashMap<String, Arc<dyn Any + Send + Sync>>>>,
    /// 观察表: 事件名 → 观察者列表(擦成 Any 存储)
    observers: Arc<Mutex<HashMap<String, Box<dyn Any + Send + Sync>>>>,
    /// 否决表: 事件名 → 裁决者列表(擦成 Any 存储)
    voters: Arc<Mutex<HashMap<String, Box<dyn Any + Send + Sync>>>>,
    /// 收据表: 系统退出时倒序销毁(后挂先收)
    receipts: Arc<Mutex<Vec<Disposer>>>,
}

impl Ctx {
    pub fn new() -> Self {
        Self::default()
    }

    // ──────────────────── 服务通道 ─────────────────────

    /// 挂服务
    pub fn provide<T: Any + Send + Sync>(
        &self,
        name: &str,
        service: T,
    ) -> anyhow::Result<Disposer> {
        // 服务要被多个插件共享
        let provided: Arc<dyn Any + Send + Sync> = Arc::new(service);

        {
            let mut services = self
                .services
                .lock()
                .map_err(|e| anyhow::anyhow!("服务 {name} 锁失败: {e}"))?;

            if services.contains_key(name) {
                return Err(anyhow::anyhow!("服务 {name} 已存在"));
            }

            services.insert(name.to_string(), Arc::clone(&provided));
        }

        let name = name.to_string();
        let services = Arc::clone(&self.services);
        Ok(Box::new(move || {
            let mut map = services.lock().unwrap();
            // 删除前比对身份
            let keep = match map.get(&name) {
                None => true,
                Some(current) => !Arc::ptr_eq(&provided, current),
            };
            if !keep {
                map.remove(&name);
            }
        }))
    }

    /// 查服务
    pub fn has(&self, name: &str) -> bool {
        self.services.lock().unwrap().contains_key(name)
    }

    /// 取服务
    pub fn get<T: Any + Send + Sync>(&self, name: &str) -> anyhow::Result<Arc<T>> {
        let services = self
            .services
            .lock()
            .map_err(|e| anyhow::anyhow!("服务 {name} 锁失败: {e}"))?;
        let service = services
            .get(name)
            .cloned() // 克隆一份 Arc, 自己持有,
            .ok_or_else(|| anyhow::anyhow!("服务 {name} 不存在"))?;

        // 类型还原
        service
            .downcast::<T>()
            .map_err(|_| anyhow::anyhow!("服务 {name} 类型错误"))
    }

    // ───────────────────── 观察通道 ─────────────────────

    /// 订阅广播(观察者)
    pub fn on<P: 'static>(&self, event: &str, observer: impl Observer<P> + 'static) -> Disposer {
        let entry: Arc<dyn Observer<P>> = Arc::new(observer);

        {
            let mut observers = self.observers.lock().unwrap();
            let slot = observers
                .entry(event.to_string())
                .or_insert_with(|| Box::new(Observers::<P>(Mutex::new(Vec::new()))));

            // 把擦成 Any 的容器还原成 Observers<P>。
            // 同一事件名被不同载荷类型注册过 = 装配期错误, 直接 panic。
            let list = slot
                .downcast_mut::<Observers<P>>()
                .expect("事件名已被另一载荷类型占用");

            list.0.lock().unwrap().push(Arc::clone(&entry));
        }

        let event = event.to_string();
        let observers = Arc::clone(&self.observers);
        Box::new(move || {
            let mut map = observers.lock().unwrap();
            if let Some(slot) = map.get_mut(&event)
                && let Some(list) = slot.downcast_mut::<Observers<P>>()
            {
                let mut entries = list.0.lock().unwrap();
                // 按指针身份移除(闭包无法按值比较, 只能比身份)。
                entries.retain(|e| !Arc::ptr_eq(e, &entry));
            }
        })
    }

    /// 广播(依次喊醒所有观察者)
    pub fn emit<P: 'static>(&self, event: &str, payload: &P) {
        let snapshot: ObserverList<P> = {
            let map = self.observers.lock().unwrap();
            match map.get(event) {
                Some(slot) => slot
                    .downcast_ref::<Observers<P>>()
                    .expect("事件名与载荷类型不匹配")
                    .0
                    .lock()
                    .unwrap()
                    .clone(),
                None => Vec::new(),
            }
        }; // 表锁释放

        for observer in &snapshot {
            observer(payload);
        }
    }

    /// 订阅广播(裁决者)
    pub fn on_veto<P: 'static, R: 'static>(
        &self,
        event: &str,
        voter: impl Voter<P, R> + 'static,
    ) -> Disposer {
        let entry: Arc<dyn Voter<P, R>> = Arc::new(voter);

        {
            let mut voters = self.voters.lock().unwrap();
            let slot = voters
                .entry(event.to_string())
                .or_insert_with(|| Box::new(Voters::<P, R>(Mutex::new(Vec::new()))));

            let set = slot
                .downcast_mut::<Voters<P, R>>()
                .expect("事件名已被另一载荷类型占用");
            set.0.lock().unwrap().push(Arc::clone(&entry));
        }

        let event = event.to_string();
        let voters = Arc::clone(&self.voters);
        Box::new(move || {
            let mut map = voters.lock().unwrap();
            if let Some(slot) = map.get_mut(&event)
                && let Some(set) = slot.downcast_mut::<Voters<P, R>>()
            {
                let mut list = set.0.lock().unwrap();
                list.retain(|e| !Arc::ptr_eq(e, &entry));
            }
        })
    }

    /// 表决(决裁者顺序表态)
    pub fn veto<P: 'static, R: 'static>(
        &self,
        event: &str,
        payload: &mut P,
        fallback: impl FnOnce(&mut P) -> R,
    ) -> R {
        let snapshot: VoterList<P, R> = {
            let map = self.voters.lock().unwrap();
            match map.get(event) {
                Some(slot) => slot
                    .downcast_ref::<Voters<P, R>>()
                    .expect("事件名与载荷类型不匹配")
                    .0
                    .lock()
                    .unwrap()
                    .clone(),
                None => Vec::new(),
            }
        };

        for voter in &snapshot {
            if let Some(result) = voter(payload) {
                return result; // 被否决: 立刻停, 后面的都不再问
            }
            // None = 放行: 继续问下一个
        }

        fallback(payload) // 全员放行 → 默认行为
    }

    // ───────────────────── 收据通道 ─────────────────────

    /// 把disposer交给系统(退出/卸载时倒序销毁)
    pub fn effect(&self, receipt: Disposer) {
        self.receipts.lock().unwrap().push(receipt);
    }
}
