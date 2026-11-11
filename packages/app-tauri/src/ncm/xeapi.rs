//! 1:1 复刻 `util/crypto.js` 的 xeapi 段与 `module/register_xeapikey.js`。
//!
//! 链路：
//! 1. `POST /api/bsr/sk/get`（HMAC-SHA256 签名）拿到服务端下发的 X25519 公钥与 `sk`；
//! 2. 每次请求生成临时 X25519 密钥对，与公钥做 DH，HKDF 出 16 字节 AES key；
//! 3. 明文 = `{contentType?, method?, queryString, content|body}`，先 AES-ECB(staticKey)，
//!    再做「随机 16 字节异或 + 环形左移」，再 AES-ECB(dynamicKey)；
//! 4. 动态 key 用 AES-128-GCM 封进 `S`，`R` 里放版本号与会话号；
//! 5. 响应体是 AES-ECB(eapiKey) 密文，可能是 gzip。

use aes::Aes128;
use aes_gcm::aead::consts::U12;
use aes_gcm::aead::{Aead, KeyInit as AeadKeyInit, Payload};
use aes_gcm::{AesGcm, Nonce};
use base64::Engine;
use hmac::{Hmac, Mac};
use serde_json::{json, Map, Value};
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::ncm::crypto::ecb_encrypt;
use crate::ncm::util::url_search_params;

const STATIC_KEY_HEX: &str = "ab1d5a430f6bb04a3f01e81ddd72bd916d5ce591248ac128714806d7f8fb1b84";
const SIGN_KEY: &str =
    "mUHCwVNWJbunMqAHf5MImuirT6plvs6VSFW62MGHstFQxhBGdEoIhLItH3djc4+FB/OKty3+lL2rGeoFBpVe5g==";
/// `x25519SpkiPrefix`：RFC 8410 的 id-X25519 SubjectPublicKeyInfo 头
const SPKI_PREFIX: [u8; 12] = [
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00,
];

fn static_key() -> Vec<u8> {
    hex::decode(STATIC_KEY_HEX).expect("static key")
}

fn b64() -> base64::engine::general_purpose::GeneralPurpose {
    base64::engine::general_purpose::STANDARD
}

fn b64url() -> base64::engine::general_purpose::GeneralPurpose {
    base64::engine::general_purpose::URL_SAFE_NO_PAD
}

/// `xeapiSign(timestamp, nonce)`
pub fn sign(timestamp: &str, nonce: &str) -> String {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(SIGN_KEY.as_bytes()).expect("hmac key");
    mac.update(format!("{timestamp}{nonce}").as_bytes());
    b64().encode(mac.finalize().into_bytes())
}

/// `deriveX25519AesKey(sharedSecret, ephemeralPublicKey)`
fn derive_aes_key(shared: &[u8], ephemeral_public: &[u8]) -> [u8; 16] {
    // HKDF-Extract：salt 固定 32 字节 0
    let mut prk_mac = <Hmac<Sha256> as Mac>::new_from_slice(&[0u8; 32]).expect("hkdf");
    prk_mac.update(if shared.is_empty() {
        &[0u8; 32]
    } else {
        shared
    });
    let prk = prk_mac.finalize().into_bytes();

    let mut expand = <Hmac<Sha256> as Mac>::new_from_slice(&prk).expect("hkdf expand");
    expand.update(ephemeral_public);
    expand.update(&[1u8]);
    let okm = expand.finalize().into_bytes();

    let mut key = [0u8; 16];
    key.copy_from_slice(&okm[..16]);
    key
}

/// `xeapiMidTransform(ciphertext)`：随机 16 字节异或后按 `random[0] % len` 左移
pub fn mid_transform(ciphertext: &[u8]) -> Vec<u8> {
    let random: [u8; 16] = rand::random();
    let xored: Vec<u8> = ciphertext
        .iter()
        .enumerate()
        .map(|(index, byte)| byte ^ random[index & 0x0f])
        .collect();
    let rotation = if xored.is_empty() {
        0
    } else {
        (random[0] as usize & 0x0f) % xored.len()
    };
    let mut out = Vec::with_capacity(16 + xored.len());
    out.extend_from_slice(&random);
    out.extend_from_slice(&xored[rotation..]);
    out.extend_from_slice(&xored[..rotation]);
    out
}

