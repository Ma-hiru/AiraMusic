#![allow(non_snake_case)]
use super::model::{Lyric, LyricLine};
use crate::lyric::utils::split_lyric_as_map;
use regex::Regex;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[wasm_bindgen]
pub fn parseNeteaseLyric(raw: JsValue, ts: JsValue, rm: JsValue) -> JsValue {
    let mut raw_lyric = from_value::<Vec<LyricLine>>(raw).unwrap_or_default();
    if raw_lyric.is_empty() {
        return to_value::<Lyric>(&Lyric::default()).unwrap();
    }

    let mut ts_lyric_map = split_lyric_as_map(from_value::<Vec<LyricLine>>(ts).unwrap_or_default());
    let mut rm_lyric_map = split_lyric_as_map(from_value::<Vec<LyricLine>>(rm).unwrap_or_default());
    let rmExisted = rm_lyric_map.len() >= raw_lyric.len() / 2;
    let tlExisted = ts_lyric_map.len() >= raw_lyric.len() / 2;

    for line in raw_lyric.iter_mut() {
        // 跳过空行
        if line.words.is_empty() {
            continue;
        }
        // 查找对应的翻译和罗马音
        line.translatedLyric = ts_lyric_map.remove(&line.startTime).unwrap_or_default();
        line.romanLyric = rm_lyric_map.remove(&line.startTime).unwrap_or_default();
        // 解析行内歌词
        line.splice_inline_tl_lyric();
    }

    to_value::<Lyric>(&Lyric {
        data: raw_lyric,
        rmExisted,
        tlExisted,
    })
    .unwrap()
}

#[wasm_bindgen]
pub fn parseTranslatedLRC(raw: JsValue, reverse: bool) -> JsValue {
    let parsedRawLRC = from_value::<Vec<LyricLine>>(raw).unwrap_or_default();
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
                    let mut newLine = LyricLine {
                        startTime: rawLRC.startTime,
                        endTime: parsedRawLRC[index + 1].endTime,
                        translatedLyric: parsedRawLRC[index + 1]
                            .words
                            .clone()
                            .into_iter()
                            .map(|w| w.word)
                            .collect(),
                        romanLyric: rawLRC.romanLyric.clone(),
                        words: rawLRC.words.clone(),
                    };
                    if reverse {
                        newLine.romanLyric = parsedRawLRC[index + 1].romanLyric.clone();
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
            result
        });

    to_value::<Vec<LyricLine>>(&result).unwrap()
}

/// 解析额外信息歌词
/// eg: [00:00.00-1] 作曲 : solfa \n
#[wasm_bindgen]
pub fn parseExternalLrc(lyric: String) -> String {
    let re = Regex::new(r"\[(\d{2}):(\d{2}\.\d{1,3})-\d+]").unwrap();
    re.replace_all(&lyric, "[$1:$2]").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lyric::model::LyricWord;

    #[test]
    fn test_parse_tl_lyric_inline() {
        let cases = vec![
            "Hello World 〖你好，世界〗",
            "Good Morning 【早上好】",
            "Welcome [欢迎]",
            "Thank you (谢谢)",
            "No Translation Here",
            "Mixed (混合) Text 【文本】",
            "Empty () Brackets",
            "Just Text",
            "   Leading and Trailing   【前后空格】   ",
            "[03:17.230]flight 旅立つ朝 あの日背伸びしてた肩に〖flight 启程之晨 在你那天逞强的肩膀上〗",
        ];

        for input in cases {
            let mut result = LyricLine {
                words: vec![LyricWord {
                    word: input.into(),
                    startTime: 0,
                    endTime: 0,
                }],
                startTime: 0,
                endTime: 0,
                romanLyric: "".into(),
                translatedLyric: "".into(),
            };
            result.splice_inline_tl_lyric();
            println!("Input: '{}', \nResult: {:?} \n\n", input, result);
        }
    }
}
