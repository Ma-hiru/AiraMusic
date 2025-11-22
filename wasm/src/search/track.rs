#![allow(non_snake_case)]

use crate::search::model::{
    NeteasePlaylistDetail, NeteasePlaylistDetailResponsePart, NeteaseTrack,
};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct SearchTrack {
    content: String,
    parsed: Vec<NeteaseTrack>,
}
#[wasm_bindgen]
impl SearchTrack {
    #[wasm_bindgen(constructor)]
    pub fn new(content: String) -> Self {
        let mut instance = Self {
            content,
            parsed: vec![],
        };
        instance.parsed = serde_json::from_str::<Vec<NeteaseTrack>>(&instance.content).unwrap();
        instance
    }

    #[wasm_bindgen]
    pub fn search(&self, k: String) -> Vec<i32> {
        self.parsed
            .iter()
            .filter(|track| {
                // 歌曲名称
                track.name.to_lowercase().contains(&k.to_lowercase())
                    // 专辑名称
                    || track.al.name.to_lowercase().contains(&k.to_lowercase())
                    // 艺术家名称
                    || track
                        .ar
                        .iter()
                        .any(|artist| artist.name.to_lowercase().contains(&k.to_lowercase()))
                    // 别名
                    || track
                        .alia
                        .iter()
                        .any(|alias| alias.to_lowercase().contains(&k.to_lowercase()))
                    // 翻译名称
                    || track
                        .tns
                        .as_ref()
                        .map(|tns| {
                            tns.iter()
                                .any(|tn| tn.to_lowercase().contains(&k.to_lowercase()))
                        })
                        .unwrap_or(false)
            })
            // 返回索引
            .map(|track| self.parsed.iter().position(|t| t.id == track.id).unwrap() as i32)
            .collect()
    }
}

#[wasm_bindgen]
pub struct LikedTrackSearcher {
    content: String,
    parsed: NeteasePlaylistDetailResponsePart,
}
#[wasm_bindgen]
impl LikedTrackSearcher {
    #[wasm_bindgen(constructor)]
    pub fn new(content: String) -> Self {
        let mut instance = Self {
            content,
            parsed: NeteasePlaylistDetailResponsePart {
                playlist: NeteasePlaylistDetail { trackIds: vec![] },
            },
        };
        instance.parsed =
            serde_json::from_str::<NeteasePlaylistDetailResponsePart>(&instance.content).unwrap();
        instance
    }

    #[wasm_bindgen]
    pub fn update(&mut self, content: String) {
        self.content = content;
        self.parsed =
            serde_json::from_str::<NeteasePlaylistDetailResponsePart>(&self.content).unwrap();
    }

    #[wasm_bindgen]
    pub fn isLiked(&self, track_id: f64) -> bool {
        self.parsed
            .playlist
            .trackIds
            .iter()
            .any(|track| track.id == track_id)
    }

    #[wasm_bindgen]
    pub fn getLikedTrackIds(&self) -> Vec<f64> {
        self.parsed
            .playlist
            .trackIds
            .iter()
            .map(|track| track.id)
            .collect()
    }

    #[wasm_bindgen]
    pub fn getLikedCount(&self) -> usize {
        self.parsed.playlist.trackIds.len()
    }
}
