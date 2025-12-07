use crate::range::range::RangeTreeInner;
use js_sys::Array;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

pub mod range;

#[wasm_bindgen]
pub struct RangeTree {
    inner: RangeTreeInner,
}
#[wasm_bindgen]
impl RangeTree {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: RangeTreeInner::new(),
        }
    }

    #[wasm_bindgen]
    pub fn add(&mut self, start: u32, end: u32) {
        self.inner.add((start, end));
    }

    #[wasm_bindgen]
    pub fn remove(&mut self, start: u32, end: u32) {
        self.inner.remove((start, end));
    }

    #[wasm_bindgen]
    pub fn diff(&self, start: u32, end: u32) -> JsValue {
        let missing = self.inner.diff((start, end));
        Self::ranges_to_js_array(&missing)
    }

    #[wasm_bindgen]
    pub fn ranges(&self) -> JsValue {
        Self::ranges_to_js_array(&self.inner.ranges())
    }

    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.inner.clear();
    }

    fn ranges_to_js_array(ranges: &Vec<(u32, u32)>) -> JsValue {
        let arr = Array::new();
        for &(s, e) in ranges {
            let pair = Array::new();
            pair.push(&JsValue::from_f64(s as f64));
            pair.push(&JsValue::from_f64(e as f64));
            arr.push(&pair);
        }
        JsValue::from(arr)
    }
}
