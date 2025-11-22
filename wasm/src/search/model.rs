#![allow(non_snake_case)]
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Al {
    pub name: String,
}

#[derive(Deserialize)]
pub struct Artist {
    pub name: String,
}

#[derive(Deserialize)]
pub struct NeteaseTrack {
    pub name: String,
    pub ar: Vec<Artist>,
    pub alia: Vec<String>,
    pub al: Al,
    pub id: f64,
    pub tns: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct TrackId {
    pub id: f64,
}

#[derive(Deserialize)]
pub struct NeteasePlaylistDetail {
    pub trackIds: Vec<TrackId>,
}

#[derive(Deserialize)]
pub struct NeteasePlaylistDetailResponsePart {
    pub playlist: NeteasePlaylistDetail,
}
