#![allow(non_snake_case)]
use crate::search::model::{Name, NeteaseTrackSearchStruct};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct SearchTrack {
    content: String,
    parsed: Vec<NeteaseTrackSearchStruct>,
}

#[wasm_bindgen]
impl SearchTrack {
    #[wasm_bindgen(constructor)]
    pub fn new(content: Option<String>) -> Self {
        if let Some(content) = content {
            let mut instance = Self {
                content,
                parsed: vec![],
            };
            if !instance.content.is_empty() {
                instance.parsed =
                    serde_json::from_str::<Vec<NeteaseTrackSearchStruct>>(&instance.content)
                        .unwrap();
            }
            instance
        } else {
            Self {
                content: String::new(),
                parsed: vec![],
            }
        }
    }

    #[wasm_bindgen]
    pub fn search(&self, k: String) -> Vec<f64> {
        let k = k.to_lowercase();
        self.parsed
            .iter()
            .filter(|track| {
                // 歌曲名称
                track.name.to_lowercase().contains(&k)
                    // 专辑名称
                    || track.al.name.to_lowercase().contains(&k)
                    // 艺术家名称
                    || track
                        .ar
                        .iter()
                        .any(|Name{name}| name.to_lowercase().contains(&k))
                    // 别名
                    || track
                        .alia
                        .iter()
                        .any(|alias| alias.to_lowercase().contains(&k))
                    // 翻译名称
                    || track
                        .tns
                        .iter()
                        .any(|tns| tns.to_lowercase().contains(&k))
            })
            // 返回索引
            .map(|track| self.parsed.iter().position(|t| t.id == track.id).unwrap() as f64)
            .collect()
    }

    #[wasm_bindgen]
    pub fn update(&mut self, content: Option<String>) {
        if let Some(content) = content {
            self.content = content;
            if !self.content.is_empty() {
                self.parsed =
                    serde_json::from_str::<Vec<NeteaseTrackSearchStruct>>(&self.content).unwrap();
            } else {
                self.parsed.clear();
            }
        } else {
            self.content.clear();
            self.parsed.clear();
        }
    }
}
