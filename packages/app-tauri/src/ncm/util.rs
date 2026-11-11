//! 1:1 复刻上游 `util/index.js` 的工具函数。
//!
//! 这里的每个函数都对应 JS 里的一个实现，注释标出源码位置；
//! 行为（包括那些看起来"有点怪"的细节）都刻意保持一致，
//! 因为上游服务端会按这些细节做风控判断。

use indexmap::IndexMap;
use serde_json::Value;

use crate::ncm::config::now_ms;

/// 有序的 cookie 表（JS 对象的键按插入顺序排列）
pub type Cookies = IndexMap<String, String>;

/// `toBoolean(val)`
///
/// ```js
/// if (typeof val === 'boolean') return val
/// if (val === '') return val
/// return val === 'true' || val == '1'
/// ```
pub fn to_boolean(value: &Value) -> bool {
    match value {
        Value::Bool(value) => *value,
        Value::String(text) => text == "true" || text == "1",
        Value::Number(number) => number.as_f64() == Some(1.0),
        _ => false,
    }
}

/// `cookieToJson(cookie)`
///
/// 注意：上游用 `item.split('=')` 并要求恰好两段，
/// 因此值里带 `=` 的项会被整个丢掉（保持同样行为）。
pub fn cookie_to_json(cookie: &str) -> Cookies {
    let mut result = Cookies::new();
    if cookie.is_empty() {
        return result;
    }
    for item in cookie.split(';') {
        let parts: Vec<&str> = item.split('=').collect();
        if parts.len() == 2 {
            result.insert(parts[0].trim().to_string(), parts[1].trim().to_string());
        }
    }
    result
}

