use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};

// 将 Value 安全的转换为字符串
pub fn stringify(value: &Value) -> String {
    if value.is_string() {
        return value.as_str().unwrap_or_default().to_string();
    }
    serde_json::to_string(value).unwrap_or_else(|_| String::from("<unprintable>"))
}

// 生成 id
pub fn generate_id(prefix: &str) -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);

    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    format!("{prefix}-{millis:x}-{count}")
}

pub fn secret_key(key: String) -> String {
    if key.is_empty() {
        return key;
    }
    if key.len() > 10 {
        format!("{}***", &key[..4])
    } else {
        format!("{}***", &key[..2])
    }
}

/// 工具名白名单清洗: 只保留 [a-zA-Z0-9_-], 其余替换成 _
pub fn sanitize_tool_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// 增量 SSE 解码器: 喂字节, 产出完整的 JSON 事件。
/// 处理跨 chunk 的半截事件、CRLF 换行、[DONE] 结束标记;
/// 心跳/注释等非 JSON 事件被丢弃。
pub struct LLMSSEDecoder {
    buffer: String,
}
impl Default for LLMSSEDecoder {
    fn default() -> Self {
        Self::new()
    }
}
impl LLMSSEDecoder {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }

    /// 喂一段字节; 返回这段字节里能完整解析出的所有 JSON 事件。
    /// 没拆完的事件留在内部缓冲, 等下一段字节继续。
    ///
    /// SSE(Server-Sent Events)协议:
    ///   事件以空行分隔, 一个事件由若干"字段行"组成:
    ///     data: <负载>    实际数据(一个事件可有多条 data 行)
    ///     event: <类型>   自定义事件名(本解码器不关心, 忽略)
    ///     id: <id>        事件 id(忽略)
    ///     retry: <毫秒>   客户端重连间隔(忽略)
    ///     : <注释>        以冒号开头的是注释/心跳, 必须忽略
    ///   语义要点:
    ///     - 行结束可以是 \n 或 \r\n(先归一化)
    ///     - 多条 data: 行要按顺序用 \n 连接成一个负载
    ///     - data: 后紧跟一个空格时, 这个空格要剥掉
    ///   OpenAI 系流式接口的约定: 负载是 JSON 字符串; 流结束时发 data: [DONE]
    pub fn feed(&mut self, chunk: &[u8]) -> Vec<Value> {
        // 行结束统一成 \n, 后面才能用空行(\n\n)可靠切事件
        self.buffer
            .push_str(&String::from_utf8_lossy(chunk).replace("\r\n", "\n"));

        let mut events = Vec::new();
        // 按空行切出完整事件; 没有空行 = 事件还没到齐, 留在 buffer 等下一段
        while let Some(pos) = self.buffer.find("\n\n") {
            let event = self.buffer[..pos].to_string();
            self.buffer.drain(..pos + 2);
            // 只收集 data: 字段(event/id/retry/注释一律忽略);
            // data: 后紧跟的空格是协议允许的格式, 剥掉
            let data: Vec<&str> = event
                .lines()
                .filter_map(|l| {
                    l.strip_prefix("data:")
                        .map(|d| d.strip_prefix(' ').unwrap_or(d))
                })
                .collect();
            // 没有 data 行的事件 = 纯注释/心跳, 丢弃
            if data.is_empty() {
                continue;
            }
            // 多条 data: 行按协议用 \n 连接成一个负载
            let data = data.join("\n");
            // OpenAI 系流结束标记(不是 JSON, 丢弃)
            if data == "[DONE]" {
                continue;
            }
            if let Ok(value) = serde_json::from_str(&data) {
                events.push(value); // 负载不是 JSON 的(心跳等)直接丢弃
            }
        }
        events
    }
}
