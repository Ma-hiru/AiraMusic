#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Tsify, Serialize, Deserialize, Debug, Clone)]
pub struct LyricWord {
    pub startTime: i32,
    pub endTime: i32,
    pub word: String,
    pub inlineNote: Option<bool>,
    /// AMLL 解析结果中的可选字段，原样透传，避免歌词经过 wasm 往返时丢失数据。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub romanWord: Option<String>,
}

#[derive(Tsify, Serialize, Deserialize, Debug, Clone)]
pub struct LyricLine {
    pub words: Vec<LyricWord>,
    pub translatedLyric: String,
    pub romanLyric: String,
    pub startTime: i32,
    pub endTime: i32,
    pub isBlank: Option<bool>,
    pub isBackChorus: Option<bool>,
    /// TTML 背景和声标记（AMLL parseTTML 产出），原样透传给 JS 侧使用。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub isBG: Option<bool>,
    /// TTML 对唱标记（AMLL parseTTML 产出），原样透传给 JS 侧使用。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub isDuet: Option<bool>,
}

#[derive(Tsify, Serialize, Default, Deserialize)]
pub struct Lyric {
    pub data: Vec<LyricLine>,
    pub rmExisted: bool,
    pub tlExisted: bool,
    pub noteExisted: bool,
}