/// `cookieObjToString(cookie)`：键和值都过一遍 `encodeURIComponent`
pub fn cookie_obj_to_string(cookie: &Cookies) -> String {
    cookie
        .iter()
        .map(|(key, value)| {
            format!(
                "{}={}",
                encode_uri_component(key),
                encode_uri_component(value)
            )
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// `encodeURIComponent`
///
/// 保留 `A-Za-z0-9 - _ . ! ~ * ' ( )`，其余按 UTF-8 百分号编码。
pub fn encode_uri_component(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.as_bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => out.push(*byte as char),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// `safe-decode-uri-component`：非法转义原样保留，非法 UTF-8 用替换字符
pub fn safe_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte == b'%' && index + 2 < bytes.len() {
            let pair = &text[index + 1..index + 3];
            if let Ok(value) = u8::from_str_radix(pair, 16) {
                out.push(value);
                index += 3;
                continue;
            }
        }
        out.push(byte);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// `generateDeviceId()`：52 位大写 hex
pub fn generate_device_id() -> String {
    const HEX: &[u8] = b"0123456789ABCDEF";
    (0..52)
        .map(|_| HEX[rand::random_range(0..HEX.len())] as char)
        .collect()
}

/// `getRandom(num)`
///
/// ```js
/// const randomValue = Math.random()
/// const floorValue = Math.floor(randomValue * 9 + 1)
/// const powValue = Math.pow(10, num - 1)
/// return Math.floor((randomValue + floorValue) * powValue)
/// ```
#[allow(dead_code)] // 复刻保留：`generateRandomChineseIP` 的兜底分支用到
pub fn get_random(num: u32) -> u64 {
    let random_value = rand::random::<f64>();
    let floor_value = (random_value * 9.0 + 1.0).floor();
    let pow_value = 10f64.powi(num as i32 - 1);
    ((random_value + floor_value) * pow_value).floor() as u64
}

/// `Math.round(Math.random() * 61)`：注意 `round` 可能取到 61
pub fn random_base62_index() -> usize {
    (rand::random::<f64>() * 61.0).round() as usize
}

fn ip_to_int(ip: &str) -> Option<u32> {
    let parts: Vec<u32> = ip
        .split('.')
        .map(|part| part.trim().parse::<u32>().unwrap_or(0))
        .collect();
    if parts.len() != 4 {
        return None;
    }
    Some((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3])
}

pub fn int_to_ip(value: u32) -> String {
    format!(
        "{}.{}.{}.{}",
        (value >> 24) & 0xff,
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff
    )
}

fn parse_cidr(cidr: &str) -> Option<(u32, u32)> {
    let (ip, prefix) = cidr.split_once('/')?;
    let prefix: u32 = prefix.trim().parse().ok()?;
    let ip = ip_to_int(ip)?;
    let mask = if prefix == 0 {
        0
    } else {
        u32::MAX << (32 - prefix)
    };
    let start = ip & mask;
    let end = start | !mask;
    Some((start, end))
}

/// `data/china_ip_ranges.txt` 的中国 IP 段，按权重随机
fn china_ip_ranges() -> &'static Vec<(u32, u32)> {
    static RANGES: std::sync::OnceLock<Vec<(u32, u32)>> = std::sync::OnceLock::new();
    RANGES.get_or_init(|| {
        include_str!("../../assets/china_ip_ranges.txt")
            .lines()
            .filter_map(|line| {
                let line = line.trim_start_matches('\u{feff}').trim();
                if line.is_empty() || line.starts_with('#') {
                    return None;
                }
                parse_cidr(line)
            })
            .collect()
    })
}

/// `generateRandomChineseIP()`：按 IP 段容量加权抽取
pub fn generate_random_chinese_ip() -> String {
    let ranges = china_ip_ranges();
    let total: u64 = ranges
        .iter()
        .map(|(start, end)| (*end as u64) - (*start as u64) + 1)
        .sum();
    if total == 0 || ranges.is_empty() {
        return format!(
            "116.{}.{}.{}",
            rand::random_range(1..=255),
            rand::random_range(1..=255),
            rand::random_range(1..=255)
        );
    }

    let mut offset = (rand::random::<f64>() * total as f64).floor() as u64;
    let mut chosen = *ranges.last().expect("ranges");
    for &(start, end) in ranges {
        let count = (end as u64) - (start as u64) + 1;
        if offset < count {
            chosen = (start, end);
            break;
        }
        offset -= count;
    }

    let size = (chosen.1 as u64) - (chosen.0 as u64) + 1;
    let pick = chosen.0 as u64 + (rand::random::<f64>() * size as f64).floor() as u64;
    int_to_ip(pick as u32)
}

/// `generateChainId(cookie)`（登录风控用，保留实现以便复刻登录链路）
#[allow(dead_code)] // 复刻保留：登录风控字段，当前渲染层未使用
pub fn generate_chain_id(cookie: &Cookies) -> String {
    let random_num = rand::random_range(0..1_000_000);
    let device_id = cookie
        .get("sDeviceId")
        .cloned()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("unknown-{random_num}"));
    format!("v1_{device_id}_web_login_{}", now_ms())
}

/// `String(value)` 的近似实现：JS 的 URLSearchParams 会把对象拍成 `[object Object]`
pub fn js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(number) => js_number(number),
        Value::String(text) => text.clone(),
        Value::Array(items) => items.iter().map(js_string).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".to_string(),
    }
}

fn js_number(number: &serde_json::Number) -> String {
    if let Some(value) = number.as_i64() {
        return value.to_string();
    }
    if let Some(value) = number.as_u64() {
        return value.to_string();
    }
    let value = number.as_f64().unwrap_or_default();
    if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{value:.0}")
    } else {
        value.to_string()
    }
}

