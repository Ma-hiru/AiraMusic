//! 菜单栏歌词时间轴：`packages/app/src/lib/tray/menu-lyric.ts` 的 1:1 移植。
//!
//! 解析规则对齐 ui 的 `TimeManager`：先归一化（排序、修正行结束时间），
//! 再按「当前时间 <= 行结束时间」回看多行找同时激活的行，最后取主歌词行。
//!
//! 与 JS 版的差异仅在于**不做按对象的缓存**：Rust 侧每次换歌都会重新解析，
//! 而 `bus_deliver_track_progress` 每秒数十次的回调不会触发解析（走 `resolve` 的只读路径）。

use serde_json::Value;

/// 无歌词时的占位行
pub const BLANK_LYRIC_TEXT: &str = "（音乐）";
/// 行时间轴缺失时的兜底时长
pub const FALLBACK_LINE_MS: f64 = 4000.0;
/// 与 ui 的 TimeManager 一致：最多回看多少行去找同时激活的行
const ACTIVE_LOOKBACK: usize = 5;

/// 菜单栏胶囊中的逐字歌词单元，时间相对行首（ms）。
#[derive(Clone, Debug, PartialEq)]
pub struct MenuLyricWord {
    pub start_ms: f64,
    pub end_ms: f64,
    pub text: String,
}

/// 交给原生绘制的一行歌词
#[derive(Clone, Debug, PartialEq)]
pub struct MenuLyricLine {
    pub text: String,
    /// 行起始时间，用作切行去重 key
    pub start_time: f64,
    /// 逐字时间轴，时间为相对行首的毫秒；空数组表示静态文本
    pub words: Vec<MenuLyricWord>,
}

#[derive(Clone, Debug)]
struct NormalizedWord {
    text: String,
    end_ms: f64,
    start_ms: f64,
    inline_note: bool,
}

/// 归一化后的一行
#[derive(Clone, Debug)]
struct TimelineLine {
    text: String,
    end_time: f64,
    start_time: f64,
    words: Vec<MenuLyricWord>,
    /// 背景/和声行（对唱、TTML 背景），单行展示时让位给主歌词
    background: bool,
}

/// 整首歌的时间轴（只读）
pub struct MenuLyricTimeline {
    lines: Vec<TimelineLine>,
}