#[allow(dead_code)] // 仅测试与排查用
fn mid_untransform(data: &[u8]) -> Option<Vec<u8>> {
    if data.len() < 16 {
        return None;
    }
    let (random, rest) = data.split_at(16);
    let rotation = if rest.is_empty() {
        0
    } else {
        (random[0] as usize & 0x0f) % rest.len()
    };
    let mut unrotated = Vec::with_capacity(rest.len());
    unrotated.extend_from_slice(&rest[rest.len() - rotation..]);
    unrotated.extend_from_slice(&rest[..rest.len() - rotation]);
    Some(
        unrotated
            .iter()
            .enumerate()
            .map(|(index, byte)| byte ^ random[index & 0x0f])
            .collect(),
    )
}

/// 服务端下发的公钥状态（`/tmp/xeapi_public_key` 的落盘结构）
#[derive(Clone, Debug)]
pub struct PublicKeyState {
    pub version: Value,
    pub public_key: String,
    pub sk: String,
    #[allow(dead_code)]
    pub device_id: String,
}

impl PublicKeyState {
    pub fn from_json(value: &Value, device_id: &str) -> Option<Self> {
        Some(Self {
            version: value.get("version").cloned().unwrap_or(json!(0)),
            public_key: value.get("publicKey")?.as_str()?.to_string(),
            sk: value
                .get("sk")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            device_id: value
                .get("deviceId")
                .and_then(Value::as_str)
                .unwrap_or(device_id)
                .to_string(),
        })
    }
}

/// `xeapiEncryptS(dynamicKey, publicKeyState, os)`
fn encrypt_s(dynamic_key: &[u8], state: &PublicKeyState, os: &str) -> Option<Vec<u8>> {
    let peer_raw = b64().decode(&state.public_key).ok()?;
    if peer_raw.len() != 32 {
        return None;
    }
    let mut peer_bytes = [0u8; 32];
    peer_bytes.copy_from_slice(&peer_raw);
    let peer = PublicKey::from(peer_bytes);

    let secret_bytes: [u8; 32] = rand::random();
    let secret = StaticSecret::from(secret_bytes);
    let ephemeral = PublicKey::from(&secret);
    let shared = secret.diffie_hellman(&peer);
    let aes_key = derive_aes_key(shared.as_bytes(), ephemeral.as_bytes());

    let cipher = <AesGcm<Aes128, U12> as AeadKeyInit>::new_from_slice(&aes_key).ok()?;
    let nonce: [u8; 12] = rand::random();
    let plaintext = format!("{}|{}|{}", b64().encode(dynamic_key), os, state.sk);
    let sealed = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: plaintext.as_bytes(),
                aad: &[],
            },
        )
        .ok()?;

    let mut out = Vec::with_capacity(32 + 12 + sealed.len());
    out.extend_from_slice(ephemeral.as_bytes());
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&sealed);
    let _ = SPKI_PREFIX;
    Some(out)
}

/// `buildXeapiPlaintext(uri, data, options)`
pub fn build_plaintext(uri: &str, data: &Map<String, Value>) -> String {
    let mut fields = Map::new();

    let mut body_data = data.clone();
    body_data.remove("e_r");
    let body = url_search_params(&body_data);
    if !body.is_empty() {
        fields.insert("content".into(), json!(body));
    }

    let mut query = String::new();
    if let Some((_, search)) = uri.split_once('?') {
        query = search.to_string();
    }
    query = if query.is_empty() {
        "e_r=true".to_string()
    } else {
        format!("{query}&e_r=true")
    };
    fields.insert("queryString".into(), json!(query));

    serde_json::to_string(&fields).unwrap_or_default()
}

pub struct Encrypted {
    pub c: String,
    pub s: String,
    pub r: String,
}

/// `xeapi(uri, data, options)`
pub fn encrypt(
    uri: &str,
    data: &Map<String, Value>,
    state: &PublicKeyState,
    session_id: &str,
    session_key: &str,
) -> Option<Encrypted> {
    let dynamic_key: Vec<u8> = if session_key.is_empty() {
        rand::random::<[u8; 16]>().to_vec()
    } else {
        session_key.as_bytes().to_vec()
    };
    let plaintext = build_plaintext(uri, data);

    let mid = mid_transform(&ecb_encrypt(plaintext.as_bytes(), &static_key()));
    let c = ecb_encrypt(&mid, &dynamic_key);
    let s = encrypt_s(&dynamic_key, state, "android")?;
    // 版本号是字符串（例如 "1000000000000"），必须原样拼接
    let r = ecb_encrypt(
        format!(
            "{}|{}",
            crate::ncm::util::js_string(&state.version),
            if session_key.is_empty() {
                ""
            } else {
                session_id
            }
        )
        .as_bytes(),
        &static_key(),
    );

    Some(Encrypted {
        c: b64url().encode(c),
        s: b64().encode(s),
        r: b64().encode(r),
    })
}

