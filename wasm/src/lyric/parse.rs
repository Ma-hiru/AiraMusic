#![allow(non_snake_case)]
use crate::lyric::model::{FullVersionLyricLine, LyricLine, LyricTranslatedMeta, RawLyricLine};
use serde_wasm_bindgen::{from_value, to_value};
use std::collections::HashMap;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
pub fn parseNeteaseLyric(raw: JsValue, ts: JsValue, rm: JsValue, meta: JsValue) -> JsValue {
    let raw = from_value::<Vec<RawLyricLine>>(raw).unwrap_or_default();
    let ts = from_value::<Vec<RawLyricLine>>(ts).unwrap_or_default();
    let rm = from_value::<Vec<RawLyricLine>>(rm).unwrap_or_default();
    let meta = from_value::<LyricTranslatedMeta>(meta).unwrap_or_default();
    let mut full_version: Vec<LyricLine> = vec![];
    let mut raw_version: Vec<LyricLine> = vec![];
    let mut tl_version: Vec<LyricLine> = vec![];
    let mut rm_version: Vec<LyricLine> = vec![];

    if !raw.is_empty() {
        let mut timedTranslatedLyricMap = get_rawLyricLine_map(ts);
        let mut timedRomanLyricMap = get_rawLyricLine_map(rm);
        full_version = raw
            .into_iter()
            .map(|mut line| {
                raw_version.push(LyricLine::from(line.clone()));
                let translatedLine = timedTranslatedLyricMap.remove(&line.startTime);
                let romanLine = timedRomanLyricMap.remove(&line.startTime);
                let mut tl_line = line.clone();
                let mut rm_line = line.clone();
                if let Some(tl) = translatedLine {
                    line.translatedLyric = tl.clone();
                    tl_line.translatedLyric = tl;
                    tl_version.push(LyricLine::from(tl_line));
                }

                if let Some(rl) = romanLine {
                    line.romanLyric = rl.clone();
                    rm_line.romanLyric = rl;
                    rm_version.push(LyricLine::from(rm_line));
                }
                LyricLine::from(line)
            })
            .collect();
        if !meta.nickname.is_empty() {
            if let Some(&LyricLine { endTime, .. }) = full_version.last() {
                full_version.push(LyricLine {
                    startTime: endTime,
                    endTime: endTime + 10000,
                    words: vec![],
                    isBG: false,
                    isDuet: false,
                    romanLyric: String::new(),
                    translatedLyric: format!("歌词贡献者：{}", meta.nickname),
                })
            }
        }
    }

    let result = FullVersionLyricLine {
        full: full_version,
        raw: raw_version,
        tl: tl_version,
        rm: rm_version,
    };
    to_value::<FullVersionLyricLine>(&result).unwrap()
}

#[wasm_bindgen]
pub fn parseTranslatedLRC(raw: JsValue, reverse: bool) -> JsValue {
    let parsedRawLRC = from_value::<Vec<RawLyricLine>>(raw).unwrap_or_default();
    let mut lastMatchedIndex = -1;
    let result = parsedRawLRC
        .iter()
        .enumerate()
        .fold(vec![], |mut result, (index, rawLRC)| {
            if lastMatchedIndex != index as i32 {
                if rawLRC.startTime == rawLRC.endTime
                    && parsedRawLRC.len() - 1 > index + 1
                    && parsedRawLRC[index + 1].startTime == rawLRC.endTime
                {
                    let mut newLine = RawLyricLine {
                        startTime: rawLRC.startTime,
                        endTime: parsedRawLRC[index + 1].endTime,
                        translatedLyric: parsedRawLRC[index + 1]
                            .words
                            .clone()
                            .into_iter()
                            .map(|w| w.word)
                            .collect(),
                        romanLyric: rawLRC.romanLyric.clone(),
                        isBG: rawLRC.isBG,
                        isDuet: rawLRC.isDuet,
                        words: rawLRC.words.clone(),
                    };
                    if reverse {
                        newLine.romanLyric = parsedRawLRC[index + 1].romanLyric.clone();
                        newLine.isBG = parsedRawLRC[index + 1].isBG;
                        newLine.isDuet = parsedRawLRC[index + 1].isDuet;
                        newLine.words = parsedRawLRC[index + 1].words.clone();
                        newLine.translatedLyric =
                            rawLRC.words.clone().into_iter().map(|w| w.word).collect();
                    }

                    result.push(LyricLine::from(newLine));
                    lastMatchedIndex = index as i32 + 1;
                } else {
                    result.push(LyricLine::from(rawLRC.clone()));
                }
            } else {
                lastMatchedIndex = -1;
            }
            return result;
        });

    to_value::<Vec<LyricLine>>(&result).unwrap()
}

#[inline]
fn get_rawLyricLine_map(lines: Vec<RawLyricLine>) -> HashMap<i32, String> {
    (!lines.is_empty())
        .then(|| {
            lines
                .into_iter()
                .map(
                    |RawLyricLine {
                         startTime, words, ..
                     }| {
                        (
                            startTime,
                            words.into_iter().map(|w| w.word).collect::<String>(),
                        )
                    },
                )
                .collect()
        })
        .unwrap_or(HashMap::new())
}
