#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Tsify, Serialize, Deserialize, Default)]
pub struct LyricTranslatedMeta {
    pub nickname: String,
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
pub struct RawLyricWord {
    pub startTime: i32,
    pub endTime: i32,
    pub word: String,
    pub romanWord: String,
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
pub struct RawLyricLine {
    pub words: Vec<RawLyricWord>,
    pub translatedLyric: String,
    pub romanLyric: String,
    pub isBG: bool,
    pub isDuet: bool,
    pub startTime: i32,
    pub endTime: i32,
}

#[derive(Tsify, Serialize, Deserialize)]
pub struct LyricWord {
    pub startTime: i32,
    pub endTime: i32,
    pub word: String,
    pub romanWord: String,
    pub obscene: bool,
}

#[derive(Tsify, Serialize, Deserialize)]
pub struct LyricLine {
    pub words: Vec<LyricWord>,
    pub translatedLyric: String,
    pub romanLyric: String,
    pub isBG: bool,
    pub isDuet: bool,
    pub startTime: i32,
    pub endTime: i32,
}

impl From<RawLyricLine> for LyricLine {
    fn from(value: RawLyricLine) -> Self {
        let RawLyricLine {
            words,
            translatedLyric,
            romanLyric,
            isBG,
            isDuet,
            startTime,
            endTime,
        } = value;
        LyricLine {
            words: words
                .into_iter()
                .map(
                    |RawLyricWord {
                         startTime,
                         endTime,
                         word,
                         romanWord,
                     }| LyricWord {
                        startTime,
                        endTime,
                        word,
                        romanWord,
                        obscene: false,
                    },
                )
                .collect(),
            translatedLyric,
            romanLyric,
            isBG,
            isDuet,
            startTime,
            endTime,
        }
    }
}
