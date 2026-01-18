#![allow(non_snake_case)]
use super::model::{FullVersionLyricLine, LyricLine, LyricTranslatedMeta, RawLyricLine};
use regex::Regex;
use serde_wasm_bindgen::{from_value, to_value};
use std::collections::HashMap;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

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

    if raw.is_empty() {
        return to_value::<FullVersionLyricLine>(&FullVersionLyricLine {
            full: full_version,
            raw: raw_version,
            tl: tl_version,
            rm: rm_version,
        })
        .unwrap();
    }

    let timedTranslatedLyricMap = split_rawLyricLine_as_map(ts);
    let timedRomanLyricMap = split_rawLyricLine_as_map(rm);
    let shouldIgnoreInlineTranslated = raw
        .iter()
        .filter(|line| {
            parse_tl_lyric_inline(
                line.words
                    .iter()
                    .map(|l| l.word.clone())
                    .collect::<String>()
                    .as_str(),
            )
            .1
            .is_some()
        })
        .count()
        < raw.len() / 2;
    let hasTranslatedLyric = timedTranslatedLyricMap.len() >= raw.len() / 2;
    let hasRomanLyric = timedRomanLyricMap.len() >= raw.len() / 2;

    let mut total_line_words;
    let mut inline_tl;
    for mut line in raw.into_iter() {
        // 拼接整行歌词
        total_line_words = line
            .words
            .iter()
            .map(|l| l.word.clone())
            .collect::<String>();
        // 跳过空行
        if total_line_words.is_empty() {
            continue;
        }
        // 解析行内翻译
        inline_tl = if !shouldIgnoreInlineTranslated {
            // 解析行内翻译
            let (raw_without_inline_tl, _inline_tl) = parse_tl_lyric_inline(&total_line_words);
            // 移除行内翻译
            split_inline_tl_lyric(&mut line, &raw_without_inline_tl);
            _inline_tl
        } else {
            None
        };
        // 复制当前行用于不同版本
        let mut tl_line = line.clone();
        let mut rm_line = line.clone();
        raw_version.push(LyricLine::from(line.clone()));
        // 查找对应的翻译和罗马音
        let raw_translated_line = timedTranslatedLyricMap.get(&line.startTime);
        let raw_roman_line = timedRomanLyricMap.get(&line.startTime);
        // 如果有翻译或罗马音，则分别添加到对应的版本中
        if let Some(tl) = raw_translated_line {
            line.translatedLyric = tl.to_owned();
            tl_line.translatedLyric = tl.to_owned();
            tl_version.push(LyricLine::from(tl_line));
        } else if !shouldIgnoreInlineTranslated && let Some(inline_tl) = inline_tl {
            line.translatedLyric = inline_tl.clone();
            tl_line.translatedLyric = inline_tl.clone();
            tl_version.push(LyricLine::from(tl_line));
        } else if hasTranslatedLyric {
            // 有翻译，但是没有找到这行的翻译，则添加空行
            tl_line.translatedLyric = String::new();
            tl_version.push(LyricLine::from(tl_line));
        }

        if let Some(rl) = raw_roman_line {
            line.romanLyric = rl.to_owned();
            rm_line.romanLyric = rl.to_owned();
            rm_version.push(LyricLine::from(rm_line));
        } else if hasRomanLyric {
            // 有罗马音，但是没有找到这行的罗马音，则添加空行
            rm_line.romanLyric = String::new();
            rm_version.push(LyricLine::from(rm_line));
        }

        full_version.push(LyricLine::from(line));
    }

    if !meta.nickname.is_empty()
        && let Some(&LyricLine { endTime, .. }) = full_version.last()
    {
        let meta_line = LyricLine {
            startTime: endTime,
            endTime: endTime + 10000,
            words: vec![],
            isBG: false,
            isDuet: false,
            romanLyric: String::new(),
            translatedLyric: format!("歌词贡献者：{}", meta.nickname),
        };
        if !raw_version.is_empty() {
            raw_version.push(meta_line.clone());
        }
        if !full_version.is_empty() {
            full_version.push(meta_line.clone())
        }
        if !tl_version.is_empty() {
            tl_version.push(meta_line.clone());
        }
        if !rm_version.is_empty() {
            rm_version.push(meta_line);
        }
    }

    to_value::<FullVersionLyricLine>(&FullVersionLyricLine {
        full: full_version,
        raw: raw_version,
        tl: tl_version,
        rm: rm_version,
    })
    .unwrap()
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

/// 将 RawLyricLine 列表转换为 HashMap，键为 startTime，值为拼接后的歌词字符串
fn split_rawLyricLine_as_map(lines: Vec<RawLyricLine>) -> HashMap<i32, String> {
    if lines.is_empty() {
        HashMap::new()
    } else {
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
    }
}

/// 解析行内翻译歌词，返回 (原歌词, 翻译歌词)
fn parse_tl_lyric_inline(line: &str) -> (String, Option<String>) {
    const LYRIC_INLINE_SPLIT: [(&str, &str); 4] =
        [("〖", "〗"), ("【", "】"), ("[", "]"), ("(", ")")];

    let mut pattern = String::from(r"^(.*?)\s*(?:");
    for (i, (l, r)) in LYRIC_INLINE_SPLIT.iter().enumerate() {
        if i > 0 {
            pattern.push('|');
        }
        pattern.push_str(&format!("{}(.*?){}", regex::escape(l), regex::escape(r)));
    }
    pattern.push_str(r")\s*$");

    let re = Regex::new(&pattern).unwrap();

    if let Some(caps) = re.captures(line) {
        let before = caps.get(1).unwrap().as_str().trim();
        for i in 2..=caps.len() {
            if let Some(matched) = caps.get(i) {
                let after = matched.as_str().trim();
                if !after.is_empty() {
                    return (before.to_string(), Some(after.to_string()));
                }
            }
        }
        (before.to_string(), None)
    } else {
        (line.to_string(), None)
    }
}

/// 分离行内翻译歌词
fn split_inline_tl_lyric(raw: &mut RawLyricLine, line: &str) {
    if raw.words.len() == 1 {
        // 非逐字歌词
        raw.words[0].word = line.to_string();
    } else {
        // 逐字歌词，截断
        let mut count = line.chars().count() as i32;
        let mut words = vec![];
        for l in raw.words.iter() {
            count -= l.word.chars().count() as i32;
            if count >= 0 {
                words.push(l.clone());
            }
            // 截断最后一个词
            if count == 0 {
                // 刚好截断
                break;
            } else if count < 0 {
                // 需要截断
                let mut last_word = l.clone();
                let new_word_len = l.word.chars().count() as i32 + count;
                if new_word_len > 0 {
                    last_word.word = l
                        .word
                        .chars()
                        .take(new_word_len as usize)
                        .collect::<String>();
                    words.push(last_word);
                }
                break;
            }
        }
        raw.words = words;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
            let result = parse_tl_lyric_inline(input);
            println!("Input: '{}', Result: {:?}", input, result);
        }
    }
}
