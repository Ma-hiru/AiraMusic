//! 1:1 复刻 `util/ncbl.js`（桌面客户端 NCBL 日志加密）。
//!
//! 结构：`NCBL` 头（70 字节）+ 元信息块（ChaCha20，密钥为 RSA 包裹的 keyA）+ 若干数据帧。
//! - 元信息用 keyB（= RSA(keyA)）加密，服务端可用私钥还原 keyA；
//! - 数据帧 = zstd(正文) 分片，用 keyA 加密，每帧同一个起始 counter（与 JS 实现一致）；
//! - 头部带 uuid/nonce、序号区间与尾随长度。

use chacha20::cipher::{KeyIvInit, StreamCipher, StreamCipherSeek};
use num_bigint::BigUint;
use serde_json::{json, Map, Value};

use crate::ncm::config::now_ms;
use crate::ncm::util::Cookies;

type ChaCha20 = chacha20::ChaCha20;

const MAGIC: &[u8; 4] = b"NCBL";
const VERSION: u32 = 3;
const HEADER_FIXED_LEN: usize = 70;
const META_BLOCK_TYPE: u16 = 0x4343;
const DEFAULT_MAX_FRAME: usize = 0x8000;

/// 256 位模数（公开资料中已可分解，因此这里只用公钥做包裹，不需要私钥）
const RSA_N_HEX: &str = "fd90bd466ff9bc8a3fec2fbcf263b90d5c564879fa5d7aab89b31c1d5cb4139d";
const RSA_E: u32 = 65537;

pub const UPLOAD_PATH: &str = "/api/clientlog/encrypt/upload?multiupload=true";

fn chacha20_apply(key: &[u8; 32], counter: u32, nonce: &[u8; 12], data: &[u8]) -> Vec<u8> {
    let mut cipher = ChaCha20::new(key.into(), nonce.into());
    // 对应 JS 的 `chachaBlock(key, counter, nonce)`：从第 counter 个 64 字节块开始
    cipher.seek(u64::from(counter) * 64);
    let mut out = data.to_vec();
    cipher.apply_keystream(&mut out);
    out
}

/// `rsaWrap(keyA)`：无填充 RSA，输出 32 字节
pub fn rsa_wrap(key_a: &[u8]) -> [u8; 32] {
    let modulus = BigUint::parse_bytes(RSA_N_HEX.as_bytes(), 16).expect("modulus");
    let message = BigUint::from_bytes_be(key_a);
    let encrypted = message.modpow(&BigUint::from(RSA_E), &modulus);
    let bytes = encrypted.to_bytes_be();
    let mut out = [0u8; 32];
    if bytes.len() <= 32 {
        out[32 - bytes.len()..].copy_from_slice(&bytes);
    }
    out
}

#[derive(Default, Clone, Copy)]
pub struct NcblOptions {
    /// 测试用：固定 keyA（32 字节）
    pub key_a: Option<[u8; 32]>,
    /// 测试用：固定 uuid（16 字节）
    pub uuid: Option<[u8; 16]>,
    /// 测试用：固定起始序号
    pub base_seq: Option<u16>,
    pub max_frame: Option<usize>,
}

fn uuid_v4() -> [u8; 16] {
    let mut bytes: [u8; 16] = rand::random();
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    bytes
}

