use async_trait::async_trait;

#[async_trait]
pub trait Store: Send + Sync {
    fn name(&self) -> &str;
    async fn get(&self, key: &str) -> anyhow::Result<Option<String>>;
    async fn set(&self, key: &str, value: String) -> anyhow::Result<bool>;
    async fn delete(&self, key: &str) -> anyhow::Result<bool>;
    async fn take(&self, key: &str) -> anyhow::Result<Option<String>> {
        let value = self.get(key.as_ref()).await?;
        if value.is_some() {
            self.delete(key.as_ref()).await?;
        }
        Ok(value)
    }
}
