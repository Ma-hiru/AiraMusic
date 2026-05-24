use super::model::{Lyric, LyricLine};
use regex::Regex;
use std::collections::HashMap;
use wasm_bindgen::prelude::wasm_bindgen;

/// 外部翻译/音译的中间结构。
///
/// 相比 HashMap，列表可以保留重复时间戳和原始顺序；这对网易云同一时间点多行翻译更稳。
#[derive(Debug, Clone)]
pub struct LyricTextLine {
    pub start_time: i32,
    pub text: String,
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

/// 将 `LyricLine` 列表转换为可按时间容错匹配的歌词行列表。
///
/// 空文本行不会参与匹配，否则 spacer 行会占用一次翻译/音译匹配机会。
/// 最后按 startTime 排序，后续可以稳定地从最近候选中取出一行。
pub fn split_lyric_as_lines(lines: Vec<LyricLine>) -> Vec<LyricTextLine> {
    let mut lines = lines
        .into_iter()
        .filter_map(
            |LyricLine {
                 startTime, words, ..
             }| {
                let text = words.into_iter().map(|w| w.word).collect::<String>();
                if text.trim().is_empty() {
                    None
                } else {
                    Some(LyricTextLine {
                        start_time: startTime,
                        text,
                    })
                }
            },
        )
        .collect::<Vec<LyricTextLine>>();
    lines.sort_by_key(|line| line.start_time);
    lines
}

/// 在容错窗口内取出最接近原文时间的翻译/音译行。
///
/// 命中后会从 `lines` 删除该候选，保证翻译行只能被消费一次。
/// `next_start_time` 用于保护下一条原文：如果某个候选更接近下一行，就留给下一行处理。
pub fn take_nearest_lyric_line(
    lines: &mut Vec<LyricTextLine>,
    start_time: i32,
    next_start_time: Option<i32>,
    tolerance: i32,
) -> Option<String> {
    let matched = lines
        .iter()
        .enumerate()
        .filter_map(|(index, line)| {
            let diff = (line.start_time - start_time).abs();
            if let Some(next_start_time) = next_start_time
                && (line.start_time - next_start_time).abs() < diff
            {
                return None;
            }
            (diff <= tolerance).then_some((index, diff))
        })
        .min_by_key(|(_, diff)| *diff)
        .map(|(index, _)| index);

    matched.map(|index| lines.remove(index).text)
}

#[wasm_bindgen]
pub struct IndexTuple {
    pub start: usize,
    pub end: usize,
}
impl From<(usize, usize)> for IndexTuple {
    fn from(value: (usize, usize)) -> Self {
        IndexTuple {
            start: value.0,
            end: value.1,
        }
    }
}
impl From<IndexTuple> for (usize, usize) {
    fn from(value: IndexTuple) -> Self {
        (value.start, value.end)
    }
}

/// 用于识别“对唱/转述”歌词的包裹符号。
///
/// 这里包含英文括号、中文括号、日文引号和中英文引号；只作为整行或跨行包裹判断，
/// 不参与日语注音识别，避免把注音括号和对唱括号混在一起。
const BACK_CHORUS_PREDICATE_CHARS: [(&str, &str); 11] = [
    ("[", "]"),
    ("(", ")"),
    ("（", "）"),
    ("【", "】"),
    ("〖", "〗"),
    ("「", "」"),
    ("『", "』"),
    ("\"", "\""),
    ("'", "'"),
    ("“", "”"),
    ("‘", "’"),
];

/// 行内注音只接受普通括号。
///
/// 其它括号如 `【】`、`〖〗` 在歌词里更常见于翻译或强调文本，不作为日语 ruby 注音候选。
const INLINE_NOTE_PREDICATE_CHARS: [(&str, &str); 2] = [("(", ")"), ("（", "）")];

/// 注音词在 `words` 中的闭区间。
///
/// 注音可能不只占一个 `LyricWord`，例如逐字歌词里 `（こ` 和 `え）` 被拆成两个词。
#[derive(Debug)]
struct InlineNoteRange {
    start: usize,
    end: usize,
}

#[wasm_bindgen]
pub struct LyricLineInfo;
#[wasm_bindgen]
impl LyricLineInfo {
    #[wasm_bindgen]
    #[allow(non_snake_case)]
    /// 判断一行是否为空行。
    pub fn isBlank(line: String) -> bool {
        line.trim().is_empty()
    }