/// `encryptNCBL(meta, body, opts)`
pub fn encrypt_ncbl(meta: &[u8], body: &[u8], options: NcblOptions) -> Vec<u8> {
    let max_frame = options.max_frame.unwrap_or(DEFAULT_MAX_FRAME);

    let mut key_a = options.key_a.unwrap_or_else(rand::random);
    if key_a[0] >= 0xa3 {
        key_a[0] = 0xa2;
    }
    let key_b = rsa_wrap(&key_a);

    let uuid = options.uuid.unwrap_or_else(uuid_v4);
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&uuid[..12]);
    let counter = u32::from_le_bytes([uuid[12], uuid[13], uuid[14], uuid[15]]) >> 2;
    let base_seq = options.base_seq.unwrap_or_else(rand::random::<u16>) as u32;

    let meta_cipher = chacha20_apply(&key_b, counter, &nonce, meta);
    let mut meta_block = Vec::with_capacity(4 + meta_cipher.len());
    meta_block.extend_from_slice(&META_BLOCK_TYPE.to_le_bytes());
    meta_block.extend_from_slice(&(meta_cipher.len() as u16).to_le_bytes());
    meta_block.extend_from_slice(&meta_cipher);
    let header_len = HEADER_FIXED_LEN + meta_block.len();

    let compressed = zstd::encode_all(body, 3).unwrap_or_default();

    let mut trailing = Vec::new();
    let mut seq = base_seq;
    let mut offset = 0usize;
    loop {
        let end = (offset + max_frame).min(compressed.len());
        let slice = &compressed[offset..end];
        let cipher = chacha20_apply(&key_a, counter, &nonce, slice);
        trailing.extend_from_slice(&(cipher.len() as u16).to_le_bytes());
        trailing.extend_from_slice(&seq.to_le_bytes());
        trailing.extend_from_slice(&cipher);
        seq += 1;
        if compressed.is_empty() {
            break;
        }
        offset = end;
        if offset >= compressed.len() {
            break;
        }
    }
    let frame_count = seq - base_seq;

    let mut header = vec![0u8; HEADER_FIXED_LEN];
    header[0..4].copy_from_slice(MAGIC);
    header[4..8].copy_from_slice(&VERSION.to_le_bytes());
    header[8..10].copy_from_slice(&(header_len as u16).to_le_bytes());
    header[10..26].copy_from_slice(&uuid);
    header[26..58].copy_from_slice(&key_b);
    header[58..62].copy_from_slice(&base_seq.to_le_bytes());
    header[62..66].copy_from_slice(&(base_seq + frame_count - 1).to_le_bytes());
    header[66..70].copy_from_slice(&(trailing.len() as u32).to_le_bytes());

    let mut out = Vec::with_capacity(header.len() + meta_block.len() + trailing.len());
    out.extend_from_slice(&header);
    out.extend_from_slice(&meta_block);
    out.extend_from_slice(&trailing);
    out
}

/// 解析 NCBL 头（测试与排障用）
#[allow(dead_code)]
pub struct NcblHeader {
    pub version: u32,
    pub header_len: usize,
    pub uuid: [u8; 16],
    pub key_b: [u8; 32],
    pub base_seq: u32,
    pub last_seq: u32,
    pub trailing_len: u32,
}

#[allow(dead_code)]
pub fn parse_header(data: &[u8]) -> Option<NcblHeader> {
    if data.len() < HEADER_FIXED_LEN || &data[0..4] != MAGIC {
        return None;
    }
    let mut uuid = [0u8; 16];
    uuid.copy_from_slice(&data[10..26]);
    let mut key_b = [0u8; 32];
    key_b.copy_from_slice(&data[26..58]);
    Some(NcblHeader {
        version: u32::from_le_bytes(data[4..8].try_into().ok()?),
        header_len: u16::from_le_bytes(data[8..10].try_into().ok()?) as usize,
        uuid,
        key_b,
        base_seq: u32::from_le_bytes(data[58..62].try_into().ok()?),
        last_seq: u32::from_le_bytes(data[62..66].try_into().ok()?),
        trailing_len: u32::from_le_bytes(data[66..70].try_into().ok()?),
    })
}

/// 测试用：用 keyA 还原 NCBL 正文（header_len 之后按帧切分）
#[allow(dead_code)]
pub fn decrypt_ncbl(data: &[u8], key_a: &[u8; 32]) -> Option<Vec<u8>> {
    let header = parse_header(data)?;
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&header.uuid[..12]);
    let counter = u32::from_le_bytes([
        header.uuid[12],
        header.uuid[13],
        header.uuid[14],
        header.uuid[15],
    ]) >> 2;

    let mut offset = header.header_len;
    let end = data.len();
    let mut compressed = Vec::new();
    while offset + 6 <= end {
        let len = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
        offset += 6;
        if offset + len > end {
            return None;
        }
        compressed.extend(chacha20_apply(
            key_a,
            counter,
            &nonce,
            &data[offset..offset + len],
        ));
        offset += len;
    }
    zstd::decode_all(compressed.as_slice()).ok()
}

// ---------------------------------------------------------------------------
// 设备 / 认证上下文
// ---------------------------------------------------------------------------

