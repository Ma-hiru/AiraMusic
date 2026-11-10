//! 与平台无关的纯计算。
//!
//! 放在这里而不是 `win.rs`，是为了让任意平台（包括 macOS CI）都能直接跑到单测，
//! 而 Windows 的业务代码仍然只在 Windows 目标编译。

/// DWM 一次请求的最大边长；超出部分按上限截断，避免离屏位图无界增长。
pub const MAX_THUMBNAIL_EDGE: u32 = 1024;

/// 拆分 `WM_DWMSENDICONICTHUMBNAIL` 的 lParam：**高字是宽，低字是高**。
///
/// 这一点搞反会直接导致 DWM 拒收位图、任务栏预览永远停在"加载中"。
/// 依据是 MSDN 的原文：
///
/// > The HIWORD of this value is the maximum x-coordinate of the thumbnail.
/// > The LOWORD is the maximum y-coordinate. **If a thumbnail has a dimension
/// > that exceeds one or both of these values, the DWM does not accept the
/// > thumbnail.**
///
/// 官方示例同样写成 `CreateDIB(HIWORD(lParam), LOWORD(lParam))`。
///
/// 真机实测（Windows 11 24H2 / 26100，ARM64）：
///
/// ```text
/// lParam = 0x00C8006A  ->  HIWORD = 200, LOWORD = 106
/// 递交 200x106 (w=HIWORD) -> S_OK
/// 递交 106x200 (w=LOWORD) -> E_INVALIDARG (0x80070057)
/// ```
///
/// 注意请求尺寸**不是正方形**（示例为 200x106），所以读反了一定会被拒收，
/// 不存在"碰巧对上"的可能。
///
/// 任一维为 0 视为无效请求；超出 [`MAX_THUMBNAIL_EDGE`] 的维度会被截断。
pub fn packed_size(packed: usize) -> Option<(u32, u32)> {
    let width = ((packed >> 16) & 0xffff) as u32;
    let height = (packed & 0xffff) as u32;
    (width != 0 && height != 0).then_some((
        width.min(MAX_THUMBNAIL_EDGE),
        height.min(MAX_THUMBNAIL_EDGE),
    ))
}

/// 缩略图边长：取请求宽高里较小的那个。
///
/// 交一张 `边长 x 边长` 的正方形位图，DWM 会**等比**把它放进任务栏卡片，
/// 卡片的画面区域于是就是正方形（官方同样是交 `min(w,h)` 的正方形画布）。
///
/// 反过来，如果把封面裁成请求尺寸（约 16:9）的宽幅位图，画面就是被拉伸裁切过的，
/// 专辑封面上下会被切掉——这正是第一版看起来"封面是 16:9"的原因。
pub fn square_side(width: u32, height: u32) -> u32 {
    width.min(height).max(1)
}

/// 把 `(宽, 高)` 等比缩到 `max_edge` 以内，只缩不放；任一维至少为 1。
pub fn bounded(width: u32, height: u32, max_edge: u32) -> (u32, u32) {
    let longest = width.max(height).max(1);
    if longest <= max_edge {
        return (width.max(1), height.max(1));
    }
    let scale = f64::from(max_edge) / f64::from(longest);
    (
        (f64::from(width) * scale).round().max(1.0) as u32,
        (f64::from(height) * scale).round().max(1.0) as u32,
    )
}

#[cfg(test)]
mod tests {
    use super::{MAX_THUMBNAIL_EDGE, bounded, packed_size, square_side};

    #[test]
    fn packed_size_reads_width_from_high_word() {
        // MAKELONG(height, width)：低字高、高字宽。
        assert_eq!(packed_size(0x00b4_0140), Some((180, 320)));
        assert_eq!(packed_size(0x0180_00d8), Some((384, 216)));
    }

    #[test]
    fn packed_size_rejects_empty_and_bounds_oversized() {
        assert_eq!(packed_size(0), None);
        assert_eq!(packed_size(0x0000_0140), None);
        assert_eq!(packed_size(0x0140_0000), None);
        assert_eq!(
            packed_size(0xffff_ffff),
            Some((MAX_THUMBNAIL_EDGE, MAX_THUMBNAIL_EDGE))
        );
    }

    #[test]
    fn square_side_takes_the_shorter_edge() {
        // 宽幅卡片取高；竖长请求取宽。
        assert_eq!(square_side(384, 216), 216);
        assert_eq!(square_side(200, 106), 106);
        assert_eq!(square_side(106, 200), 106);
        assert_eq!(square_side(256, 256), 256);
        // 任一维为 0 时不能返回 0，否则建不出位图。
        assert_eq!(square_side(0, 0), 1);
        assert_eq!(square_side(0, 216), 1);
    }

    #[test]
    fn bounded_only_shrinks_and_keeps_ratio() {
        assert_eq!(bounded(1920, 1080, 1024), (1024, 576));
        assert_eq!(bounded(1080, 1920, 1024), (576, 1024));
        assert_eq!(bounded(800, 600, 1024), (800, 600));
        assert_eq!(bounded(0, 0, 1024), (1, 1));
        for (width, height) in [(3840, 2160), (100, 3000), (7, 7)] {
            let (bounded_width, bounded_height) = bounded(width, height, MAX_THUMBNAIL_EDGE);
            assert!(bounded_width <= MAX_THUMBNAIL_EDGE && bounded_height <= MAX_THUMBNAIL_EDGE);
            assert!(bounded_width >= 1 && bounded_height >= 1);
        }
    }
}