/// `new URLSearchParams(object).toString()`
pub fn url_search_params(object: &serde_json::Map<String, Value>) -> String {
    let mut serializer = url::form_urlencoded::Serializer::new(String::new());
    for (key, value) in object {
        serializer.append_pair(key, &js_string(value));
    }
    serializer.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn to_boolean_matches_js() {
        assert!(to_boolean(&json!(true)));
        assert!(!to_boolean(&json!(false)));
        assert!(to_boolean(&json!("true")));
        assert!(to_boolean(&json!("1")));
        assert!(!to_boolean(&json!("")));
        assert!(!to_boolean(&json!("0")));
        assert!(!to_boolean(&json!("false")));
        assert!(to_boolean(&json!(1)));
        assert!(!to_boolean(&json!(2)));
        assert!(!to_boolean(&json!(null)));
        assert!(!to_boolean(&json!({})));
    }

    #[test]
    fn cookie_to_json_requires_exactly_one_equals() {
        let parsed = cookie_to_json("a=1; b=2; c=x=y; broken");
        assert_eq!(parsed.get("a").map(String::as_str), Some("1"));
        assert_eq!(parsed.get("b").map(String::as_str), Some("2"));
        assert!(!parsed.contains_key("c"), "值里带 = 的项必须整条丢弃");
        assert_eq!(parsed.len(), 2);
    }

    #[test]
    fn cookie_to_json_preserves_order_and_trims() {
        let parsed = cookie_to_json("  z = 9 ; a=1");
        assert_eq!(parsed.keys().collect::<Vec<_>>(), vec!["z", "a"]);
        assert_eq!(parsed.get("z").map(String::as_str), Some("9"));
    }

    #[test]
    fn cookie_obj_to_string_percent_encodes_both_sides() {
        let mut cookie = Cookies::new();
        cookie.insert("MUSIC_U".into(), "a+b/c=".into());
        cookie.insert("k ey".into(), "v".into());
        assert_eq!(
            cookie_obj_to_string(&cookie),
            "MUSIC_U=a%2Bb%2Fc%3D; k%20ey=v"
        );
    }

    #[test]
    fn encode_uri_component_keeps_js_unreserved_set() {
        assert_eq!(encode_uri_component("aA0-_.!~*'()"), "aA0-_.!~*'()");
        assert_eq!(encode_uri_component("中文"), "%E4%B8%AD%E6%96%87");
        assert_eq!(encode_uri_component("&=?/"), "%26%3D%3F%2F");
    }

    #[test]
    fn safe_decode_keeps_invalid_escapes() {
        assert_eq!(safe_decode("%E4%B8%AD"), "中");
        assert_eq!(safe_decode("100%"), "100%");
        assert_eq!(safe_decode("%zz"), "%zz");
        assert_eq!(safe_decode("a+b"), "a+b");
    }

    #[test]
    fn device_id_is_52_upper_hex() {
        let id = generate_device_id();
        assert_eq!(id.len(), 52);
        assert!(id
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_lowercase()));
    }

    #[test]
    fn get_random_stays_in_expected_band() {
        for _ in 0..200 {
            let value = get_random(9);
            assert!((100_000_000..1_000_000_000).contains(&value), "{value}");
        }
    }

    #[test]
    fn chinese_ip_is_inside_loaded_ranges() {
        let ranges = china_ip_ranges();
        assert!(ranges.len() > 1000, "IP 段表应已加载");
        for _ in 0..50 {
            let ip = generate_random_chinese_ip();
            let value = ip_to_int(&ip).expect("ip");
            assert!(
                ranges
                    .iter()
                    .any(|(start, end)| value >= *start && value <= *end),
                "{ip} 不在任何已登记的网段内"
            );
        }
    }

    #[test]
    fn cidr_parsing_matches_js() {
        assert_eq!(parse_cidr("1.1.8.0/24"), Some((0x0101_0800, 0x0101_08ff)));
        assert_eq!(parse_cidr("0.0.0.0/0"), Some((0, u32::MAX)));
        assert_eq!(parse_cidr("bad"), None);
    }

    #[test]
    fn url_search_params_matches_js_stringification() {
        let mut object = serde_json::Map::new();
        object.insert("params".into(), json!("abc"));
        object.insert("e_r".into(), json!(false));
        object.insert("n".into(), json!(1000));
        object.insert("header".into(), json!({"a": 1}));
        object.insert("list".into(), json!([1, 2]));
        assert_eq!(
            url_search_params(&object),
            "params=abc&e_r=false&n=1000&header=%5Bobject+Object%5D&list=1%2C2"
        );
    }
}
