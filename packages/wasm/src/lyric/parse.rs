#![allow(non_snake_case)]
use super::model::{Lyric, LyricLine};
use crate::lyric::normalize::repair_lyric_lines;
use crate::lyric::utils::{split_lyric_as_lines, take_nearest_lyric_line};
use regex::Regex;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

/// 网易云的原文/翻译/音译经常存在几十到几百毫秒的时间轴偏移。
/// 这里不做严格 startTime 相等匹配，而是在较小窗口内找最近行，避免官方数据轻微错位时整行丢失。
const LYRIC_MATCH_TOLERANCE_MS: i32 = 300;

/// JS 侧调用的网易云歌词入口
///
/// `raw` 是主歌词，`ts` 是翻译，`rm` 是音译
/// 三者都已经由 JS 侧的 parser 转成相同的 `LyricLine` 结构后传进来
/// 这里负责把三份歌词按时间线合并成展示层模型
#[wasm_bindgen]
pub fn parseNeteaseLyric(raw: JsValue, ts: JsValue, rm: JsValue) -> JsValue {
    let raw_lyric = from_value::<Vec<LyricLine>>(raw).unwrap_or_default();
    let ts_lyric = from_value::<Vec<LyricLine>>(ts).unwrap_or_default();
    let rm_lyric = from_value::<Vec<LyricLine>>(rm).unwrap_or_default();

    to_value::<Lyric>(&parse_netease_lyric_lines(raw_lyric, ts_lyric, rm_lyric)).unwrap()
}

/// 合并原文、翻译、音译，并补齐派生信息。
///
/// 解析顺序：
/// 1. 先用容错时间匹配外部翻译/音译；
/// 2. 再解析主歌词里的行内翻译，行内翻译覆盖该行 `translatedLyric`；
/// 3. 最后统一更新空行、对唱、注音等额外标记。
fn parse_netease_lyric_lines(
    mut raw_lyric: Vec<LyricLine>,
    ts_lyric: Vec<LyricLine>,
    rm_lyric: Vec<LyricLine>,
) -> Lyric {
    if raw_lyric.is_empty() {
        return Lyric::default();
    }

    // 源数据（yrc/TTML）偶见异常时间轴，先修复再做翻译/音译的时间匹配。
    repair_lyric_lines(&mut raw_lyric);

    let raw_lyric_count = raw_lyric
        .iter()
        .filter(|line| !line.words.is_empty())
        .count();
    let mut ts_lyric_lines = split_lyric_as_lines(ts_lyric);
    let mut rm_lyric_lines = split_lyric_as_lines(rm_lyric);
    let mut rm_matched_count = 0;
    let mut tl_matched_count = 0;
    let mut inline_tl_matched_count = 0;

    // 对每一行记录“下一条非空原文”的时间。
    // 当翻译行同时接近当前行和下一行时，优先留给更近的那一行，避免提前消费下一行翻译。
    let mut next_raw_start_times = vec![None; raw_lyric.len()];
    let mut next_raw_start_time = None;
    for index in (0..raw_lyric.len()).rev() {
        next_raw_start_times[index] = next_raw_start_time;
        if !raw_lyric[index].words.is_empty() {
            next_raw_start_time = Some(raw_lyric[index].startTime);
        }
    }

    for (index, line) in raw_lyric.iter_mut().enumerate() {
        // 跳过空行
        if line.words.is_empty() {
            continue;
        }
        // 查找对应的翻译和罗马音。
        // `take_nearest_lyric_line` 会从候选列表中移除命中的行，保证重复时间戳也按顺序一一消费。
        line.translatedLyric = take_nearest_lyric_line(
            &mut ts_lyric_lines,
            line.startTime,
            next_raw_start_times[index],
            LYRIC_MATCH_TOLERANCE_MS,
        )
        .unwrap_or_default();
        line.romanLyric = take_nearest_lyric_line(
            &mut rm_lyric_lines,
            line.startTime,
            next_raw_start_times[index],
            LYRIC_MATCH_TOLERANCE_MS,
        )
        .unwrap_or_default();
        // 解析行内歌词，例如 `Hello (你好)` 或 `原文〖翻译〗`。
        // 这类翻译可能只出现在少数行，所以不能用全曲覆盖率阈值来决定是否存在翻译。
        if line.splice_inline_tl_lyric() {
            inline_tl_matched_count += 1;
        }

        if !line.translatedLyric.trim().is_empty() {
            tl_matched_count += 1;
        }
        if !line.romanLyric.trim().is_empty() {
            rm_matched_count += 1;
        }
    }

    let mut lyric = Lyric {
        data: raw_lyric
            .into_iter()
            .filter(|line| {
                !(line.words.is_empty()
                    && line.translatedLyric.is_empty()
                    && line.romanLyric.is_empty())
            })
            .collect(),
        noteExisted: false,
        rmExisted: is_extra_lyric_existed(rm_matched_count, raw_lyric_count),
        // 外部翻译用覆盖率判断；行内翻译只要解析出任意一行，就应该允许 UI 打开翻译展示。
        tlExisted: inline_tl_matched_count > 0
            || is_extra_lyric_existed(tl_matched_count, raw_lyric_count),
    };
    // 更新额外信息
    lyric.update_extra_info();

    lyric
}

