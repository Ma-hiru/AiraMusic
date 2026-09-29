use super::model::{LyricLine, LyricWord};

/// 逐字来源至少有一行包含多个独立计时的词；不把 LRC 的整行词当作单字注音。
pub fn has_word_timing(lines: &[LyricLine]) -> bool {
    lines.iter().any(|line| {
        let mut words = line.words.iter().filter(|word| is_timed_word(word));
        let Some(first) = words.next() else {
            return false;
        };
        words.any(|word| word.startTime != first.startTime)
    })
}

fn is_timed_word(word: &LyricWord) -> bool {
    word.inlineNote != Some(true) && !word.word.trim().is_empty() && word.endTime > word.startTime
}

/// 只补充原文的 romanWord，不改变原文分词、时间和已有注音。
/// 一个汉字可覆盖多个音节；跨词、等分歧义或时间缺失时留空，不推测读音。
pub fn fill_roman_words(raw: &mut [LyricWord], roman: &[LyricWord]) {
    let mut roman: Vec<_> = roman.iter().filter(|word| is_timed_word(word)).collect();
    roman.sort_by_key(|word| word.startTime);
    let mut groups = vec![String::new(); raw.len()];
    let mut previous_index = 0;

    for syllable in roman {
        let mut best = None;
        let mut best_overlap = 0i64;
        let mut ambiguous = false;
        for (index, word) in raw
            .iter()
            .enumerate()
            .filter(|(_, word)| is_timed_word(word))
        {
            let overlap = (i64::from(word.endTime.min(syllable.endTime))
                - i64::from(word.startTime.max(syllable.startTime)))
            .max(0);
            if overlap > best_overlap {
                best = Some(index);
                best_overlap = overlap;
                ambiguous = false;
            } else if overlap == best_overlap && overlap > 0 {
                ambiguous = true;
            }
        }
        let duration = i64::from(syllable.endTime) - i64::from(syllable.startTime);
        // 允许毫秒级边界误差，但至少 80% 的音节时长应落在同一个原文词内。
        if let Some(index) = best
            && !ambiguous
            && best_overlap * 5 >= duration * 4
            && index >= previous_index
        {
            groups[index].push_str(&syllable.word);
            previous_index = index;
        }
    }

    for (word, text) in raw.iter_mut().zip(groups) {
        if word
            .romanWord
            .as_ref()
            .is_some_and(|text| !text.trim().is_empty())
        {
            continue;
        }
        let text = text.trim();
        if !text.is_empty() {
            word.romanWord = Some(text.to_owned());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(text: &str, start: i32, end: i32) -> LyricWord {
        LyricWord {
            word: text.into(),
            startTime: start,
            endTime: end,
            inlineNote: None,
            romanWord: None,
        }
    }

    #[test]
    fn combines_syllables_and_tolerates_one_millisecond_boundary_drift() {
        let mut raw = vec![word("渚", 1000, 1600), word("を", 1600, 1800)];
        fill_roman_words(
            &mut raw,
            &[
                word("na ", 1000, 1200),
                word("gi ", 1200, 1400),
                word("sa ", 1400, 1600),
                word("wo ", 1599, 1799),
            ],
        );
        assert_eq!(raw[0].romanWord.as_deref(), Some("na gi sa"));
        assert_eq!(raw[1].romanWord.as_deref(), Some("wo"));
        assert_eq!((raw[0].startTime, raw[0].endTime), (1000, 1600));
    }

    #[test]
    fn skips_ambiguous_cross_word_syllables_and_missing_timing() {
        let mut raw = vec![word("ち", 1000, 1100), word("ゃ", 1100, 1200)];
        fill_roman_words(
            &mut raw,
            &[
                word("cha", 1000, 1200),
                word("zero", 1100, 1100),
                word("outside", 1300, 1400),
            ],
        );
        assert!(raw.iter().all(|word| word.romanWord.is_none()));
    }

    #[test]
    fn preserves_existing_roman_and_excludes_inline_notes_and_spaces() {
        let mut raw = vec![
            word("声", 1000, 1200),
            word("（こえ）", 1000, 1200),
            word(" ", 1200, 1300),
        ];
        raw[0].romanWord = Some("koe".into());
        raw[1].inlineNote = Some(true);
        fill_roman_words(
            &mut raw,
            &[word("ko e ", 1000, 1200), word("space", 1200, 1300)],
        );
        assert_eq!(raw[0].romanWord.as_deref(), Some("koe"));
        assert!(raw[1].romanWord.is_none());
        assert!(raw[2].romanWord.is_none());
    }
}