    #[wasm_bindgen]
    #[allow(non_snake_case)]
    /// 判断单行是否被同一组括号/引号完整包裹。
    ///
    /// 这类行在 UI 中会被当作对唱或转述处理。只做首尾同组符号匹配，
    /// 不尝试解析嵌套括号，避免歌词文本里普通括号导致误判。
    pub fn isBackChorus(line: String) -> bool {
        let line = line.trim();
        Self::find_start_predicate(line, &BACK_CHORUS_PREDICATE_CHARS)
            .map(|(_, right)| line.ends_with(right))
            .unwrap_or(false)
    }

    #[wasm_bindgen]
    #[allow(non_snake_case)]
    /// 识别跨多行的对唱/转述段落。
    ///
    /// 例如第一行以 `「` 开头、第二行以 `」` 结尾时，返回两行的闭区间。
    /// 这里只保留一个打开中的区间，遇到匹配右符号就收束，防止跨段落过度吞行。
    pub fn isBackChorusWithMultiLine(lines: Vec<String>) -> Vec<IndexTuple> {
        let mut res: Vec<(usize, usize)> = vec![];
        let lines = lines
            .iter()
            .map(|l| l.trim().to_string())
            .collect::<Vec<String>>();

        let mut start: Option<(usize, &'static str)> = None;
        for (i, line) in lines.into_iter().enumerate() {
            if line.is_empty() {
                continue;
            }

            if let Some((start_index, right)) = start {
                if line.ends_with(right) {
                    res.push((start_index, i));
                    start = None;
                }
                continue;
            }

            if let Some((_, right)) =
                Self::find_start_predicate(&line, &BACK_CHORUS_PREDICATE_CHARS)
                && !line.ends_with(right)
            {
                start = Some((i, right));
            }
        }

        res.into_iter().map(From::from).collect()
    }

    #[wasm_bindgen]
    #[allow(non_snake_case)]
    /// 返回一行逐词歌词中的注音候选区间。
    ///
    /// 这是较浅的单行判断，不负责整首歌密度判定；整首歌是否启用注音由 `Lyric` 再判断。
    pub fn isInlineNote(words: Vec<String>) -> Vec<IndexTuple> {
        Self::inline_note_ranges(&words)
            .into_iter()
            .map(|range| (range.start, range.end).into())
            .collect()
    }

    pub fn match_predicate_chars(line: &str, start: bool, end: bool) -> bool {
        BACK_CHORUS_PREDICATE_CHARS
            .iter()
            .any(|(l, r)| (!start || line.starts_with(l)) && (!end || line.ends_with(r)))
    }

    /// 找到一行开头使用的左符号，并返回对应的右符号。
    ///
    /// 对唱和注音都需要“左符号决定右符号”，不能只检查任意右括号，
    /// 否则 `「歌词）` 这类不成对文本会被误判。
    fn find_start_predicate(
        line: &str,
        predicates: &'static [(&'static str, &'static str)],
    ) -> Option<(&'static str, &'static str)> {
        predicates
            .iter()
            .find(|(left, _)| line.starts_with(left))
            .copied()
    }

    /// 在一行逐词歌词中定位注音区间。
    ///
    /// 这里只负责找“形态上像注音”的括号片段；是否在整首歌里启用注音，
    /// 由 `Lyric::should_parse_inline_notes` 根据出现密度再做一次全局判断。
    fn inline_note_ranges(words: &[String]) -> Vec<InlineNoteRange> {
        let mut res = vec![];
        let mut start: Option<(usize, &'static str, &'static str)> = None;

        for (i, word) in words.iter().enumerate() {
            let word = word.trim();
            if word.is_empty() {
                continue;
            }

            if let Some((start_index, left, right)) = start {
                if word.ends_with(right) {
                    if Self::is_valid_inline_note(words, start_index, i, left, right) {
                        res.push(InlineNoteRange {
                            start: start_index,
                            end: i,
                        });
                    }
                    start = None;
                }
                continue;
            }

            // 注音可能在一个 word 内完整出现，也可能从当前 word 开始、在后续 word 结束。
            if let Some((left, right)) =
                Self::find_start_predicate(word, &INLINE_NOTE_PREDICATE_CHARS)
            {
                if word.ends_with(right) {
                    if Self::is_valid_inline_note(words, i, i, left, right) {
                        res.push(InlineNoteRange { start: i, end: i });
                    }
                } else {
                    start = Some((i, left, right));
                }
            }
        }

        res
    }

    fn is_valid_inline_note(
        words: &[String],
        start: usize,
        end: usize,
        left: &str,
        right: &str,
    ) -> bool {
        // 注音必须挂在前一个词上；行首括号文本更可能是普通歌词或转述，不当作 ruby。
        if start == 0 || words[start - 1].trim().is_empty() {
            return false;
        }

        let note = words[start..=end].join("");
        let note = note.trim();
        let note = note
            .strip_prefix(left)
            .unwrap_or(note)
            .strip_suffix(right)
            .unwrap_or(note)
            .trim();

        Self::is_inline_note_content(note)
    }

    /// 判断括号内部是否像日语假名注音。
    ///
    /// 只用字符比例做轻量判断，不引入分词或语言检测；目标是过滤翻译括号、
    /// “（笑）” 这类歌词标注，以及偶发括号说明。
    fn is_inline_note_content(note: &str) -> bool {
        let mut content_count = 0;
        let mut kana_count = 0;

        for ch in note.chars() {
            if ch.is_whitespace()
                || matches!(
                    ch,
                    '・' | '･' | '·' | '-' | '‐' | '、' | '。' | ',' | '.' | '/'
                )
            {
                continue;
            }
            content_count += 1;
            if Self::is_japanese_kana(ch) {
                kana_count += 1;
            }
        }

        // 注音允许少量分隔符或长音符号，但主体至少一半应是平假名/片假名。
        content_count > 0 && kana_count * 2 >= content_count
    }

    /// 判断字符是否属于常见平假名、片假名或片假名音标扩展区间。
    fn is_japanese_kana(ch: char) -> bool {
        matches!(
            ch,
            '\u{3040}'..='\u{309f}' | '\u{30a0}'..='\u{30ff}' | '\u{31f0}'..='\u{31ff}'
        )
    }
}

impl Lyric {
    /// 更新整首歌词的派生信息。
    ///
    /// 先重置每行的基础状态，再做跨行对唱和整首歌级别的注音判断。
    /// 这样多次调用保持幂等，不会因为上一次写入的 `inlineNote` 干扰本次判断。
    pub fn update_extra_info(&mut self) {
        for line in self.data.iter_mut() {
            line.update_line_info();
        }
        for (s, e) in self.is_back_chorus_with_multi_line() {
            for i in s..=e {
                self.data[i].isBackChorus = Some(true);
            }
        }
        if self.should_parse_inline_notes() {
            for line in self.data.iter_mut() {
                line.update_inline_notes();
            }
        }
        self.noteExisted = self
            .data
            .iter()
            .map(|line| &line.words)
            .any(|words| words.iter().any(|w| w.inlineNote.is_some()));
    }

