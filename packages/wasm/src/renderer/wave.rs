// Portions ported from AxionOS's WaveformSeekBar.kt.
// Copyright (C) 2025 AxionOS
//
// The upstream portions are licensed under the Apache License, Version 2.0.
// See LICENSE-APACHE-2.0 or https://www.apache.org/licenses/LICENSE-2.0.
//
// Original source:
// https://github.com/AxionAOSP/android_frameworks_base/blob/b41823f8e730bb78dbaf742b3cf5fed9478b93cd/packages/SystemUI/src/com/android/systemui/media/controls/ui/view/WaveformSeekBar.kt
//
// AiraMusic ported the Kotlin wave geometry to Rust/WASM, adapted the cubic
// Bézier interpolation to return control points, and bounded the sample count.

use std::f64::consts::TAU;
use wasm_bindgen::prelude::wasm_bindgen;

/// Emits the two control points and the endpoint of each cubic Bézier segment.
#[wasm_bindgen(js_name = computeWaveSegments)]
pub fn compute_wave_segments(
    start_x: f64,
    wave_start_x: f64,
    end_x: f64,
    track_top: f64,
    density: f64,
    phase: f64,
    amplitude: f64,
) -> Vec<f32> {
    let wave_width = end_x - wave_start_x;
    let wavelength = 80.0 * density;
    if wave_width <= 0.0 || wavelength <= 0.0 || !wavelength.is_finite() || !wave_width.is_finite()
    {
        return Vec::new();
    }

    let taper = wavelength * 0.4;
    let length_ratio = ((end_x - start_x) / (wavelength * 0.8)).clamp(0.0, 1.0);
    let wave_height = 12.0 * density * amplitude * (length_ratio.sqrt() * 0.7 + 0.3);
    let sample = |x: f64| {
        let from_start = x - wave_start_x;
        let from_end = end_x - x;
        let envelope = if wave_width < taper * 2.0 {
            let t = from_start / wave_width;
            4.0 * t * (1.0 - t)
        } else {
            let t = (from_start.min(from_end) / taper).clamp(0.0, 1.0);
            t * t * (3.0 - 2.0 * t)
        };
        let sine = ((from_start / wavelength * TAU + phase).sin() + 1.0) / 2.0;
        [x, track_top - sine * envelope * wave_height]
    };

    let step = (2.0 * density).max(wave_width / 8192.0);
    let count = (wave_width / step).ceil() as usize;
    let mut points: Vec<_> = (0..count)
        .map(|index| sample(wave_start_x + index as f64 * step))
        .collect();
    points.push([end_x, track_top]);

    let mut segments = Vec::with_capacity(count * 6);
    for index in 0..count {
        let [x0, y0] = points[index.saturating_sub(1)];
        let [x1, y1] = points[index];
        let [x2, y2] = points[index + 1];
        let [x3, y3] = points[(index + 2).min(count)];
        // A cardinal spline with tension 0.5 uses (0.5 / 3) for each tangent.
        segments.extend([
            (x1 + (x2 - x0) / 6.0) as f32,
            (y1 + (y2 - y0) / 6.0) as f32,
            (x2 - (x3 - x1) / 6.0) as f32,
            (y2 - (y3 - y1) / 6.0) as f32,
            x2 as f32,
            y2 as f32,
        ]);
    }
    segments
}

#[cfg(test)]
mod tests {
    use super::compute_wave_segments;

    #[test]
    fn curve_ends_at_progress_with_a_short_final_segment() {
        let segments = compute_wave_segments(8.0, 11.0, 20.0, 21.0, 1.0, 0.0, 1.0);
        assert_eq!(segments.len(), 5 * 6);
        assert!(segments[5] < 21.0);
        assert_eq!(segments[segments.len() - 2..], [20.0, 21.0]);
    }

    #[test]
    fn zero_amplitude_leaves_every_control_point_on_the_track() {
        let segments = compute_wave_segments(8.0, 11.0, 30.0, 21.0, 1.0, 0.0, 0.0);
        assert!(segments.iter().skip(1).step_by(2).all(|&y| y == 21.0));
        assert!(compute_wave_segments(8.0, 11.0, 11.0, 21.0, 1.0, 0.0, 1.0).is_empty());
    }
}
