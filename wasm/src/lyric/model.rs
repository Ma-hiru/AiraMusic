#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Tsify, Serialize, Deserialize, Debug, Clone)]
pub struct LyricWord {
    pub startTime: i32,
    pub endTime: i32,
    pub word: String,
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
}

#[derive(Tsify, Serialize, Default, Deserialize)]
pub struct Lyric {
    pub data: Vec<LyricLine>,
    pub rmExisted: bool,
    pub tlExisted: bool,
}