    fn is_back_chorus_with_multi_line(&self) -> Vec<(usize, usize)> {
        LyricLineInfo::isBackChorusWithMultiLine(
            self.data
                .iter()
                .map(|l| l.line_to_string().trim().to_string())
                .collect::<Vec<String>>(),
        )
        .into_iter()
        .map(From::from)
        .collect()
    }

    fn should_parse_inline_notes(&self) -> bool {
        let mut line_count = 0;
        let mut candidate_line_count = 0;
        let mut candidate_count = 0;

        for line in &self.data {
            if line.is_blank() {
                continue;
            }
            line_count += 1;
            let candidates = LyricLineInfo::isInlineNote(
                line.words
                    .iter()
                    .map(|w| w.word.clone())
                    .collect::<Vec<String>>(),
            );
            if !candidates.is_empty() {
                candidate_line_count += 1;
                candidate_count += candidates.len();
            }
        }

        // 很短的歌词要求每行都像注音，避免只有一句括号说明时误开 ruby。
        if line_count <= 3 {
            return line_count > 0 && candidate_line_count == line_count && candidate_count >= 2;
        }

        // 普通长度歌词要求至少 3 行命中，且命中行数覆盖一半以上，才认为括号是系统性注音。
        candidate_line_count >= 3 && candidate_line_count * 2 >= line_count
    }
}

impl LyricLine {
    /// 分离行内翻译歌词。
    ///
    /// 支持 `原文〖翻译〗`、`原文【翻译】`、`原文[翻译]`、`原文(翻译)`。
    /// 返回值表示本行是否成功解析出行内翻译，调用方用它决定 `tlExisted` 是否应该打开。
    pub fn splice_inline_tl_lyric(&mut self) -> bool {
        let (line, inline) = self.get_inline_tl_lyric();
        if let Some(inline_tl) = inline {
            self.translatedLyric = inline_tl;
            if self.words.len() == 1 {
                // 非逐字歌词只需要直接替换整行文本。
                self.words[0].word = line;
            } else {
                // 逐字歌词需要按字符数截断 words，保留原文部分的时间轴。
                // 这样 UI 仍能逐词高亮原文，翻译则放到 translatedLyric 单独展示。
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
            return true;
        }
        false
    }

    /// 更新额外信息
    pub fn update_extra_info(&mut self) {
        self.update_line_info();
        self.update_inline_notes();
    }

    fn update_line_info(&mut self) {
        // 每次重算前先清空注音标记，保证重复调用不会残留旧状态。
        for word in self.words.iter_mut() {
            word.inlineNote = None;
        }
        self.isBlank = Some(self.is_blank());
        self.isBackChorus = Some(self.is_back_chorus());
    }

    fn update_inline_notes(&mut self) {
        let words = self
            .words
            .iter()
            .map(|w| w.word.clone())
            .collect::<Vec<String>>();
        let note_index = LyricLineInfo::inline_note_ranges(&words);

        // 注音内容保留在原始 word 中，只写 `inlineNote` 标记。
        // UI 层负责去掉显示用括号，避免模型被裁剪后再次解析失效。
        for range in note_index {
            for i in range.start..=range.end {
                self.words[i].inlineNote = Some(true);
            }
        }
    }

    pub fn line_to_string(&self) -> String {
        self.words
            .iter()
            .map(|w| w.word.clone())
            .collect::<String>()
    }

    /// 解析行内翻译歌词，返回 `(原歌词, 翻译歌词)`。
    ///
    /// 正则要求翻译括号在整行末尾，避免把歌词中间的普通括号误识别成翻译。
    /// 如果括号为空，只返回裁掉括号后的原文，不算成功解析翻译。
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

#[cfg(test)]
mod test {
    use crate::lyric::model::{Lyric, LyricLine, LyricWord};
    use crate::lyric::utils::{LyricLineInfo, split_lyric_as_lines, take_nearest_lyric_line};

    #[test]
    fn test_is_back_chorus() {
        assert!(LyricLineInfo::isBackChorus(" 「xxxxxx」 ".into()));
        assert!(LyricLineInfo::isBackChorus(" “xxxxxx” ".into()));
        assert!(!LyricLineInfo::isBackChorus(" 「xxxxxx） ".into()));
    }

    #[test]
    fn test_is_back_chorus_with_multi_line_pairs_in_order() {
        let result = LyricLineInfo::isBackChorusWithMultiLine(vec![
            "「first".into(),
            "second」".into(),
            "normal".into(),
            "（third".into(),
            "fourth）".into(),
        ]);

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].start, 0);
        assert_eq!(result[0].end, 1);
        assert_eq!(result[1].start, 3);
        assert_eq!(result[1].end, 4);
    }

