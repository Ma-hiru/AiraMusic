//! 1:1 复刻上游 `util/crypto.js`。
//!
//! 覆盖 weapi / linuxapi / eapi 三条链路（也是 `ncmModDef.ts` 里实际用到的全部方式）：
//! - `weapi`：AES-128-CBC 两层 + 无填充 raw RSA
//! - `linuxapi`：AES-128-ECB + hex
//! - `eapi`：`nobody<uri>use<json>md5forencrypt` 摘要后 AES-128-ECB + hex
//!
//! 上游同一份文件里还有 xeapi / neapi，它们的密钥需要另行注册下发，
//! 属于"按需增加的加密通道"，本文件保留了 es 层所依赖的 AES/hex 原语以便后续补齐。

use aes::cipher::generic_array::GenericArray;
use aes::cipher::{BlockDecrypt, BlockEncrypt, KeyInit};
use aes::{Aes128, Aes256};
use base64::Engine;
use md5::{Digest, Md5};
use num_bigint::BigUint;
use serde_json::Value;

use crate::ncm::util::random_base62_index;

const IV: &[u8] = b"0102030405060708";
const PRESET_KEY: &[u8] = b"0CoJUm6Qyw8W8jud";
const LINUXAPI_KEY: &[u8] = b"rFgB&h#%2?^eDg:Q";
const EAPI_KEY: &[u8] = b"e82ckenh8dichen8";
const BASE62: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
pub const EAPI_SEPARATOR: &str = "-36cd479b6b5-";

/// weapi 的 RSA 公钥模数（node-forge 的 `encrypt(str, 'NONE')`，即无填充 raw RSA）
const RSA_MODULUS_HEX: &str = "e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
const RSA_EXPONENT: u32 = 65537;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AesMode {
    Cbc,
    Ecb,
}

#[allow(dead_code)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AesOutput {
    Base64,
    HexUpper,
}

fn pkcs7_pad(data: &mut Vec<u8>, block: usize) {
    let padding = block - data.len() % block;
    data.extend(std::iter::repeat_n(padding as u8, padding));
}

fn pkcs7_unpad(data: &mut Vec<u8>) -> Option<()> {
    let padding = *data.last()? as usize;
    if padding == 0 || padding > 16 || padding > data.len() {
        return None;
    }
    if !data[data.len() - padding..]
        .iter()
        .all(|byte| *byte as usize == padding)
    {
        return None;
    }
    data.truncate(data.len() - padding);
    Some(())
}

fn aes_encrypt_block(block: &[u8], key: &[u8]) -> Option<Vec<u8>> {
    let mut buffer = GenericArray::clone_from_slice(block);
    match key.len() {
        32 => Aes256::new_from_slice(key).ok()?.encrypt_block(&mut buffer),
        16 => Aes128::new_from_slice(key).ok()?.encrypt_block(&mut buffer),
        _ => return None,
    }
    Some(buffer.to_vec())
}

fn aes_decrypt_block(block: &[u8], key: &[u8]) -> Option<Vec<u8>> {
    let mut buffer = GenericArray::clone_from_slice(block);
    match key.len() {
        32 => Aes256::new_from_slice(key).ok()?.decrypt_block(&mut buffer),
        16 => Aes128::new_from_slice(key).ok()?.decrypt_block(&mut buffer),
        _ => return None,
    }
    Some(buffer.to_vec())
}

/// AES-ECB + PKCS7，返回原始字节
pub fn ecb_encrypt(data: &[u8], key: &[u8]) -> Vec<u8> {
    let mut padded = data.to_vec();
    pkcs7_pad(&mut padded, 16);
    let mut out = Vec::with_capacity(padded.len());
    for chunk in padded.chunks(16) {
        match aes_encrypt_block(chunk, key) {
            Some(block) => out.extend_from_slice(&block),
            None => return Vec::new(),
        }
    }
    out
}

/// AES-ECB 解密（去 PKCS7）
pub fn ecb_decrypt(data: &[u8], key: &[u8]) -> Option<Vec<u8>> {
    if data.is_empty() || !data.len().is_multiple_of(16) {
        return None;
    }
    let mut out = Vec::with_capacity(data.len());
    for chunk in data.chunks(16) {
        out.extend_from_slice(&aes_decrypt_block(chunk, key)?);
    }
    pkcs7_unpad(&mut out)?;
    Some(out)
}

