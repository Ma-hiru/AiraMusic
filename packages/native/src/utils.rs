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
/// 交一张 `边长 x 边长` 的正方形位图，是把卡片交给 DWM 自己处理的老做法：
/// 在有重定向表面的窗口上 DWM 会**等比放置**它，卡片里就是一块正方形画面。
/// 无重定向表面的窗口不适用（会拉伸），那条路径见 `win.rs` 的 `thumb_divisor`。
pub fn square_side(width: u32, height: u32) -> u32 {
    width.min(height).max(1)
}

/// 在 `width x height` 的画布里居中放一个最大正方形，返回 `(边长, 左偏移, 上偏移)`。
pub fn square_inset(width: u32, height: u32) -> (u32, u32, u32) {
    let width = width.max(1);
    let height = height.max(1);
    let side = width.min(height);
    (side, (width - side) / 2, (height - side) / 2)
}

/// 计算"铺满"一块 `width x height` 所需要的缩放尺寸与居中裁剪偏移。
///
/// 返回 `(缩放后宽, 缩放后高, 裁剪左偏移, 裁剪上偏移)`：先把源图等比放大到
/// 两个方向都**不小于**目标尺寸，再从 `(偏移)` 处裁出 `width x height`。
pub fn fill_geometry(
    src_width: u32,
    src_height: u32,
    width: u32,
    height: u32,
) -> (u32, u32, u32, u32) {
    let src_width = src_width.max(1);
    let src_height = src_height.max(1);
    let width = width.max(1);
    let height = height.max(1);
    let scale =
        (f64::from(width) / f64::from(src_width)).max(f64::from(height) / f64::from(src_height));
    let scaled_width = ((f64::from(src_width) * scale).round() as u32).max(width);
    let scaled_height = ((f64::from(src_height) * scale).round() as u32).max(height);
    (
        scaled_width,
        scaled_height,
        (scaled_width - width) / 2,
        (scaled_height - height) / 2,
    )
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
    use super::{
        MAX_THUMBNAIL_EDGE, bounded, fill_geometry, packed_size, square_inset, square_side,
    };

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
        assert_eq!(square_side(400, 214), 214);
        assert_eq!(square_side(600, 315), 315);
        assert_eq!(square_side(0, 0), 1);
    }

    #[test]
    fn square_inset_centers_the_largest_square() {
        assert_eq!(square_inset(400, 214), (214, 93, 0));
        assert_eq!(square_inset(200, 107), (107, 46, 0));
        assert_eq!(square_inset(5, 5), (5, 0, 0));
    }

    #[test]
    fn fill_geometry_never_crops_outside_the_scaled_image() {
        for (src_width, src_height) in [(400, 400), (1000, 300), (1, 1)] {
            for (width, height) in [(400, 214), (200, 107), (16, 9)] {
                let (scaled_width, scaled_height, offset_x, offset_y) =
                    fill_geometry(src_width, src_height, width, height);
                assert!(scaled_width >= width && scaled_height >= height);
                assert!(offset_x + width <= scaled_width);
                assert!(offset_y + height <= scaled_height);
            }
        }
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