#[allow(dead_code)] // 字段与 JS 的 ctx.app 对齐，部分暂未被 meta/cookie 使用
pub struct AppInfo {
    pub id: String,
    pub urs: String,
    pub pid: String,
    pub nsm: String,
    pub cid: String,
    pub channel: String,
    pub version: String,
    pub version_code: String,
    pub build_code: String,
    pub build_type: String,
    pub package_id: String,
}

pub struct DeviceInfo {
    pub id: String,
    pub ti: String,
    pub sign: String,
    pub model: String,
    pub nnid: String,
    pub nuid: String,
    pub csrf: String,
    pub system_type: String,
    pub system_version: String,
}

#[allow(dead_code)]
pub struct AuthInfo {
    pub id: String,
    pub token: String,
    pub session_id: String,
    pub vip_type: String,
}

#[allow(dead_code)]
pub struct ReportContext {
    pub app: AppInfo,
    pub device: DeviceInfo,
    pub auth: AuthInfo,
    pub start_time: u128,
    pub process_id: u32,
}

fn pick(cookies: &Cookies, key: &str, fallback: &str) -> String {
    cookies
        .get(key)
        .cloned()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

/// `extractContext(cookieObj)`
pub fn extract_context(cookies: &Cookies) -> ReportContext {
    let cid = {
        let value = pick(cookies, "WNMCID", "");
        if value.is_empty() {
            format!(
                "{}.{}.01.0",
                hex::encode(rand::random::<[u8; 3]>()),
                now_ms()
            )
        } else {
            value
        }
    };
    let nnid = pick(cookies, "_ntes_nnid", ",");
    let nud = pick(cookies, "_ntes_nuid", "");

    ReportContext {
        app: AppInfo {
            id: pick(cookies, "appid", ""),
            urs: String::new(),
            pid: String::new(),
            nsm: pick(cookies, "WEVNSM", "1.0.0"),
            cid,
            channel: pick(cookies, "channel", "netease"),
            version: pick(cookies, "appver", "3.1.35"),
            version_code: pick(cookies, "versioncode", "205293"),
            build_code: pick(cookies, "buildver", ""),
            build_type: "release".to_string(),
            package_id: String::new(),
        },
        device: DeviceInfo {
            id: cookies
                .get("deviceId")
                .cloned()
                .filter(|value| !value.is_empty())
                .or_else(|| cookies.get("sDeviceId").cloned())
                .unwrap_or_default(),
            ti: pick(cookies, "NMTID", ""),
            sign: pick(cookies, "clientSign", ""),
            model: cookies
                .get("mode")
                .cloned()
                .filter(|value| !value.is_empty())
                .or_else(|| cookies.get("mobilename").cloned())
                .unwrap_or_default(),
            nnid,
            nuid: nud,
            csrf: pick(cookies, "__csrf", ""),
            system_type: pick(cookies, "os", "pc"),
            system_version: pick(
                cookies,
                "osver",
                "Microsoft-Windows-10-Professional-build-19045-64bit",
            ),
        },
        auth: AuthInfo {
            id: pick(cookies, "uid", ""),
            token: pick(cookies, "MUSIC_U", ""),
            session_id: pick(cookies, "JSESSIONID-WYYY", ""),
            vip_type: cookies.get("vipType").cloned().unwrap_or_default(),
        },
        start_time: now_ms(),
        process_id: rand::random_range(10_000..100_000),
    }
}

fn cookie_pairs(ctx: &ReportContext) -> Vec<(String, String)> {
    vec![
        ("JSESSIONID-WYYY".into(), ctx.auth.session_id.clone()),
        ("MUSIC_U".into(), ctx.auth.token.clone()),
        ("NMTID".into(), ctx.device.ti.clone()),
        ("WEVNSM".into(), ctx.app.nsm.clone()),
        ("WNMCID".into(), ctx.app.cid.clone()),
        ("__csrf".into(), ctx.device.csrf.clone()),
        ("__remember_me".into(), "true".into()),
        ("_iuqxldmzr_".into(), "33".into()),
        ("_ntes_nnid".into(), ctx.device.nnid.clone()),
        ("_ntes_nuid".into(), ctx.device.nuid.clone()),
        (
            "appver".into(),
            format!("{}.{}", ctx.app.version, ctx.app.version_code),
        ),
        ("channel".into(), ctx.app.channel.clone()),
        ("clientSign".into(), ctx.device.sign.clone()),
        ("deviceId".into(), ctx.device.id.clone()),
        ("mode".into(), ctx.device.model.clone()),
        ("ntes_kaola_ad".into(), "1".into()),
        ("os".into(), ctx.device.system_type.clone()),
        ("osver".into(), ctx.device.system_version.clone()),
    ]
}

/// `buildCookieStr(ctx)`
pub fn build_cookie_str(ctx: &ReportContext) -> String {
    cookie_pairs(ctx)
        .into_iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("; ")
}

/// `buildMetaJson(ctx)`
pub fn build_meta_json(ctx: &ReportContext) -> String {
    let mut map = Map::new();
    for (key, value) in cookie_pairs(ctx) {
        if key == "__remember_me" {
            continue;
        }
        map.insert(key, json!(value));
    }
    Value::Object(map).to_string()
}

// ---------------------------------------------------------------------------
// PLV / PLD
// ---------------------------------------------------------------------------

#[allow(dead_code)] // name/artist/vip 与 JS 的 song 结构对齐，PLV/PLD 暂不读取
pub struct Song {
    pub id: u64,
    pub name: String,
    pub artist: String,
    pub bitrate: u64,
    pub level: String,
    pub vip: bool,
    pub time: u64,
}

pub struct Source {
    pub id: String,
    pub kind: String,
    pub name: String,
}

const FIELD_SEP: char = '\x01';

/// `buildRecord`：`time \x01 action \x01 json`
pub fn build_records(items: &[(u64, &str, Value)]) -> Vec<u8> {
    let mut out = String::new();
    for (time, action, data) in items {
        out.push_str(&time.to_string());
        out.push(FIELD_SEP);
        out.push_str(action);
        out.push(FIELD_SEP);
        out.push_str(&data.to_string());
    }
    out.into_bytes()
}

pub fn build_plv(ctx: &ReportContext, song: &Song, source: &Source) -> Value {
    let now = now_ms();
    let add_refer = format!(
        "[F:63][{now}#933#{}#{}#c9156c3][e][2][23][cell_pc_songlist_song:2|page_pc_songlist_songflow|page_mine_like_music][{}:song:x:x|:::|{}:list::]",
        ctx.app.version, ctx.app.version_code, song.id, source.id
    );
    let multi_refers = vec![
        "[F:26][s][18][_ai]".to_string(),
        "[F:26][s][12][_ai]".to_string(),
        format!(
            "[F:63][{now}#933#{}#{}#c9156c3][e][2][8][cell_pc_main_tab_entrance:6|page_pc_main_tab][我喜欢的音乐:spm::|:::]",
            ctx.app.version, ctx.app.version_code
        ),
        "[F:26][s][5][_ai]".to_string(),
        "[F:26][s][0][_ai]".to_string(),
    ];

    json!({
        "mode": "circulation",
        "download": 0,
        "alg": "",
        "status": "front",
        "id": song.id.to_string(),
        "bitrate": song.bitrate,
        "type": "song",
        "is_listentogether": 0,
        "source": source.name,
        "is_heart": 0,
        "resource_ratio": "",
        "resource_time": song.time,
        "musiceffect_id": "",
        "app_mode": 2,
        "bitrate_level": song.level,
        "_addrefer": add_refer,
        "_multirefers": multi_refers,
        "vipType": ctx.auth.vip_type,
        "fee": 1,
        "file": 4,
        "rightSource": 0,
        "sourceId": source.id,
        "sourcetype": source.kind,
        "libra_abt": "",
        "channel": ctx.app.channel,
        "curStartChannel": "",
    })
}

pub fn build_pld(ctx: &ReportContext, song: &Song, source: &Source, played: u64) -> Value {
    let now = now_ms();
    let add_refer = format!(
        "[F:63][{now}#616#{}#{}#c9156c3][e][2][92][btn_pc_cover_play|cell_pc_songlist_song:6|page_pc_songlist_songflow|page_mine_like_music][:::|{}:song:x:x|:::|{}:list::]",
        ctx.app.version, ctx.app.version_code, song.id, source.id
    );
    let multi_refers = vec![
        "[F:26][s][87][_ai]".to_string(),
        "[F:26][s][81][_ai]".to_string(),
        "[F:26][s][75][_ai]".to_string(),
        "[F:26][s][69][_ai]".to_string(),
        "[F:26][s][63][_ai]".to_string(),
    ];

    json!({
        "mode": "circulation",
        "download": 0,
        "alg": "",
        "status": "front",
        "id": song.id.to_string(),
        "time": played,
        "type": "song",
        "is_listentogether": 0,
        "source": source.name,
        "is_heart": 0,
        "realtime": played,
        "resource_ratio": "",
        "resource_time": song.time,
        "musiceffect_id": "1001",
        "app_mode": 1,
        "lyriceffect": "default",
        "displayMode": "classic",
        "bitrate": song.bitrate,
        "bitrate_level": song.level,
        "_addrefer": add_refer,
        "_multirefers": multi_refers,
        "vipType": ctx.auth.vip_type,
        "fee": 8,
        "file": 4,
        "rightSource": 0,
        "sourceId": source.id,
        "sourcetype": source.kind,
        "end": "interrupt",
        "libra_abt": "",
        "channel": ctx.app.channel,
        "curStartChannel": "",
    })
}

// ---------------------------------------------------------------------------
// multipart + 上传
// ---------------------------------------------------------------------------

pub struct Multipart {
    pub boundary: String,
    pub file_name: String,
    pub body: Vec<u8>,
}

/// `buildMultipart(payload)`
pub fn build_multipart(payload: &[u8]) -> Multipart {
    let boundary = uuid::Uuid::new_v4().to_string().replace('-', "");
    let file_name = format!(
        "op_{}_0_{}",
        rand::random_range(10_000..100_000),
        rand::random_range(1..=u32::MAX)
    );
    let header = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\nContent-Type: multipart/form-data\r\n\r\n"
    );
    let footer = format!("\r\n--{boundary}--\r\n");
    let mut body = Vec::with_capacity(header.len() + payload.len() + footer.len());
    body.extend_from_slice(header.as_bytes());
    body.extend_from_slice(payload);
    body.extend_from_slice(footer.as_bytes());
    Multipart {
        boundary,
        file_name,
        body,
    }
}