/// AES-CBC + PKCS7，返回原始字节
pub fn cbc_encrypt(data: &[u8], key: &[u8], iv: &[u8]) -> Vec<u8> {
    let mut padded = data.to_vec();
    pkcs7_pad(&mut padded, 16);
    let mut previous = iv.to_vec();
    let mut out = Vec::with_capacity(padded.len());
    for chunk in padded.chunks(16) {
        let xored: Vec<u8> = chunk.iter().zip(&previous).map(|(a, b)| a ^ b).collect();
        let Some(block) = aes_encrypt_block(&xored, key) else {
            return Vec::new();
        };
        out.extend_from_slice(&block);
        previous = block;
    }
    out
}

/// `aesEncrypt(text, mode, key, iv, format)`
pub fn aes_encrypt(text: &str, mode: AesMode, key: &[u8], iv: &[u8], output: AesOutput) -> String {
    let raw = match mode {
        AesMode::Cbc => cbc_encrypt(text.as_bytes(), key, iv),
        AesMode::Ecb => ecb_encrypt(text.as_bytes(), key),
    };
    match output {
        AesOutput::Base64 => base64::engine::general_purpose::STANDARD.encode(raw),
        AesOutput::HexUpper => hex::encode_upper(raw),
    }
}

/// `aesDecrypt(ciphertext, mode, key, iv, 'hex')`
pub fn aes_decrypt_hex(cipher_hex: &str, mode: AesMode, key: &[u8], iv: &[u8]) -> Option<Vec<u8>> {
    let raw = hex::decode(cipher_hex).ok()?;
    match mode {
        AesMode::Ecb => ecb_decrypt(&raw, key),
        AesMode::Cbc => {
            if raw.is_empty() || !raw.len().is_multiple_of(16) {
                return None;
            }
            let mut out = Vec::with_capacity(raw.len());
            let mut previous = iv.to_vec();
            for chunk in raw.chunks(16) {
                let block = aes_decrypt_block(chunk, key)?;
                out.extend(block.iter().zip(&previous).map(|(a, b)| a ^ b));
                previous = chunk.to_vec();
            }
            pkcs7_unpad(&mut out)?;
            Some(out)
        }
    }
}

/// `rsaEncrypt(str, publicKey)`：无填充 raw RSA，输出定长 hex
pub fn rsa_raw_hex(data: &[u8]) -> String {
    let modulus = BigUint::parse_bytes(RSA_MODULUS_HEX.as_bytes(), 16).expect("modulus");
    let exponent = BigUint::from(RSA_EXPONENT);
    let message = BigUint::from_bytes_be(data);
    let encrypted = message.modpow(&exponent, &modulus);

    let length = modulus.bits().div_ceil(8) as usize;
    let mut padded = vec![0u8; length];
    let bytes = encrypted.to_bytes_be();
    if bytes.len() <= length {
        padded[length - bytes.len()..].copy_from_slice(&bytes);
    }
    hex::encode(padded)
}

pub struct WeapiParams {
    pub params: String,
    pub enc_sec_key: String,
}

/// `weapi(object)`：用随机 16 位 base62 密钥做第二层 CBC
pub fn weapi(object: &Value) -> WeapiParams {
    let secret: String = (0..16)
        .map(|_| BASE62[random_base62_index()] as char)
        .collect();
    weapi_with_secret(object, &secret)
}

/// 固定密钥版本，便于测试逐字节对照
pub fn weapi_with_secret(object: &Value, secret: &str) -> WeapiParams {
    let text = serde_json::to_string(object).unwrap_or_default();
    let first = aes_encrypt(&text, AesMode::Cbc, PRESET_KEY, IV, AesOutput::Base64);
    let params = aes_encrypt(
        &first,
        AesMode::Cbc,
        secret.as_bytes(),
        IV,
        AesOutput::Base64,
    );
    let reversed: String = secret.chars().rev().collect();
    WeapiParams {
        params,
        enc_sec_key: rsa_raw_hex(reversed.as_bytes()),
    }
}

