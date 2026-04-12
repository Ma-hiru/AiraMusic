use super::model::{Lyric, LyricLine};
use regex::Regex;
use std::collections::HashMap;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct LyricLineInfo;

#[wasm_bindgen]
impl LyricLineInfo {
    #[wasm_bindgen]
    #[allow(non_snake_case)]
    pub fn isBlank(line: String) -> bool {
        line.trim().is_empty()
    }

    #[wasm_bindgen]
    #[allow(non_snake_case)]
    pub fn isBackChorus(line: String) -> bool {
        Self::match_back_chorus(line.trim(), true, true)
    }

    pub fn match_back_chorus(line: &str, start: bool, end: bool) -> bool {
        const PREDICT_CHARS: [(&str, &str); 9] = [
            ("[", "]"),
            ("(", ")"),
            ("（", "）"),
            ("【", "】"),
            ("〖", "〗"),
            ("「", "」"),
            ("『", "』"),
            ("\"", "\""),
            ("'", "'"),
        ];

        PREDICT_CHARS
            .iter()
            .any(|(l, r)| (!start || line.starts_with(l)) && (!end || line.ends_with(r)))
    }
}

/// 将 RawLyricLine 列表转换为 HashMap，键为 startTime，值为拼接后的歌词字符串
pub fn split_lyric_as_map(lines: Vec<LyricLine>) -> HashMap<i32, String> {
    if lines.is_empty() {
        HashMap::new()
    } else {
        lines
            .into_iter()
            .map(
                |LyricLine {
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

impl LyricLine {
    /// 分离行内翻译歌词
    pub fn splice_inline_tl_lyric(&mut self) {
        let (line, inline) = self.get_inline_tl_lyric();
        if let Some(inline_tl) = inline {
            self.translatedLyric = inline_tl;
            if self.words.len() == 1 {
                // 非逐字歌词
                self.words[0].word = line;
            } else {
                // 逐字歌词，截断
                let mut count = line.chars().count() as i32;
                let mut words = vec![];

                for l in &self.words {
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

                self.words = words;
            }
        }
    }

    /// 更新额外信息
    pub fn update_extra_info(&mut self) {
        self.isBlank = Some(self.is_blank());
        self.isBackChorus = Some(self.is_back_chorus());
    }

    pub fn line_to_string(&self) -> String {
        self.words
            .iter()
            .map(|w| w.word.clone())
            .collect::<String>()
    }

    /// 解析行内翻译歌词，返回 (原歌词, 翻译歌词)
    fn get_inline_tl_lyric(&self) -> (String, Option<String>) {
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
        let line = self
            .words
            .iter()
            .map(|l| l.word.clone())
            .collect::<String>();

        if let Some(caps) = re.captures(&line) {
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
            (line, None)
        }
    }

    fn is_back_chorus(&self) -> bool {
        LyricLineInfo::isBackChorus(self.words.iter().map(|w| w.word.clone()).collect())
    }

    fn is_blank(&self) -> bool {
        LyricLineInfo::isBlank(self.words.iter().map(|w| w.word.clone()).collect())
    }
}

impl Lyric {
    pub fn update_extra_info(&mut self) {
        for line in self.data.iter_mut() {
            line.update_extra_info();
        }
        for (s, e) in self.is_back_chorus_with_multi_line() {
            for i in s..=e {
                self.data[i].isBackChorus = Some(true);
            }
        }
    }

    fn is_back_chorus_with_multi_line(&self) -> Vec<(usize, usize)> {
        let lines = self
            .data
            .iter()
            .map(|l| l.line_to_string().trim().to_string())
            .collect::<Vec<String>>();
        let mut res: Vec<(usize, usize)> = vec![];

        let mut start = std::collections::VecDeque::new();
        let mut end = std::collections::VecDeque::new();
        for (i, line) in lines.into_iter().enumerate() {
            if LyricLineInfo::match_back_chorus(&line, true, false)
                && !LyricLineInfo::match_back_chorus(&line, false, true)
            {
                start.push_back(i);
            } else if !LyricLineInfo::match_back_chorus(&line, true, false)
                && LyricLineInfo::match_back_chorus(&line, false, true)
            {
                end.push_back(i);
            }
        }

        while !start.is_empty() && !end.is_empty() {
            let s = start.pop_back().unwrap();
            let e = end.pop_front().unwrap();
            if s < e {
                res.push((s, e));
            }
        }

        res
    }
}

#[cfg(test)]
mod test {
    use crate::lyric::utils::LyricLineInfo;

    #[test]
    fn test_is_back_chorus() {
        assert!(LyricLineInfo::isBackChorus(" 「xxxxxx」 ".into()))
    }
}
