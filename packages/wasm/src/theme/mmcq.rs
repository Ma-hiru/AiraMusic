use super::model::{ColorBox, Pixel, PriorityBox};
use std::collections::BinaryHeap;

/// MMCQ（Modified Median Cut Quantization）改良版中值切割量化算法
pub fn mmcq(pixels: Vec<Pixel>, target: usize) -> Vec<ColorBox> {
    if pixels.is_empty() || target == 0 {
        return vec![];
    }

    let initial_box: ColorBox = pixels.into();
    let mut heap: BinaryHeap<PriorityBox> = BinaryHeap::with_capacity(target);
    heap.push(PriorityBox::new(initial_box));

    while heap.len() < target {
        let Some(PriorityBox { color_box, .. }) = heap.pop() else {
            break;
        };
        // 如果像素数小于2，无法切分，直接放回
        if color_box.pixels_count() < 2 {
            heap.push(PriorityBox::new(color_box));
            break;
        }
        match color_box.split_box() {
            Some((b1, b2)) => {
                heap.push(PriorityBox::new(b1));
                heap.push(PriorityBox::new(b2));
            }
            None => {
                // 理论上不会到达这里，因为上面已经检查了 pixels_count
                break;
            }
        }
    }

    heap.into_iter().map(|pb| pb.color_box).collect()
}