/// `linuxapi(object)`：`{ method, url, params }` 整体 ECB，输出大写 hex
pub fn linuxapi(object: &Value) -> String {
    let text = serde_json::to_string(object).unwrap_or_default();
    hex::encode_upper(ecb_encrypt(text.as_bytes(), LINUXAPI_KEY))
}

/// `eapi(url, object)`：摘要 + ECB，输出大写 hex
pub fn eapi(uri: &str, object: &Value) -> String {
    let text = serde_json::to_string(object).unwrap_or_default();
    let message = format!("nobody{uri}use{text}md5forencrypt");
    let digest = hex::encode(Md5::digest(message.as_bytes()));
    let payload = format!("{uri}{EAPI_SEPARATOR}{text}{EAPI_SEPARATOR}{digest}");
    hex::encode_upper(ecb_encrypt(payload.as_bytes(), EAPI_KEY))
}

/// `eapiResDecrypt(encryptedParams, aeapi)`：`aeapi` 为真时先 gunzip
pub fn eapi_res_decrypt(encrypted_hex: &str, aeapi: bool) -> Option<Value> {
    let decrypted = aes_decrypt_hex(encrypted_hex, AesMode::Ecb, EAPI_KEY, b"")?;
    let plain = if aeapi {
        use std::io::Read;
        let mut decoder = flate2::read::GzDecoder::new(decrypted.as_slice());
        let mut out = Vec::new();
        decoder.read_to_end(&mut out).ok()?;
        out
    } else {
        decrypted
    };
    serde_json::from_slice(&plain).ok()
}

/// `eapiReqDecrypt(encryptedParams)`：返回 (url, data)
#[allow(dead_code)] // 由测试与调试工具使用
pub fn eapi_req_decrypt(encrypted_hex: &str) -> Option<(String, Value)> {
    let decrypted = aes_decrypt_hex(encrypted_hex, AesMode::Ecb, EAPI_KEY, b"")?;
    let text = String::from_utf8(decrypted).ok()?;
    let (url, rest) = text.split_once(EAPI_SEPARATOR)?;
    let (body, _digest) = rest.rsplit_once(EAPI_SEPARATOR)?;
    Some((url.to_string(), serde_json::from_str(body).ok()?))
}