    #[test]
    fn test_take_nearest_lyric_line_with_tolerance_and_duplicates() {
        let mut lines = split_lyric_as_lines(vec![
            test_line(1005, vec!["translated one"]),
            test_line(1005, vec!["translated duplicate"]),
            test_line(2500, vec!["translated two"]),
        ]);

        assert_eq!(
            take_nearest_lyric_line(&mut lines, 1000, None, 500),
            Some("translated one".into())
        );
        assert_eq!(
            take_nearest_lyric_line(&mut lines, 1000, None, 500),
            Some("translated duplicate".into())
        );
        assert_eq!(take_nearest_lyric_line(&mut lines, 1700, None, 500), None);
    }

    #[test]
    fn test_take_nearest_lyric_line_keeps_next_line_candidate() {
        let mut lines = split_lyric_as_lines(vec![test_line(1300, vec!["next line"])]);

        assert_eq!(
            take_nearest_lyric_line(&mut lines, 1000, Some(1400), 500),
            None
        );
        assert_eq!(
            take_nearest_lyric_line(&mut lines, 1400, None, 500),
            Some("next line".into())
        );
    }

    #[test]
    fn test_inline_note_requires_kana_content() {
        assert_eq!(
            LyricLineInfo::isInlineNote(vec!["声".into(), "（こえ）".into()]).len(),
            1
        );
        assert!(
            LyricLineInfo::isInlineNote(vec!["voice".into(), "(translation)".into()]).is_empty()
        );
        assert!(LyricLineInfo::isInlineNote(vec!["声".into(), "（笑）".into()]).is_empty());
    }

