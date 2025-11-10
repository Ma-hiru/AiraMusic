//! # K-Means聚类算法 用于图像主题色提取
//! - 数据准备：把每个像素当作 3 维点 [R,G,B]。
//! - 初始化： k个质心（随机样本或 k-means++）。
//! - 分配：每个点归到最近质心。
//! - 更新：各簇取均值生成新质心。
//! - 判断收敛：质心变化很小或达到迭代上限。
//! - 输出：质心（主题色）及簇分配。

use image::Rgb;
use rand;
use rand::prelude::{IndexedRandom, SliceRandom};

pub struct KMeans {
    // 聚类数
    k: usize,
    // 3维数据集，每个点为归一化的RGB值
    dataset: Vec<[f32; 3]>,
    // k个质心，每个质心为归一化的RGB值
    centroids: Vec<[f32; 3]>,
}
impl KMeans {
    pub fn new(pixels: &[Rgb<u8>], max_samples: usize, k: usize) -> Self {
        let dataset = prepare_dataset(pixels, max_samples);
        let centroids = init_centroids(&dataset, k);
        KMeans {
            k,
            dataset,
            centroids,
        }
    }

    /// 分配集群，返回每个点所属的质心索引
    fn assign_clusters(&self) -> Vec<usize> {
        if self.centroids.is_empty() || self.dataset.is_empty() {
            return Vec::new();
        }
        let mut labels = Vec::with_capacity(self.dataset.len());
        for point in &self.dataset {
            let mut best_idx = 0usize;
            let mut min_dist = f32::MAX;
            for (index, centroid) in self.centroids.iter().enumerate() {
                let distance = distance2(point, centroid);
                if distance < min_dist {
                    min_dist = distance;
                    best_idx = index;
                }
            }
            labels.push(best_idx);
        }
        labels
    }

    /// 更新质心，返回质心变化的最大距离
    fn update_centroids(&mut self, labels: &[usize]) -> f32 {
        assert_eq!(labels.len(), self.dataset.len());
        if self.centroids.is_empty() || self.dataset.is_empty() {
            return 0.0;
        }

        let mut sums = vec![[0.0f32; 3]; self.k];
        let mut counts = vec![0u32; self.k];
        for (point, &label) in self.dataset.iter().zip(labels) {
            let acc = &mut sums[label];
            acc[0] += point[0];
            acc[1] += point[1];
            acc[2] += point[2];
            counts[label] += 1;
        }

        let mut max_shift = 0.0f32;
        for i in 0..self.k {
            if counts[i] > 0 {
                let inv = 1.0 / counts[i] as f32;
                let new_centroid = [sums[i][0] * inv, sums[i][1] * inv, sums[i][2] * inv];
                let shift = distance2(&self.centroids[i], &new_centroid);
                max_shift = max_shift.max(shift);
                self.centroids[i] = new_centroid;
            } else {
                // 如果某个质心没有任何点分配给它，可以选择重新初始化它
                // 这里简单地保持不变
            }
        }
        max_shift
    }

    /// 排序质心，按聚类数目降序
    fn sort_centroids_by_cluster_size(&mut self, labels: &[usize]) {
        if self.centroids.is_empty() || self.dataset.is_empty() {
            return;
        }
        let mut counts = vec![0usize; self.k];
        for &label in labels {
            counts[label] += 1;
        }
        let mut centroids_with_counts: Vec<(&[f32; 3], usize)> =
            self.centroids.iter().zip(counts).collect();
        centroids_with_counts.sort_by(|a, b| b.1.cmp(&a.1));
        self.centroids = centroids_with_counts.iter().map(|(c, _)| **c).collect();
    }

    /// 运行K-Means算法，直到收敛或达到最大迭代次数
    /// max_iters: 最大迭代次数
    /// tol: 收敛阈值(质心最大平方移动 <= tol 判定收敛)
    /// 返回: 最终 labels
    pub fn fit(&mut self, max_iters: usize, tol: f32) -> Vec<usize> {
        if self.centroids.is_empty() || self.dataset.is_empty() {
            return Vec::new();
        }
        // 初始分配
        let mut labels = self.assign_clusters();
        for _ in 0..max_iters {
            // 更新质心
            let shift = self.update_centroids(&labels);
            println!("Centroid shift: {}", shift);
            // 检查收敛
            if shift <= tol {
                break;
            }
            // 重新分配
            let new_labels = self.assign_clusters();
            labels = new_labels;
        }
        // 按聚类大小排序质心
        self.sort_centroids_by_cluster_size(&labels);
        labels
    }

    /// 获取当前质心，转换回 u8 范围
    pub fn palette_rgb8(&self) -> Vec<Rgb<u8>> {
        self.centroids
            .iter()
            .map(|c| {
                Rgb([
                    (c[0].clamp(0.0, 1.0) * 255.0).round() as u8,
                    (c[1].clamp(0.0, 1.0) * 255.0).round() as u8,
                    (c[2].clamp(0.0, 1.0) * 255.0).round() as u8,
                ])
            })
            .collect()
    }

    /// 计算当前聚类的总平方误差（SSE）
    #[allow(unused)]
    pub fn sse(&self, labels: &[usize]) -> f32 {
        self.dataset
            .iter()
            .zip(labels)
            .map(|(point, &label)| distance2(point, &self.centroids[label]))
            .sum()
    }
}

/// 像素归一化并随机（下）采样
fn prepare_dataset(pixels: &[Rgb<u8>], max_samples: usize) -> Vec<[f32; 3]> {
    // 归一化
    let mut data: Vec<[f32; 3]> = pixels
        .iter()
        .map(|p| {
            [
                p[0] as f32 / 255.0,
                p[1] as f32 / 255.0,
                p[2] as f32 / 255.0,
            ]
        })
        .collect();
    // 随机采样
    let mut rng = rand::rng();
    data.shuffle(&mut rng);
    if data.len() > max_samples {
        // 下取样
        data.truncate(max_samples);
    }

    data
}

/// 初始化k个质心
fn init_centroids(dataset: &[[f32; 3]], k: usize) -> Vec<[f32; 3]> {
    let mut rng = rand::rng();
    let k = k.min(dataset.len());
    dataset.choose_multiple(&mut rng, k).cloned().collect()
}

/// 计算两个3维点的欧氏距离的平方
#[inline]
fn distance2(a: &[f32; 3], b: &[f32; 3]) -> f32 {
    (a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)
}
