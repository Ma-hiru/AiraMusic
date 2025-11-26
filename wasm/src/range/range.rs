pub type Range = (u32, u32);

#[derive(Debug, Clone)]
pub struct RangeTreeInner {
    ranges: Vec<Range>,
}
impl RangeTreeInner {
    pub fn new() -> Self {
        Self { ranges: Vec::new() }
    }

    pub fn add(&mut self, range: Range) {
        let (mut start, mut end) = range;
        if start > end {
            return;
        }

        let mut out = Vec::with_capacity(self.ranges.len() + 1);
        let mut inserted = false;

        for &(s, e) in &self.ranges {
            if e < start {
                out.push((s, e));
            } else if end < s {
                if !inserted {
                    out.push((start, end));
                    inserted = true;
                }
                out.push((s, e));
            } else {
                start = start.min(s);
                end = end.max(e);
            }
        }
        if !inserted {
            out.push((start, end));
        }
        self.ranges = out;
    }

    pub fn remove(&mut self, range: Range) {
        let (remove_start, remove_end) = range;
        if remove_start >= remove_end {
            return;
        }
        let mut out = Vec::with_capacity(self.ranges.len());
        for &(start, end) in &self.ranges {
            if end <= remove_start || start >= remove_end {
                out.push((start, end));
            } else {
                if start < remove_start {
                    out.push((start, remove_start));
                }
                if end > remove_end {
                    out.push((remove_end, end));
                }
            }
        }
        self.ranges = out;
    }

    pub fn diff(&self, query: Range) -> Vec<Range> {
        let (mut check_start, check_end) = query;
        if check_start >= check_end {
            return Vec::new();
        }
        let mut missing = Vec::new();
        for &(start, end) in self.ranges.iter() {
            // 在左边
            if end <= check_start {
                continue;
            }
            if start > check_start {
                // 在右边
                let cover_start = start.min(check_end);
                missing.push((check_start, cover_start));
                if cover_start >= check_end || end >= check_end {
                    return missing;
                }
                check_start = end;
            } else {
                // 重叠
                check_start = end;
                if check_start >= check_end {
                    break;
                }
            }
        }
        if check_start < check_end {
            missing.push((check_start, check_end));
        }
        missing
    }

    pub fn ranges(&self) -> &Vec<Range> {
        &self.ranges
    }

    pub fn clear(&mut self) {
        self.ranges.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::RangeTreeInner;
    #[test]
    fn test_range_tree() {
        let mut range_tree = RangeTreeInner::new();
        // 100-150 & 350-400
        range_tree.add((100, 200));
        range_tree.add((300, 400));
        range_tree.remove((150, 350));
        let check = range_tree.diff((0, 500));
        assert_eq!(check, vec![(0, 100), (150, 350), (400, 500)]);
    }
}
