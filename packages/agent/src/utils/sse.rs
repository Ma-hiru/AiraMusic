use serde_json::Value;

/// @wiki \
/// SSE（Server-Sent Events）
/// - 基于 UTF-8 的 `text/event-stream` 文本事件流
/// - 流按行解析，行结束符可以是 `\n`、`\r\n` 或 `\r`
/// - 空行表示当前事件结束
/// - 普通行格式为 `field: value`，常见字段：
///     + `event`：事件类型，缺省为 `message`
///     + `data`：事件数据，多行 `data` 以 `\n` 拼接
///     + `id`：事件 ID，用于断线重连
///     + `retry`：重连等待时间
///     + 以 `:` 开头的行为注释并忽略，未知字段也忽略
pub enum LLMSSEDecoder {
    /// - OpenAI 的 `data` 是 JSON
    /// - OpenAI 的`data: [DONE]` 表示流结束
    /// - 这里只做现代化解析，不处理奇怪的换行
    OpenAI {
        /// 尚未组成完整 SSE event 的原始字节
        buffer: Vec<u8>,
        /// 是否已经收到 `[DONE]`
        done: bool,
    },
}

const OPENAI_DONE_EVENT: &[u8] = b"[DONE]";

impl LLMSSEDecoder {
    pub fn open_ai() -> Self {
        Self::OpenAI {
            buffer: Vec::new(),
            done: false,
        }
    }

    pub fn feed(&mut self, chunk: &[u8]) -> anyhow::Result<Vec<Value>> {
        match self {
            Self::OpenAI { buffer, done } => Self::open_ai_feed(buffer, done, chunk),
        }
    }

    pub fn is_done(&self) -> bool {
        match self {
            Self::OpenAI { done, .. } => *done,
        }
    }

    fn open_ai_feed(
        buffer: &mut Vec<u8>,
        done: &mut bool,
        chunk: &[u8],
    ) -> anyhow::Result<Vec<Value>> {
        if *done {
            return Ok(vec![]);
        }

        // 保留原始 bytes，避免 UTF-8 字符跨 chunk 时被 lossy 转换破坏!!
        buffer.extend_from_slice(chunk);

        let mut values = Vec::new();
        // 网络 chunk 和 SSE event 没有对应关系，
        // 因此只处理已经收到完整空行分隔符的 event。
        while let Some((delimiter_start, delimiter_len)) = Self::find_first_event_end(buffer) {
            if let Some(value) = Self::parse_open_ai_event(&buffer[..delimiter_start], done)? {
                values.push(value);
            }
            buffer.drain(..delimiter_start + delimiter_len);
            // parse_open_ai_event  内部会修改 *done
            if *done {
                buffer.clear();
                break;
            }
        }

        Ok(values)
    }

    /// 查找 SSE event 结束位置
    ///
    /// 实际常见格式：
    /// - LF: data: {...}\n\n
    /// - CRLF: data: {...}\r\n\r\n
    fn find_first_event_end(buffer: &[u8]) -> Option<(usize, usize)> {
        let lf = buffer
            .windows(2) // 2 字节窗口
            .position(|w| w == b"\n\n")
            .map(|pos| (pos, 2));
        let crlf = buffer
            .windows(4) // 4 字节窗口
            .position(|w| w == b"\r\n\r\n")
            .map(|pos| (pos, 4));
        match (lf, crlf) {
            // 一般不会出现
            (Some(a), Some(b)) => Some(if a.0 < b.0 { a } else { b }),
            (Some(a), None) => Some(a),
            (None, Some(b)) => Some(b),
            (None, None) => None,
        }
    }

    /// 解析 OpenAI SSE event
    ///
    /// 一般两种情况:
    /// - LF:   data: xxx\n
    /// - CRLF: data: xxx\r\n
    ///
    /// 返回:
    /// - None 整个流结束
    /// - Some(value) event 解析完成
    fn parse_open_ai_event(event_buffer: &[u8], done: &mut bool) -> anyhow::Result<Option<Value>> {
        let mut data = Vec::new();
        let mut empty = true;

        // 统一按 \n 切，再删除 CRLF 遗留的 \r
        for line in event_buffer.split(|&b| b == b'\n') {
            let line = line.strip_suffix(b"\r").unwrap_or(line);

            let value = if line == b"data" {
                // SSE 中没有 ':' 时 value 为空字符串(不能去掉，因为贡献了一个\n)
                b""
            } else if let Some(value) = line.strip_prefix(b"data:") {
                // ':' 后至多删除一个 ASCII 空格：
                // data:x   -> x
                // data: x  -> x
                // data:  x -> " x"
                value.strip_prefix(b" ").unwrap_or(value)
            } else {
                // event / id / retry / comment / 未知字段
                continue;
            };

            // 如果已经有data，说明是多行data,多行value拼接是使用\n拼接
            if !empty {
                data.push(b'\n');
            }

            data.extend_from_slice(value);
            empty = false;
        }

        // 纯 comment / event / retry 等事件
        if empty {
            return Ok(None);
        }

        if data.starts_with(OPENAI_DONE_EVENT) {
            *done = true;
            return Ok(None);
        }

        // 直接从完整 bytes 解析 JSON：
        // UTF-8 即使跨网络 chunk，也不会损坏。
        Ok(Some(serde_json::from_slice(&data)?))
    }
}