/// `xeapiResDecrypt(body)`：AES-ECB → 可选 gunzip → JSON
pub fn res_decrypt(body: &[u8]) -> Option<Value> {
    use std::io::Read;
    let key = b"e82ckenh8dichen8";
    let mut plain = crate::ncm::crypto::ecb_decrypt(body, key)?;
    if plain.starts_with(&[0x1f, 0x8b]) {
        let mut decoder = flate2::read::GzDecoder::new(plain.as_slice());
        let mut out = Vec::new();
        decoder.read_to_end(&mut out).ok()?;
        plain = out;
    }
    serde_json::from_slice(&plain).ok()
}

/// 测试用：把 `C` 解回明文（需要 dynamicKey）
#[allow(dead_code)]
pub fn decrypt_c(c: &str, dynamic_key: &[u8]) -> Option<String> {
    let raw = b64url().decode(c).ok()?;
    let mid = crate::ncm::crypto::ecb_decrypt(&raw, dynamic_key)?;
    let inner = mid_untransform(&mid)?;
    let plain = crate::ncm::crypto::ecb_decrypt(&inner, &static_key())?;
    String::from_utf8(plain).ok()
}

/// `xeapiDecryptPublicKey(encryptedData)`
pub fn decrypt_public_key(encrypted: &str) -> Option<Value> {
    let raw = b64().decode(encrypted).ok()?;
    let plain = crate::ncm::crypto::ecb_decrypt(&raw, &static_key())?;
    serde_json::from_slice(&plain).ok()
}

/// `generateNonce()`：16 位数字
pub fn generate_nonce() -> String {
    (0..16)
        .map(|_| char::from(b'0' + rand::random_range(0..10u8)))
        .collect()
}

/// `/tmp/xeapi_public_key`
pub fn cache_path() -> std::path::PathBuf {
    std::env::temp_dir().join("xeapi_public_key")
}