/// `decrypt(cipher)`：eapi 密文 → 明文
#[allow(dead_code)] // 由测试使用
pub fn decrypt(cipher_hex: &str) -> Option<String> {
    let raw = hex::decode(cipher_hex).ok()?;
    if raw.is_empty() || !raw.len().is_multiple_of(16) {
        return None;
    }
    let mut out = Vec::with_capacity(raw.len());
    for chunk in raw.chunks(16) {
        out.extend_from_slice(&aes_decrypt_block(chunk, EAPI_KEY)?);
    }
    // CryptoJS 的 AES.decrypt 默认会去掉 PKCS7 填充
    let _ = pkcs7_unpad(&mut out);
    Some(String::from_utf8_lossy(&out).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn eapi_matches_js_implementation() {
        let uri = "/api/v1/album/123";
        let object = json!({ "id": "123", "n": "1000" });
        let params = eapi(uri, &object);

        // 与 `node -e "require('./util/crypto').eapi(...)"` 的输出逐字节一致
        let expected = "C08D8A30DE63387284C62D226FE6397F3FFC4F019921F2BDF0D37D4CB84916CB\
E1E851B86001A8E7B923A555C074D97A80F587669AE40D92B9DEEB943961EE54FF95FF0C0190C11B19FFCA0\
21CE2B8584E514AE57C9A9A203930227DDEA073475972E863CD112B9FCB424522504A3805";
        assert_eq!(params, expected.replace(['\n', ' '], ""));
    }

    #[test]
    fn eapi_req_decrypt_roundtrip() {
        let uri = "/api/song/enhance/player/url";
        let object = json!({ "ids": "[1,2]", "br": 320000 });
        let params = eapi(uri, &object);
        let (url, data) = eapi_req_decrypt(&params).expect("decrypt");
        assert_eq!(url, uri);
        assert_eq!(data, object);
    }

    #[test]
    fn eapi_res_decrypt_without_gzip() {
        let object = json!({"code": 200, "data": [{"id": 1}]});
        let text = serde_json::to_string(&object).unwrap();
        let encrypted = hex::encode_upper(ecb_encrypt(text.as_bytes(), EAPI_KEY));
        assert_eq!(eapi_res_decrypt(&encrypted, false), Some(object));
    }

    #[test]
    fn eapi_res_decrypt_with_gzip() {
        use std::io::Write;
        let text = br#"{"code":200,"ok":true}"#;
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(text).unwrap();
        let gzip = encoder.finish().unwrap();
        let encrypted = hex::encode_upper(ecb_encrypt(&gzip, EAPI_KEY));
        assert_eq!(
            eapi_res_decrypt(&encrypted, true),
            Some(json!({"code": 200, "ok": true}))
        );
    }

    #[test]
    fn eapi_res_decrypt_rejects_garbage() {
        assert_eq!(eapi_res_decrypt("zz", false), None);
        assert_eq!(eapi_res_decrypt("00", false), None);
    }

    #[test]
    fn linuxapi_matches_js_implementation() {
        let object =
            json!({"method": "POST", "url": "https://music.163.com/api/x", "params": {"a": 1}});
        let params = linuxapi(&object);
        let plain = ecb_decrypt(&hex::decode(&params).unwrap(), LINUXAPI_KEY).unwrap();
        assert_eq!(
            String::from_utf8(plain).unwrap(),
            serde_json::to_string(&object).unwrap()
        );
        assert!(params.chars().all(|c| !c.is_ascii_lowercase()));
    }

    #[test]
    fn weapi_roundtrip_with_fixed_secret() {
        let object = json!({ "s": "测试", "limit": "30" });
        let secret = "abcdefghijklmnop";
        let result = weapi_with_secret(&object, secret);

        // params 两层 CBC 可逆
        let raw = base64::engine::general_purpose::STANDARD
            .decode(&result.params)
            .unwrap();
        let mut previous = IV.to_vec();
        let mut inner = Vec::new();
        for chunk in raw.chunks(16) {
            let block = aes_decrypt_block(chunk, secret.as_bytes()).unwrap();
            inner.extend(block.iter().zip(&previous).map(|(a, b)| a ^ b));
            previous = chunk.to_vec();
        }
        pkcs7_unpad(&mut inner).unwrap();
        let inner_b64 = String::from_utf8(inner).unwrap();

        let raw = base64::engine::general_purpose::STANDARD
            .decode(inner_b64)
            .unwrap();
        let mut previous = IV.to_vec();
        let mut outer = Vec::new();
        for chunk in raw.chunks(16) {
            let block = aes_decrypt_block(chunk, PRESET_KEY).unwrap();
            outer.extend(block.iter().zip(&previous).map(|(a, b)| a ^ b));
            previous = chunk.to_vec();
        }
        pkcs7_unpad(&mut outer).unwrap();
        assert_eq!(
            String::from_utf8(outer).unwrap(),
            serde_json::to_string(&object).unwrap()
        );
    }

    #[test]
    fn weapi_enc_sec_key_matches_js_for_fixed_secret() {
        // node-forge: pki.publicKeyFromPem(PUBLIC_KEY).encrypt('ponmlkjihgfedcba', 'NONE')
        let expected = "d15a1683c992095d0c234c19966605c5c5964911268bbeda8cb8d08d834913e59d53b32358903a121b5fca784c1f5ae44951fd02524df58ecc98e52cc7cf8689b42c2e93ddf05b0592512d87f5960467e2f086c018849d76014d323500e30f13ef4cafbb0cf5a66731a3f1776c75ca35d0062dac70a3e33245afabcf47938487";
        let result = weapi_with_secret(&json!({"a": 1}), "abcdefghijklmnop");
        assert_eq!(result.enc_sec_key, expected);
    }

    #[test]
    fn decrypt_reads_eapi_plaintext() {
        let object = json!({"code": 200});
        let text = serde_json::to_string(&object).unwrap();
        let encrypted = hex::encode_upper(ecb_encrypt(text.as_bytes(), EAPI_KEY));
        assert_eq!(decrypt(&encrypted).unwrap(), text);
    }
}