    #[test]
    fn test_inline_note_uses_document_density() {
        let mut lyric = Lyric {
            data: vec![
                test_line(0, vec!["声", "（こえ）"]),
                test_line(1000, vec!["花"]),
                test_line(2000, vec!["空"]),
                test_line(3000, vec!["風"]),
            ],
            rmExisted: false,
            tlExisted: false,
            noteExisted: false,
        };

        lyric.update_extra_info();
        assert!(!lyric.noteExisted);

        let mut lyric = Lyric {
            data: vec![
                test_line(0, vec!["声", "（こえ）"]),
                test_line(1000, vec!["花", "（はな）"]),
                test_line(2000, vec!["空", "（そら）"]),
                test_line(3000, vec!["風"]),
            ],
            rmExisted: false,
            tlExisted: false,
            noteExisted: false,
        };

        lyric.update_extra_info();
        assert!(lyric.noteExisted);
        assert_eq!(lyric.data[0].words[1].word, "（こえ）");
        assert_eq!(lyric.data[0].words[1].inlineNote, Some(true));

        lyric.update_extra_info();
        assert!(lyric.noteExisted);
        assert_eq!(lyric.data[0].words[1].word, "（こえ）");
        assert_eq!(lyric.data[0].words[1].inlineNote, Some(true));
    }

    fn test_line(start_time: i32, words: Vec<&str>) -> LyricLine {
        LyricLine {
            words: words
                .into_iter()
                .map(|word| LyricWord {
                    startTime: start_time,
                    endTime: start_time,
                    word: word.into(),
                    inlineNote: None,
                })
                .collect(),
            translatedLyric: "".into(),
            romanLyric: "".into(),
            startTime: start_time,
            endTime: start_time,
            isBlank: None,
            isBackChorus: None,
        }
    }
}