impl MenuLyricTimeline {
    pub fn new(lyric: Option<&Value>) -> Self {
        let data = lyric
            .and_then(|lyric| lyric.get("data"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        Self {
            lines: normalize_lines(&data),
        }
    }

    /// 取 `time_ms` 时刻应显示的那一行
    pub fn resolve(&self, time_ms: f64) -> Option<MenuLyricLine> {
        let index = self.find_primary_line(time_ms)?;
        let line = self.lines.get(index)?;
        if line.text.is_empty() {
            return Some(MenuLyricLine {
                start_time: line.start_time,
                text: BLANK_LYRIC_TEXT.to_string(),
                words: Vec::new(),
            });
        }
        Some(MenuLyricLine {
            start_time: line.start_time,
            text: line.text.clone(),
            words: line.words.clone(),
        })
    }

    /// 同时激活的行里取主歌词：优先非背景行，并列时取最晚开始的那一行；
    /// 时间落在两行空档时沿用上一行（与 TimeManager 一致）
    fn find_primary_line(&self, time_ms: f64) -> Option<usize> {
        if self.lines.is_empty() {
            return None;
        }
        let last_active = self.find_last_index_by_start_time(time_ms)?;

        let mut active: Vec<usize> = Vec::new();
        let mut miss = 0usize;
        let mut index = last_active as isize;
        while index >= 0 {
            if miss >= ACTIVE_LOOKBACK {
                break;
            }
            let current = &self.lines[index as usize];
            if time_ms <= current.end_time {
                active.push(index as usize);
            } else {
                miss += 1;
            }
            index -= 1;
        }

        if active.is_empty() {
            return Some(last_active);
        }
        active.reverse();
        // 取最晚开始的非背景行
        let primary = active
            .iter()
            .rev()
            .find(|&&item| !self.lines[item].background);
        primary.copied().or_else(|| active.last().copied())
    }

    fn find_last_index_by_start_time(&self, time_ms: f64) -> Option<usize> {
        let mut left = 0usize;
        let mut right = self.lines.len() as isize - 1;
        let mut result: Option<usize> = None;
        while (left as isize) <= right {
            let mid = (left + right as usize) / 2;
            if self.lines[mid].start_time <= time_ms {
                result = Some(mid);
                left = mid + 1;
            } else {
                right = mid as isize - 1;
            }
        }
        result
    }
}

/// 便捷入口：`resolveMenuLyricLine`（JS 版同名导出；宿主侧走带缓存的时间轴，
/// 这里是给测试与一次性解析用）
#[allow(dead_code)]
pub fn resolve_menu_lyric_line(lyric: Option<&Value>, time_ms: f64) -> Option<MenuLyricLine> {
    MenuLyricTimeline::new(lyric).resolve(time_ms)
}

fn normalize_lines(source: &[Value]) -> Vec<TimelineLine> {
    let mut sorted: Vec<&Value> = source.iter().collect();
    sorted.sort_by(|a, b| {
        number(a, "startTime")
            .partial_cmp(&number(b, "startTime"))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let starts: Vec<f64> = sorted
        .iter()
        .map(|line| number(line, "startTime"))
        .collect();

    sorted
        .iter()
        .enumerate()
        .map(|(index, line)| {
            let start_time = starts[index];
            let words = normalize_words(line, start_time);
            let duration = resolve_line_duration(line, &words, starts.get(index + 1).copied());
            let menu_words = to_menu_words(&words, duration);
            let end = number(line, "endTime");

            TimelineLine {
                start_time,
                end_time: if end > start_time {
                    end
                } else {
                    start_time + duration
                },
                // 文本必须由词表拼出，原生按词宽累计的高亮边界才与字形一致
                text: menu_words.iter().map(|word| word.text.as_str()).collect(),
                words: menu_words,
                background: boolean(line, "isBG") || boolean(line, "isBackChorus"),
            }
        })
        .collect()
}

/// 词级时间轴：排序后折算成相对行首
fn normalize_words(line: &Value, line_start: f64) -> Vec<NormalizedWord> {
    let mut words: Vec<&Value> = line
        .get("words")
        .and_then(Value::as_array)
        .map(|items| items.iter().collect())
        .unwrap_or_default();
    words.sort_by(|a, b| {
        number(a, "startTime")
            .partial_cmp(&number(b, "startTime"))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    words
        .into_iter()
        .map(|word| {
            let start = number(word, "startTime");
            let end = number(word, "endTime");
            NormalizedWord {
                start_ms: (start - line_start).max(0.0),
                end_ms: (end - line_start).max(0.0),
                text: word
                    .get("word")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                inline_note: boolean(word, "inlineNote"),
            }
        })
        .collect()
}

fn resolve_line_duration(
    line: &Value,
    words: &[NormalizedWord],
    next_start_time: Option<f64>,
) -> f64 {
    let start = number(line, "startTime");
    let end = number(line, "endTime");
    if end > start {
        return (end - start).max(400.0);
    }
    if let Some(next) = next_start_time {
        if next > start {
            return (next - start).max(400.0);
        }
    }
    let last_word_end = words.last().map(|word| word.end_ms).unwrap_or(0.0);
    last_word_end.max(400.0).max(FALLBACK_LINE_MS)
}

/// 剔除注音、裁掉行首尾空白，并给单一时间轴补出可推进的区间
fn to_menu_words(words: &[NormalizedWord], duration_ms: f64) -> Vec<MenuLyricWord> {
    let mut kept: Vec<MenuLyricWord> = words
        .iter()
        .filter(|word| !word.inline_note)
        .map(|word| MenuLyricWord {
            start_ms: word.start_ms,
            end_ms: word.end_ms,
            text: word.text.clone(),
        })
        .collect();

    // 行首尾空白会让原生累计出来的高亮宽度比实际文本长
    if let Some(first) = kept.first_mut() {
        first.text = first.text.trim_start().to_string();
    }
    if let Some(last) = kept.last_mut() {
        last.text = last.text.trim_end().to_string();
    }

    let trimmed: Vec<MenuLyricWord> = kept
        .into_iter()
        .filter(|word| !word.text.is_empty())
        .collect();

    // 逐行时间轴（LRC）没有词级信息：铺满整行做一次匀速推进
    if trimmed.len() == 1 {
        let only = &trimmed[0];
        if only.end_ms <= only.start_ms {
            return vec![MenuLyricWord {
                start_ms: 0.0,
                end_ms: duration_ms,
                text: only.text.clone(),
            }];
        }
    }
    trimmed
}

fn number(source: &Value, key: &str) -> f64 {
    source.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}

fn boolean(source: &Value, key: &str) -> bool {
    source.get(key).and_then(Value::as_bool).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn word(text: &str, start: f64, end: f64) -> Value {
        json!({ "word": text, "startTime": start, "endTime": end })
    }

    fn line(start: f64, end: f64, words: Vec<Value>) -> Value {
        json!({
            "startTime": start,
            "endTime": end,
            "words": words,
            "translatedLyric": "",
            "romanLyric": "",
        })
    }

    fn lyric(lines: Vec<Value>) -> Value {
        json!({
            "data": lines,
            "rmExisted": false,
            "tlExisted": false,
            "noteExisted": false,
        })
    }

    #[test]
    fn converts_word_times_to_line_relative() {
        let model = lyric(vec![line(
            10_000.0,
            13_000.0,
            vec![
                word("沿着", 10_000.0, 10_800.0),
                word("城市", 10_800.0, 11_500.0),
                word("向前", 11_500.0, 13_000.0),
            ],
        )]);

        let result = resolve_menu_lyric_line(Some(&model), 11_000.0).expect("应有歌词");

        assert_eq!(result.start_time, 10_000.0);
        assert_eq!(result.text, "沿着城市向前");
        assert_eq!(
            result.words,
            vec![
                MenuLyricWord {
                    start_ms: 0.0,
                    end_ms: 800.0,
                    text: "沿着".into()
                },
                MenuLyricWord {
                    start_ms: 800.0,
                    end_ms: 1500.0,
                    text: "城市".into()
                },
                MenuLyricWord {
                    start_ms: 1500.0,
                    end_ms: 3000.0,
                    text: "向前".into()
                },
            ]
        );
    }

    #[test]
    fn drops_inline_notes_and_trims_edges() {
        let model = lyric(vec![line(
            0.0,
            2000.0,
            vec![
                word(" 君", 0.0, 400.0),
                json!({ "word": "の", "startTime": 400.0, "endTime": 600.0, "inlineNote": true }),
                word("名", 600.0, 1000.0),
                word("は ", 1000.0, 2000.0),
            ],
        )]);

        let result = resolve_menu_lyric_line(Some(&model), 500.0).expect("应有歌词");

        assert_eq!(result.text, "君名は");
        assert_eq!(
            result
                .words
                .iter()
                .map(|item| item.text.as_str())
                .collect::<Vec<_>>(),
            vec!["君", "名", "は"]
        );
        assert_eq!(
            result
                .words
                .iter()
                .map(|item| item.start_ms)
                .collect::<Vec<_>>(),
            vec![0.0, 600.0, 1000.0]
        );
    }

    #[test]
    fn single_timeline_fills_whole_line() {
        let model = lyric(vec![
            line(
                5000.0,
                5000.0,
                vec![word("一句没有逐词时间的歌词", 5000.0, 5000.0)],
            ),
            line(9000.0, 12_000.0, vec![word("下一行", 9000.0, 12_000.0)]),
        ]);

        let result = resolve_menu_lyric_line(Some(&model), 6000.0).expect("应有歌词");

        assert_eq!(
            result.words,
            vec![MenuLyricWord {
                start_ms: 0.0,
                end_ms: 4000.0,
                text: "一句没有逐词时间的歌词".into()
            }]
        );
    }

    #[test]
    fn blank_line_becomes_static_placeholder() {
        let model = lyric(vec![line(0.0, 3000.0, vec![word("   ", 0.0, 3000.0)])]);

        let result = resolve_menu_lyric_line(Some(&model), 1000.0).expect("应有歌词");

        assert_eq!(result.start_time, 0.0);
        assert_eq!(result.text, BLANK_LYRIC_TEXT);
        assert!(result.words.is_empty());
    }

    #[test]
    fn picks_last_line_and_returns_none_before_first() {
        let model = lyric(vec![
            line(1000.0, 2000.0, vec![word("第一行", 1000.0, 2000.0)]),
            line(2000.0, 4000.0, vec![word("第二行", 2000.0, 4000.0)]),
        ]);

        assert_eq!(
            resolve_menu_lyric_line(Some(&model), 2500.0).map(|line| line.text),
            Some("第二行".to_string())
        );
        assert!(resolve_menu_lyric_line(Some(&model), 999.0).is_none());
        assert!(resolve_menu_lyric_line(None, 1000.0).is_none());
        assert!(resolve_menu_lyric_line(Some(&lyric(vec![])), 1000.0).is_none());
    }

    #[test]
    fn missing_line_duration_uses_next_start() {
        let model = lyric(vec![
            line(0.0, 0.0, vec![word("第一行", 0.0, 0.0)]),
            line(2500.0, 5000.0, vec![word("第二行", 2500.0, 5000.0)]),
        ]);

        let result = resolve_menu_lyric_line(Some(&model), 500.0).expect("应有歌词");

        assert_eq!(
            result.words,
            vec![MenuLyricWord {
                start_ms: 0.0,
                end_ms: 2500.0,
                text: "第一行".into()
            }]
        );
    }

    #[test]
    fn sorts_out_of_order_lines_and_words() {
        let model = lyric(vec![
            line(2000.0, 4000.0, vec![word("第二行", 2000.0, 4000.0)]),
            line(
                1000.0,
                2000.0,
                vec![word("后", 800.0, 1000.0), word("先", 0.0, 800.0)],
            ),
        ]);

        let first = resolve_menu_lyric_line(Some(&model), 1500.0).expect("应有歌词");

        assert_eq!(first.start_time, 1000.0);
        assert_eq!(first.text, "先后");
        assert_eq!(
            first
                .words
                .iter()
                .map(|item| item.text.as_str())
                .collect::<Vec<_>>(),
            vec!["先", "后"]
        );
        assert_eq!(
            resolve_menu_lyric_line(Some(&model), 2500.0).map(|line| line.text),
            Some("第二行".to_string())
        );
    }

    #[test]
    fn background_line_yields_to_primary() {
        let mut bg = line(2000.0, 5000.0, vec![word("和声", 2000.0, 5000.0)]);
        bg["isBackChorus"] = json!(true);
        let model = lyric(vec![
            line(1000.0, 5000.0, vec![word("主歌词", 1000.0, 5000.0)]),
            bg,
        ]);

        // 时间落在两行区间内，主歌词行先开始、和声行后开始，仍取主歌词
        assert_eq!(
            resolve_menu_lyric_line(Some(&model), 3000.0).map(|line| line.text),
            Some("主歌词".to_string())
        );
        // 主歌词行结束后只剩和声行在区间内
        assert_eq!(
            resolve_menu_lyric_line(Some(&model), 6000.0).map(|line| line.text),
            Some("和声".to_string())
        );
    }

    #[test]
    fn bg_flag_from_ttml_also_yields() {
        let mut bg = line(2000.0, 5000.0, vec![word("背景", 2000.0, 5000.0)]);
        bg["isBG"] = json!(true);
        let model = lyric(vec![
            line(1000.0, 5000.0, vec![word("主歌词", 1000.0, 5000.0)]),
            bg,
        ]);

        assert_eq!(
            resolve_menu_lyric_line(Some(&model), 3000.0).map(|line| line.text),
            Some("主歌词".to_string())
        );
    }
}
