use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderName};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;

pub struct RequestTool;
#[derive(JsonSchema, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResponseType {
    Json,
    Text,
}
#[derive(JsonSchema, Serialize, Deserialize)]
pub struct RequestToolParameters {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    #[schemars(description = "单位为秒")]
    pub timeout: u64,
    pub format: ResponseType,
}

#[async_trait]
impl Tool for RequestTool {
    fn name(&self) -> &str {
        "request"
    }

    fn description(&self) -> &str {
        "Perform a request."
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(RequestToolParameters).into()
    }

    async fn run(&self, args: Value, _ctx: &ToolRunContext) -> anyhow::Result<Value> {
        let RequestToolParameters {
            url,
            method,
            headers,
            body,
            timeout,
            format,
        } = serde_json::from_value(args)?;

        let mut headers_map = HeaderMap::new();
        for (k, v) in headers.iter() {
            headers_map.insert(HeaderName::from_str(k)?, v.parse()?);
        }
        let res = reqwest::Client::new()
            .request(method.parse()?, url)
            .headers(headers_map)
            .body(body)
            .timeout(Duration::from_secs(timeout))
            .send()
            .await?;

        match format {
            ResponseType::Json => Ok(res.json().await?),
            ResponseType::Text => Ok(serde_json::to_value(res.text().await?)?),
        }
    }
}