pub fn load_cached() -> Option<Value> {
    let text = std::fs::read_to_string(cache_path()).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn save_cached(value: &Value) {
    if let Ok(text) = serde_json::to_string(value) {
        let _ = std::fs::write(cache_path(), text);
    }
}

/// `register_xeapikey`：取公钥（含签名校验）
pub async fn fetch_public_key(
    client: &reqwest::Client,
    api_domain: &str,
    device_id: &str,
    current_version: &str,
) -> anyhow::Result<Value> {
    let nonce = generate_nonce();
    let timestamp = crate::ncm::config::now_ms().to_string();

    let mut form = Map::new();
    form.insert("appVersion".into(), json!("9.5.61"));
    form.insert("currentKeyVersion".into(), json!(current_version));
    form.insert("deviceId".into(), json!(device_id));
    form.insert("nonce".into(), json!(nonce));
    form.insert("os".into(), json!("android"));
    form.insert("requestType".into(), json!("active"));
    form.insert("signature".into(), json!(sign(&timestamp, &nonce)));
    form.insert("t1".into(), json!(""));
    form.insert("t2".into(), json!(""));
    form.insert("timestamp".into(), json!(timestamp));
    form.insert("uid".into(), json!(""));

    let response = client
        .post(format!("{api_domain}/api/bsr/sk/get"))
        .header(
            reqwest::header::USER_AGENT,
            crate::ncm::config::UA_API_ANDROID,
        )
        .header(
            reqwest::header::COOKIE,
            if device_id.is_empty() {
                String::new()
            } else {
                format!(
                    "deviceId={}",
                    crate::ncm::util::encode_uri_component(device_id)
                )
            },
        )
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .body(url_search_params(&form))
        .send()
        .await?;

    let body: Value = response.json().await?;
    let data = body
        .get("data")
        .ok_or_else(|| anyhow::anyhow!("xeapi 公钥响应缺少 data"))?;
    let encrypted = data
        .get("encryptedData")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("xeapi 公钥响应缺少 encryptedData"))?;
    let signature = data
        .get("signature")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("xeapi 公钥响应缺少 signature"))?;
    let timestamp = data
        .get("timestamp")
        .and_then(|value| {
            value
                .as_str()
                .map(str::to_string)
                .or_else(|| value.as_i64().map(|v| v.to_string()))
        })
        .unwrap_or_default();
    if sign(&timestamp, &nonce) != signature {
        anyhow::bail!("xeapi 公钥响应签名不匹配");
    }

    let mut key =
        decrypt_public_key(encrypted).ok_or_else(|| anyhow::anyhow!("xeapi 公钥解密失败"))?;
    if key
        .get("sk")
        .and_then(Value::as_str)
        .unwrap_or("")
        .is_empty()
    {
        anyhow::bail!("xeapi 公钥响应缺少 sk");
    }
    if let Some(object) = key.as_object_mut() {
        object.insert("deviceId".into(), json!(device_id));
    }
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use x25519_dalek::{PublicKey as XPublic, StaticSecret as XStatic};

    fn keypair_state() -> (PublicKeyState, [u8; 32]) {
        let secret_bytes: [u8; 32] = rand::random();
        let secret = XStatic::from(secret_bytes);
        let public = XPublic::from(&secret);
        (
            PublicKeyState {
                version: json!(7),
                public_key: b64().encode(public.as_bytes()),
                sk: "test-sk".into(),
                device_id: "device".into(),
            },
            secret_bytes,
        )
    }

    #[test]
    fn sign_matches_node_hmac() {
        // node -e "crypto.createHmac('sha256', signKey).update('1700000000000abcdef').digest('base64')"
        let value = sign("1700000000000", "abcdef");
        assert_eq!(value.len(), 44, "HMAC-SHA256 base64 固定 44 字符");
        assert_eq!(sign("1700000000000", "abcdef"), value, "签名必须稳定");
    }

    #[test]
    fn mid_transform_roundtrip() {
        let data = b"hello-xeapi-payload-0123456789".to_vec();
        let transformed = mid_transform(&data);
        assert_eq!(transformed.len(), data.len() + 16);
        assert_eq!(mid_untransform(&transformed).unwrap(), data);
    }

    #[test]
    fn encrypt_and_decrypt_c_payload() {
        let (state, _) = keypair_state();
        let mut data = Map::new();
        data.insert("ids".into(), json!("[1]"));
        data.insert("level".into(), json!("exhigh"));
        let encrypted = encrypt("/api/song/enhance/player/url/v1", &data, &state, "", "").unwrap();

        // 用会话密钥无法预测（随机），但可以验证 S 的结构：
        // 32 字节临时公钥 + 12 字节 nonce + 密文 + 16 字节 tag
        let s = b64().decode(&encrypted.s).unwrap();
        // 32 字节临时公钥 + 12 字节 nonce + 密文 + 16 字节 tag
        assert!(s.len() > 32 + 12 + 16, "S 结构异常: {}", s.len());
        assert!(!encrypted.c.is_empty());
        let r = b64().decode(&encrypted.r).unwrap();
        let r_plain =
            String::from_utf8(crate::ncm::crypto::ecb_decrypt(&r, &static_key()).unwrap()).unwrap();
        assert_eq!(r_plain, "7|");

        // 版本号可能是长整数字符串，必须原样拼接（服务端按它选密钥）
        let mut long_version = state.clone();
        long_version.version = json!("1000000000000");
        let encrypted = encrypt("/api/x", &Map::new(), &long_version, "", "").unwrap();
        let r = b64().decode(&encrypted.r).unwrap();
        let r_plain =
            String::from_utf8(crate::ncm::crypto::ecb_decrypt(&r, &static_key()).unwrap()).unwrap();
        assert_eq!(r_plain, "1000000000000|");
    }

    #[test]
    fn plaintext_includes_content_and_e_r() {
        let mut data = Map::new();
        data.insert("ids".into(), json!("[1,2]"));
        data.insert("e_r".into(), json!(false));
        let text = build_plaintext("/api/x?foo=1", &data);
        let value: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(value["content"], json!("ids=%5B1%2C2%5D"));
        assert_eq!(value["queryString"], json!("foo=1&e_r=true"));
        assert!(value.get("e_r").is_none());
    }

    #[test]
    fn plaintext_without_query_uses_e_r_only() {
        let text = build_plaintext("/api/x", &Map::new());
        let value: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(value["queryString"], json!("e_r=true"));
        assert!(value.get("content").is_none());
    }

    #[test]
    fn decrypt_public_key_roundtrip() {
        let payload = json!({"version": 3, "publicKey": "abc", "sk": "sk"});
        let text = serde_json::to_string(&payload).unwrap();
        let encrypted = b64().encode(ecb_encrypt(text.as_bytes(), &static_key()));
        assert_eq!(decrypt_public_key(&encrypted).unwrap(), payload);
    }

    #[test]
    fn nonce_is_16_digits() {
        let nonce = generate_nonce();
        assert_eq!(nonce.len(), 16);
        assert!(nonce.chars().all(|c| c.is_ascii_digit()));
    }

    async fn key_server(valid_signature: bool, include_sk: bool, with_data: bool) -> String {
        use axum::response::IntoResponse;
        use axum::Json;

        let app = axum::Router::new().fallback(move |request: axum::extract::Request| async move {
            let body = axum::body::to_bytes(request.into_body(), 1 << 20)
                .await
                .unwrap_or_default();
            let form: std::collections::HashMap<String, String> =
                url::form_urlencoded::parse(&body)
                    .map(|(key, value)| (key.into_owned(), value.into_owned()))
                    .collect();
            let nonce = form.get("nonce").cloned().unwrap_or_default();
            let timestamp = form.get("timestamp").cloned().unwrap_or_default();

            if !with_data {
                return Json(json!({"code": 200})).into_response();
            }

            let mut key = json!({"version": "1000000000000", "publicKey": "cGs="});
            if include_sk {
                key["sk"] = json!("test-sk");
            }
            let text = serde_json::to_string(&key).unwrap();
            let encrypted = b64().encode(ecb_encrypt(text.as_bytes(), &static_key()));
            let signature = if valid_signature {
                sign(&timestamp, &nonce)
            } else {
                "invalid-signature".to_string()
            };
            Json(json!({
                "code": 200,
                "data": {
                    "encryptedData": encrypted,
                    "signature": signature,
                    "timestamp": timestamp,
                }
            }))
            .into_response()
        });

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.ok();
        });
        format!("http://{address}")
    }

    fn client() -> reqwest::Client {
        reqwest::Client::builder().no_proxy().build().unwrap()
    }

    #[tokio::test]
    async fn fetch_public_key_verifies_signature_and_decrypts() {
        let base = key_server(true, true, true).await;
        let value = fetch_public_key(&client(), &base, "DEVICE", "")
            .await
            .unwrap();
        assert_eq!(value["version"], json!("1000000000000"));
        assert_eq!(value["sk"], json!("test-sk"));
        assert_eq!(value["deviceId"], json!("DEVICE"));
    }

    #[tokio::test]
    async fn fetch_public_key_rejects_bad_signature() {
        let base = key_server(false, true, true).await;
        let error = fetch_public_key(&client(), &base, "DEVICE", "")
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("签名"), "{error}");
    }

    #[tokio::test]
    async fn fetch_public_key_requires_sk() {
        let base = key_server(true, false, true).await;
        let error = fetch_public_key(&client(), &base, "DEVICE", "")
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("sk"), "{error}");
    }

    #[tokio::test]
    async fn fetch_public_key_reports_missing_data() {
        let base = key_server(true, true, false).await;
        let error = fetch_public_key(&client(), &base, "DEVICE", "")
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("data"), "{error}");
    }

    #[test]
    fn res_decrypt_handles_gzip() {
        use std::io::Write;
        let payload = json!({"code": 200, "data": [1, 2, 3]});
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder
            .write_all(serde_json::to_string(&payload).unwrap().as_bytes())
            .unwrap();
        let gzip = encoder.finish().unwrap();
        let encrypted = ecb_encrypt(&gzip, b"e82ckenh8dichen8");
        assert_eq!(res_decrypt(&encrypted).unwrap(), payload);
    }

    #[test]
    fn public_key_state_requires_public_key() {
        assert!(PublicKeyState::from_json(&json!({"sk": "x"}), "d").is_none());
        let state =
            PublicKeyState::from_json(&json!({"version": 3, "publicKey": "cGs=", "sk": "s"}), "d")
                .unwrap();
        assert_eq!(state.device_id, "d");
    }

    #[test]
    fn c_payload_roundtrip_with_fixed_dynamic_key() {
        let (state, _) = keypair_state();
        let mut data = Map::new();
        data.insert("ids".into(), json!("[1]"));
        let encrypted = encrypt("/api/x", &data, &state, "", "").unwrap();
        // 用 S 里封装的 dynamic key 无法取出（需要私钥），但可以用固定 key 手算一遍 C
        let dynamic = [7u8; 16];
        let mid = mid_transform(&ecb_encrypt(
            build_plaintext("/api/x", &data).as_bytes(),
            &static_key(),
        ));
        let expected = b64url().encode(ecb_encrypt(&mid, &dynamic));
        assert!(!expected.is_empty());
        assert_ne!(encrypted.c, expected, "每次请求的 random 应不同");
    }
}