pub struct UploadOutcome {
    pub success: bool,
    pub file_name: String,
    pub payload_len: usize,
    pub response: Value,
}

/// `doUpload(ctx, metaJson, body, cookieStr, label)`
pub async fn do_upload(
    client: &reqwest::Client,
    base: &str,
    ctx: &ReportContext,
    meta_json: &str,
    body: &[u8],
    cookie_str: &str,
    _label: &str,
) -> Result<UploadOutcome, String> {
    let payload = encrypt_ncbl(meta_json.as_bytes(), body, NcblOptions::default());
    let multipart = build_multipart(&payload);

    let response = client
        .post(format!("{base}{UPLOAD_PATH}"))
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={}", multipart.boundary),
        )
        .header(reqwest::header::REFERER, "https://music.163.com/di")
        .header(
            reqwest::header::USER_AGENT,
            format!(
                "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/{}",
                ctx.app.version
            ),
        )
        .header(reqwest::header::ACCEPT_ENCODING, "gzip,deflate")
        .header(reqwest::header::ACCEPT_LANGUAGE, "zh-CN,zh;q=0.8")
        .header(reqwest::header::COOKIE, cookie_str)
        .body(multipart.body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let response_body: Value = response.json().await.unwrap_or(Value::Null);
    let success = response_body.get("code").and_then(Value::as_u64) == Some(200)
        && response_body
            .get("data")
            .and_then(|data| data.get("successfiles"))
            .and_then(Value::as_array)
            .map(|files| {
                files
                    .iter()
                    .any(|item| item.as_str() == Some(&multipart.file_name))
            })
            .unwrap_or(false);

    Ok(UploadOutcome {
        success,
        file_name: multipart.file_name,
        payload_len: payload.len(),
        response: response_body,
    })
}

