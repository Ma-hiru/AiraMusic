#![allow(non_snake_case)]
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Name {
    pub name: String,
}

#[derive(Deserialize)]
pub struct NeteaseTrackSearchStruct {
    pub name: String,
    pub ar: Vec<Name>,
    pub alia: Vec<String>,
    pub al: Name,
    pub id: f64,
    pub tns: Vec<String>,
}
