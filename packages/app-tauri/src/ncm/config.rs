//! 1:1 复刻上游 `util/config.json` 与 `util/request.js` 里固化的常量表。
//!
//! 上游把这些值写在两处：
//! - `util/config.json` 的 `APP_CONF` / `resourceTypeMap`；
//! - `util/request.js` 顶部的 `osMap` / `userAgentMap` / `WNMCID` / `SPECIAL_STATUS_CODES`。
//!
//! 这里集中到一处，避免散落成「魔法字符串」后与上游脱节。

use std::sync::OnceLock;

/// `util/config.json` 的 `APP_CONF`
///
/// 有些字段（clientlog / 易盾域名 / clientSign）目前没有调用方，
/// 但保留完整结构，避免后续用到时又要回头对一遍源码。
#[allow(dead_code)]
pub struct AppConf {
    pub api_domain: &'static str,
    pub eapi_domain: &'static str,
    pub xeapi_domain: &'static str,
    pub neapi_domain: &'static str,
    pub domain: &'static str,
    pub cl_domain: &'static str,
    pub cl_domain3: &'static str,
    pub dun_domain_v3: &'static str,
    pub dun_static_domain: &'static str,
    /// `APP_CONF.encrypt`：为 true 时，未指定 crypto 的接口默认走 eapi
    pub encrypt: bool,
    /// `APP_CONF.encryptResponse`：`e_r` 的兜底值
    pub encrypt_response: bool,
    pub client_sign: &'static str,
    pub check_token: &'static str,
}

pub const APP_CONF: AppConf = AppConf {
    api_domain: "https://interface.music.163.com",
    eapi_domain: "https://interfacepc.music.163.com",
    xeapi_domain: "https://interface3.music.163.com",
    neapi_domain: "https://interface3.music.163.com",
    domain: "https://music.163.com",
    cl_domain: "https://clientlog.music.163.com",
    cl_domain3: "https://clientlog3.music.163.com",
    dun_domain_v3: "https://ac.dun.163yun.com",
    dun_static_domain: "https://acstatic-dun.126.net",
    encrypt: true,
    encrypt_response: false,
    client_sign: "18:C0:4D:B9:8F:FE@@@453832335F384641365F424635335F303030315F303031425F343434415F343643365F33363833@@@@@@6ff673ef74955b38bce2fa8562d95c976ed4758b1227c4e9ee345987cee17bc9",
    check_token: "9ca17ae2e6ffcda170e2e6ee8af14fbabdb988f225b3868eb2c15a879b9a83d274a790ac8ff54a97b889d5d42af0feaec3b92af58cff99c470a7eafd88f75e839a9ea7c14e909da883e83fb692a3abdb6b92adee9e",
};

/// `osMap` 的一条
pub struct OsProfile {
    pub os: &'static str,
    pub appver: &'static str,
    pub osver: &'static str,
    pub channel: &'static str,
}

pub const OS_PC: OsProfile = OsProfile {
    os: "pc",
    appver: "3.1.17.204416",
    osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
    channel: "netease",
};

pub const OS_LINUX: OsProfile = OsProfile {
    os: "linux",
    appver: "1.2.1.0428",
    osver: "Deepin 20.9",
    channel: "netease",
};

pub const OS_ANDROID: OsProfile = OsProfile {
    os: "android",
    appver: "8.20.20.231215173437",
    osver: "14",
    channel: "xiaomi",
};

pub const OS_IPHONE: OsProfile = OsProfile {
    os: "iPhone OS",
    appver: "9.0.90",
    osver: "16.2",
    channel: "distribution",
};

pub const OS_OSX: OsProfile = OsProfile {
    os: "osx",
    appver: "3.1.10.5100",
    osver: "15.5",
    channel: "netease",
};

/// `osMap[cookie.os] || osMap.pc`
pub fn os_profile(key: &str) -> &'static OsProfile {
    match key {
        "linux" => &OS_LINUX,
        "android" => &OS_ANDROID,
        "iphone" => &OS_IPHONE,
        "osx" => &OS_OSX,
        _ => &OS_PC,
    }
}

pub const UA_WEAPI_PC: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
pub const UA_LINUXAPI_LINUX: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36";
pub const UA_API_PC: &str = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.29.205117";
pub const UA_API_ANDROID: &str = "NeteaseMusic/9.5.61.260802021928(9005061);Dalvik/2.1.0 (Linux; U; Android 12; HBN-AL00 Build/cd737a2.0)";
pub const UA_API_IPHONE: &str = "NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)";
/// eapi 分支里 `cookie.os === 'osx'` 的特例 UA（注意没有 `Edg/`）
pub const UA_EAPI_OSX: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/// `chooseUserAgent(crypto, uaType)`
pub fn choose_user_agent(crypto: &str, ua_type: &str) -> &'static str {
    match (crypto, ua_type) {
        ("weapi", _) => UA_WEAPI_PC,
        ("linuxapi", _) => UA_LINUXAPI_LINUX,
        ("api", "android") => UA_API_ANDROID,
        ("api", "iphone") => UA_API_IPHONE,
        ("api", _) => UA_API_PC,
        _ => "",
    }
}

/// 进程级 `WNMCID`：`<6 位小写字母>.<毫秒时间戳>.01.0`，只生成一次
pub fn wnmcid() -> &'static str {
    static VALUE: OnceLock<String> = OnceLock::new();
    VALUE.get_or_init(|| {
        let random: String = (0..6)
            .map(|_| (b'a' + rand::random_range(0..26u8)) as char)
            .collect();
        let stamp = now_ms();
        format!("{random}.{stamp}.01.0")
    })
}

/// 这些业务码被当作 200 处理：客户端要靠 body 里的 code 判断，而不是 HTTP 状态
pub const SPECIAL_STATUS_CODES: [u16; 8] = [201, 302, 400, 502, 800, 801, 802, 803];

pub fn is_special_status(code: u16) -> bool {
    SPECIAL_STATUS_CODES.contains(&code)
}

/// `util/config.json` 的 `resourceTypeMap`：评论等接口的 `type` → 资源前缀
pub fn resource_type_prefix(kind: &str) -> Option<&'static str> {
    match kind {
        "0" => Some("R_SO_4_"),
        "1" => Some("R_MV_5_"),
        "2" => Some("A_PL_0_"),
        "3" => Some("R_AL_3_"),
        "4" => Some("A_DJ_1_"),
        "5" => Some("R_VI_62_"),
        "6" => Some("A_EV_2_"),
        "7" => Some("A_DR_14_"),
        _ => None,
    }
}

pub fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0)
}

pub fn now_secs() -> u64 {
    (now_ms() / 1000) as u64
}