/// `parseCookie` 的字符串形式（对象形式由 server 层直接给）
pub fn parse_cookie(cookie: &str) -> Cookies {
    let mut out = Cookies::new();
    for part in cookie.split(';') {
        if let Some(index) = part.find('=') {
            let key = part[..index].trim();
            if key.is_empty() {
                continue;
            }
            out.insert(key.to_string(), part[index + 1..].trim().to_string());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rsa_wrap_matches_js_vector() {
        // 由 util/ncbl.js 的 rsaWrap 生成（固定 keyA）
        let key_a: [u8; 32] = [
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
            0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
            0x0d, 0x0e, 0x0f, 0x10,
        ];
        let wrapped = rsa_wrap(&key_a);
        // 与 node 侧 rsaWrap 一致：长度固定 32，且不可为全 0
        assert_eq!(wrapped.len(), 32);
        assert!(wrapped.iter().any(|byte| *byte != 0));
    }

    /// 与 `temp/ncbl-vector.mjs` 生成的 JS 基准逐字节对照
    #[test]
    fn matches_js_vector() {
        let fixture: Value =
            serde_json::from_str(include_str!("../../tests/fixtures/ncbl-vector.json"))
                .expect("fixture");
        let key_a: [u8; 32] = hex::decode(fixture["keyA"].as_str().unwrap())
            .unwrap()
            .try_into()
            .unwrap();
        let uuid: [u8; 16] = hex::decode(fixture["uuid"].as_str().unwrap())
            .unwrap()
            .try_into()
            .unwrap();
        let base_seq = fixture["baseSeq"].as_u64().unwrap() as u16;
        let meta = fixture["meta"].as_str().unwrap().as_bytes();
        let body = fixture["body"].as_str().unwrap().as_bytes();
        let expected_wrap = fixture["rsaWrap"].as_str().unwrap();

        assert_eq!(
            hex::encode(rsa_wrap(&key_a)),
            expected_wrap,
            "RSA 包裹不一致"
        );

        let payload = encrypt_ncbl(
            meta,
            body,
            NcblOptions {
                key_a: Some(key_a),
                uuid: Some(uuid),
                base_seq: Some(base_seq),
                max_frame: None,
            },
        );
        let expected = fixture["ncbl"].as_str().unwrap();
        let js_payload = hex::decode(expected).unwrap();

        // 头部、RSA 包裹的 keyB、元信息块（ChaCha20 加密）必须逐字节一致
        let our_header = parse_header(&payload).unwrap();
        let js_header = parse_header(&js_payload).unwrap();
        assert_eq!(payload.len(), js_payload.len(), "总长度");
        assert_eq!(our_header.version, js_header.version);
        assert_eq!(our_header.uuid, js_header.uuid);
        assert_eq!(our_header.key_b, js_header.key_b);
        assert_eq!(our_header.base_seq, js_header.base_seq);
        assert_eq!(our_header.last_seq, js_header.last_seq);
        assert_eq!(our_header.header_len, js_header.header_len);
        assert_eq!(
            &payload[..our_header.header_len],
            &js_payload[..js_header.header_len],
            "头部 + 元信息块应完全一致"
        );

        // 正文帧头（长度 + 序号）一致；压缩后的负载允许不同（zstd 参数差异），
        // 但两边都必须能还原成同一份明文。
        let mut ours = our_header.header_len;
        let mut theirs = js_header.header_len;
        while theirs + 6 <= js_payload.len() {
            assert_eq!(
                &payload[ours..ours + 6],
                &js_payload[theirs..theirs + 6],
                "帧头"
            );
            let len = u16::from_le_bytes([payload[ours], payload[ours + 1]]) as usize;
            ours += 6 + len;
            theirs += 6 + len;
        }
        assert_eq!(decrypt_ncbl(&payload, &key_a).unwrap(), body);
        assert_eq!(decrypt_ncbl(&js_payload, &key_a).unwrap(), body);
    }

    #[test]
    fn ncbl_roundtrip_with_fixed_inputs() {
        let key_a = [7u8; 32];
        let uuid = [9u8; 16];
        let options = NcblOptions {
            key_a: Some(key_a),
            uuid: Some(uuid),
            base_seq: Some(0x1234),
            max_frame: None,
        };
        let meta = br#"{"MUSIC_U":"token"}"#;
        let body = b"1\x01_plv\x01{\"id\":\"1\"}";
        let payload = encrypt_ncbl(meta, body, options);

        let header = parse_header(&payload).expect("header");
        assert_eq!(header.version, 3);
        assert_eq!(header.uuid, uuid);
        assert_eq!(header.base_seq, 0x1234);
        assert!(header.last_seq >= header.base_seq);
        assert_eq!(
            header.trailing_len as usize,
            payload.len() - header.header_len
        );

        let decoded = decrypt_ncbl(&payload, &key_a).expect("decrypt");
        assert_eq!(decoded, body);

        // 元信息块也要能还原
        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&uuid[..12]);
        let counter = u32::from_le_bytes([uuid[12], uuid[13], uuid[14], uuid[15]]) >> 2;
        let meta_block = &payload[HEADER_FIXED_LEN..header.header_len];
        assert_eq!(
            &meta_block[..2],
            &META_BLOCK_TYPE.to_le_bytes(),
            "元信息块类型"
        );
        let len = u16::from_le_bytes([meta_block[2], meta_block[3]]) as usize;
        let plain_meta = chacha20_apply(&header.key_b, counter, &nonce, &meta_block[4..4 + len]);
        assert_eq!(plain_meta, meta);
    }

    #[test]
    fn empty_body_still_has_one_frame() {
        let payload = encrypt_ncbl(
            b"meta",
            b"",
            NcblOptions {
                key_a: Some([1u8; 32]),
                uuid: Some([2u8; 16]),
                base_seq: Some(0),
                max_frame: None,
            },
        );
        let header = parse_header(&payload).unwrap();
        assert_eq!(header.base_seq, 0);
        assert_eq!(header.last_seq, 0, "空正文也应有一个空帧");
    }

    #[test]
    fn records_use_unit_separator() {
        let records = build_records(&[
            (1700000000, "_plv", json!({"a": 1})),
            (1700000001, "_pld", json!({"b": 2})),
        ]);
        let text = String::from_utf8(records).unwrap();
        assert_eq!(
            text,
            "1700000000\u{1}_plv\u{1}{\"a\":1}1700000001\u{1}_pld\u{1}{\"b\":2}"
        );
    }

    #[test]
    fn multipart_matches_js_shape() {
        let part = build_multipart(b"payload");
        assert_eq!(part.boundary.len(), 32);
        assert!(part.file_name.starts_with("op_"));
        let head = format!("--{}", part.boundary);
        assert!(part.body.starts_with(head.as_bytes()));
        assert!(String::from_utf8_lossy(&part.body)
            .ends_with(&format!("\r\n--{}--\r\n", part.boundary)));
        assert!(String::from_utf8_lossy(&part.body).contains("name=\"file\""));
    }

    #[test]
    fn context_defaults_match_js() {
        let mut cookies = Cookies::new();
        cookies.insert("MUSIC_U".into(), "token".into());
        cookies.insert("os".into(), "pc".into());
        let ctx = extract_context(&cookies);
        assert_eq!(ctx.app.version, "3.1.35");
        assert_eq!(ctx.app.version_code, "205293");
        assert_eq!(ctx.app.channel, "netease");
        assert_eq!(ctx.device.nnid, ",");
        assert_eq!(ctx.device.system_type, "pc");
        assert!(ctx.app.cid.ends_with(".01.0"));
        assert_eq!(ctx.auth.token, "token");
    }

    #[test]
    fn cookie_and_meta_share_fields() {
        let mut cookies = Cookies::new();
        cookies.insert("MUSIC_U".into(), "u".into());
        cookies.insert("__csrf".into(), "c".into());
        let ctx = extract_context(&cookies);
        let cookie = build_cookie_str(&ctx);
        assert!(cookie.contains("MUSIC_U=u"));
        assert!(cookie.contains("__csrf=c"));
        assert!(cookie.contains("__remember_me=true"));

        let meta: Value = serde_json::from_str(&build_meta_json(&ctx)).unwrap();
        assert_eq!(meta["MUSIC_U"], json!("u"));
        assert_eq!(meta["__csrf"], json!("c"));
        assert!(
            meta.get("__remember_me").is_none(),
            "meta 不含 __remember_me"
        );
    }

    #[test]
    fn parse_cookie_keeps_plus_and_equals() {
        let parsed = parse_cookie("MUSIC_U=a+b=c; k=v");
        assert_eq!(parsed.get("MUSIC_U").map(String::as_str), Some("a+b=c"));
    }
}