fn is_extra_lyric_existed(matched_count: usize, raw_count: usize) -> bool {
    matched_count > 0 && matched_count * 2 >= raw_count.max(1)
}

/// 解析“翻译和原文交错写在同一个 LRC 文件里”的格式。
///
/// 常见形态是：
/// - 第 N 行：有时间戳、有原文，且 `startTime == endTime`；
/// - 第 N+1 行：同时间点开始，内容实际是翻译。
///
/// `reverse` 用于处理少数源文件里翻译和原文顺序反过来的情况。
#[wasm_bindgen]
pub fn parseTranslatedLRC(raw: JsValue, reverse: bool) -> JsValue {
    let mut lastMatchedIndex = -1;
    let parsedRawLRC = from_value::<Vec<LyricLine>>(raw).unwrap_or_default();
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
                        isBlank: None,
                        isBackChorus: None,
                        isBG: None,
                        isDuet: None,
                    };
                    if reverse {
                        newLine.romanLyric = parsedRawLRC[index + 1].romanLyric.clone();
                        newLine.words = parsedRawLRC[index + 1].words.clone();
                        newLine.translatedLyric =
                            rawLRC.words.clone().into_iter().map(|w| w.word).collect();
                    }

                    result.push(newLine);
                    lastMatchedIndex = index as i32 + 1;
                } else {
                    result.push(rawLRC.clone());
                }
            } else {
                lastMatchedIndex = -1;
            }
            result
        })
        .into_iter()
        .map(|mut l| {
            l.update_extra_info();
            l
        })
        .collect();

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
    use crate::lyric::model::{LyricLine, LyricWord};

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
                    inlineNote: None,
                    romanWord: None,
                }],
                startTime: 0,
                endTime: 0,
                romanLyric: "".into(),
                translatedLyric: "".into(),
                isBlank: None,
                isBackChorus: None,
                isBG: None,
                isDuet: None,
            };
            result.splice_inline_tl_lyric();
            println!("Input: '{}', \nResult: {:?} \n\n", input, result);
        }
    }

    #[test]
    fn test_extra_lyric_existed_requires_matched_line() {
        assert!(!is_extra_lyric_existed(0, 1));
        assert!(is_extra_lyric_existed(1, 1));
        assert!(is_extra_lyric_existed(2, 4));
        assert!(!is_extra_lyric_existed(1, 4));
    }

    #[test]
    fn test_sparse_inline_translation_marks_translation_existed() {
        let lyric = parse_netease_lyric_lines(
            vec![
                test_line(0, "Hello (你好)"),
                test_line(1000, "plain one"),
                test_line(2000, "plain two"),
                test_line(3000, "plain three"),
            ],
            vec![],
            vec![],
        );

        assert!(lyric.tlExisted);
        assert_eq!(lyric.data[0].words[0].word, "Hello");
        assert_eq!(lyric.data[0].translatedLyric, "你好");
    }

    fn test_line(start_time: i32, text: &str) -> LyricLine {
        LyricLine {
            words: vec![LyricWord {
                word: text.into(),
                startTime: start_time,
                endTime: start_time,
                inlineNote: None,
                romanWord: None,
            }],
            startTime: start_time,
            endTime: start_time,
            romanLyric: "".into(),
            translatedLyric: "".into(),
            isBlank: None,
            isBackChorus: None,
            isBG: None,
            isDuet: None,
        }
    }
}
