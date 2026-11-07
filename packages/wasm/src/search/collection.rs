use serde::{Deserialize, Deserializer, Serialize};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[derive(Default, Deserialize)]
#[serde(default)]
struct TrackInput {
    id: i64,
    name: String,
    ar: Vec<ArtistInput>,
    al: AlbumInput,
    dt: Option<f64>,
    alia: Vec<String>,
    tns: Vec<String>,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct ArtistInput {
    #[serde(deserialize_with = "deserialize_safe_id")]
    id: i64,
    name: String,
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct AlbumInput {
    #[serde(deserialize_with = "deserialize_safe_id")]
    id: i64,
    name: String,
    pic_url: String,
}

fn deserialize_safe_id<'de, D: Deserializer<'de>>(deserializer: D) -> Result<i64, D::Error> {
    let id = Option::<f64>::deserialize(deserializer)?;
    Ok(id
        .filter(|id| id.is_finite() && id.fract() == 0.0 && id.abs() <= 9_007_199_254_740_991.0)
        .map_or(0, |id| id as i64))
}

struct IndexedTrack {
    input_index: u32,
    search_fields: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtistEntry {
    key: String,
    id: i64,
    name: String,
    #[serde(rename = "trackIDs")]
    track_ids: Vec<i64>,
    covers: Vec<String>,
    #[serde(skip)]
    indices: Vec<usize>,
    #[serde(skip)]
    search_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AlbumEntry {
    key: String,
    id: i64,
    name: String,
    artist: String,
    #[serde(rename = "trackIDs")]
    track_ids: Vec<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cover: Option<String>,
    #[serde(skip)]
    indices: Vec<usize>,
    #[serde(skip)]
    search_fields: Vec<String>,
}

struct AlbumBuilder {
    entry: AlbumEntry,
    artist_names: Vec<String>,
    seen_artists: HashSet<String>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct CollectionSnapshot {
    duration: f64,
    album_count: usize,
    artists: Vec<ArtistEntry>,
    albums: Vec<AlbumEntry>,
}

#[derive(Default)]
struct CollectionIndex {
    snapshot: CollectionSnapshot,
    tracks: Vec<IndexedTrack>,
    all_indices: Vec<usize>,
    artist_lookup: HashMap<String, usize>,
    album_lookup: HashMap<String, usize>,
}

impl CollectionIndex {
    fn update(&mut self, content: &str) -> Result<(), serde_json::Error> {
        let input: Vec<TrackInput> = serde_json::from_str(content)?;
        *self = Self::from_tracks(input);
        Ok(())
    }

    fn from_tracks(input: Vec<TrackInput>) -> Self {
        let mut seen_tracks = HashSet::new();
        let mut artists = HashMap::<String, ArtistEntry>::new();
        let mut albums = HashMap::<i64, AlbumBuilder>::new();
        let mut tracks = Vec::with_capacity(input.len());
        let mut duration = 0.0_f64;

        for (input_index, track) in input.into_iter().enumerate() {
            if !seen_tracks.insert(track.id) {
                continue;
            }
            if let Some(dt) = track.dt.filter(|dt| dt.is_finite() && *dt > 0.0) {
                duration = (duration + dt).min(f64::MAX);
            }

            let row = tracks.len();
            let cover = track.al.pic_url.trim();
            let mut search_fields =
                Vec::with_capacity(2 + track.ar.len() + track.alia.len() + track.tns.len());
            search_fields.push(track.name.to_lowercase());
            search_fields.push(track.al.name.to_lowercase());
            search_fields.extend(track.ar.iter().map(|artist| artist.name.to_lowercase()));
            search_fields.extend(track.alia.iter().map(|alias| alias.to_lowercase()));
            search_fields.extend(
                track
                    .tns
                    .iter()
                    .map(|translation| translation.to_lowercase()),
            );
            tracks.push(IndexedTrack {
                input_index: input_index as u32,
                search_fields,
            });

            let mut track_artists = HashSet::new();
            for artist in &track.ar {
                let name = artist.name.trim();
                if name.is_empty() {
                    continue;
                }
                let id = artist.id.max(0);
                let key = if id > 0 {
                    format!("id:{id}")
                } else {
                    format!("name:{name}")
                };
                if !track_artists.insert(key.clone()) {
                    continue;
                }
                let entry = artists.entry(key.clone()).or_insert_with(|| ArtistEntry {
                    key,
                    id,
                    name: name.to_owned(),
                    track_ids: Vec::new(),
                    covers: Vec::new(),
                    indices: Vec::new(),
                    search_name: name.to_lowercase(),
                });
                entry.track_ids.push(track.id);
                entry.indices.push(row);
                if !cover.is_empty()
                    && entry.covers.len() < 4
                    && !entry.covers.iter().any(|url| url == cover)
                {
                    entry.covers.push(cover.to_owned());
                }
            }

            if track.al.id > 0 {
                let album = albums.entry(track.al.id).or_insert_with(|| AlbumBuilder {
                    entry: AlbumEntry {
                        key: format!("id:{}", track.al.id),
                        id: track.al.id,
                        name: track.al.name.trim().to_owned(),
                        artist: String::new(),
                        track_ids: Vec::new(),
                        cover: None,
                        indices: Vec::new(),
                        search_fields: Vec::new(),
                    },
                    artist_names: Vec::new(),
                    seen_artists: HashSet::new(),
                });
                album.entry.track_ids.push(track.id);
                album.entry.indices.push(row);
                if album.entry.cover.is_none() && !cover.is_empty() {
                    album.entry.cover = Some(cover.to_owned());
                }
                for artist in &track.ar {
                    let name = artist.name.trim();
                    if !name.is_empty() && album.seen_artists.insert(name.to_owned()) {
                        album.artist_names.push(name.to_owned());
                    }
                }
            }
        }

        let mut artists: Vec<_> = artists.into_values().collect();
        artists.sort_by(|a, b| {
            b.track_ids
                .len()
                .cmp(&a.track_ids.len())
                .then_with(|| a.name.cmp(&b.name))
                .then_with(|| a.key.cmp(&b.key))
        });
        let mut albums: Vec<_> = albums
            .into_values()
            .map(|mut album| {
                album.entry.artist = album.artist_names.join(" / ");
                album.entry.search_fields = vec![
                    album.entry.name.to_lowercase(),
                    album.entry.artist.to_lowercase(),
                ];
                album.entry
            })
            .collect();
        albums.sort_by(|a, b| {
            b.track_ids
                .len()
                .cmp(&a.track_ids.len())
                .then_with(|| a.name.cmp(&b.name))
                .then_with(|| a.key.cmp(&b.key))
        });

        Self {
            artist_lookup: artists
                .iter()
                .enumerate()
                .map(|(index, artist)| (artist.key.clone(), index))
                .collect(),
            album_lookup: albums
                .iter()
                .enumerate()
                .map(|(index, album)| (album.key.clone(), index))
                .collect(),
            all_indices: (0..tracks.len()).collect(),
            tracks,
            snapshot: CollectionSnapshot {
                duration,
                album_count: albums.len(),
                artists,
                albums,
            },
        }
    }

    fn search_tracks(&self, keyword: &str, kind: Option<&str>, key: Option<&str>) -> Vec<u32> {
        let indices = match kind.unwrap_or("") {
            "" => self.all_indices.as_slice(),
            "artist" => {
                let Some(index) = key.and_then(|key| self.artist_lookup.get(key)) else {
                    return Vec::new();
                };
                &self.snapshot.artists[*index].indices
            }
            "album" => {
                let Some(index) = key.and_then(|key| self.album_lookup.get(key)) else {
                    return Vec::new();
                };
                &self.snapshot.albums[*index].indices
            }
            _ => return Vec::new(),
        };
        let query = keyword.trim().to_lowercase();
        indices
            .iter()
            .filter_map(|index| {
                let track = &self.tracks[*index];
                (query.is_empty()
                    || track
                        .search_fields
                        .iter()
                        .any(|field| field.contains(&query)))
                .then_some(track.input_index)
            })
            .collect()
    }

    fn search_artists(&self, keyword: &str) -> Vec<u32> {
        let query = keyword.trim().to_lowercase();
        self.snapshot
            .artists
            .iter()
            .enumerate()
            .filter_map(|(index, artist)| {
                artist.search_name.contains(&query).then_some(index as u32)
            })
            .collect()
    }

    fn search_albums(&self, keyword: &str) -> Vec<u32> {
        let query = keyword.trim().to_lowercase();
        self.snapshot
            .albums
            .iter()
            .enumerate()
            .filter_map(|(index, album)| {
                album
                    .search_fields
                    .iter()
                    .any(|field| field.contains(&query))
                    .then_some(index as u32)
            })
            .collect()
    }

    fn snapshot_json(&self) -> String {
        serde_json::to_string(&self.snapshot).expect("playlist collection metadata is serializable")
    }
}

#[wasm_bindgen]
#[derive(Default)]
pub struct PlaylistCollectionIndex {
    inner: CollectionIndex,
}

#[wasm_bindgen]
impl PlaylistCollectionIndex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn update(&mut self, content: &str) -> Result<(), JsValue> {
        self.inner
            .update(content)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    pub fn snapshot(&self) -> String {
        self.inner.snapshot_json()
    }

    #[wasm_bindgen(js_name = searchTracks)]
    pub fn search_tracks(
        &self,
        keyword: &str,
        kind: Option<String>,
        key: Option<String>,
    ) -> Vec<u32> {
        self.inner
            .search_tracks(keyword, kind.as_deref(), key.as_deref())
    }

    #[wasm_bindgen(js_name = searchArtists)]
    pub fn search_artists(&self, keyword: &str) -> Vec<u32> {
        self.inner.search_artists(keyword)
    }

    #[wasm_bindgen(js_name = searchAlbums)]
    pub fn search_albums(&self, keyword: &str) -> Vec<u32> {
        self.inner.search_albums(keyword)
    }
}

#[cfg(test)]
mod tests {
    use super::CollectionIndex;
    use serde_json::{Value, json};

    fn collection(input: Value) -> CollectionIndex {
        let mut collection = CollectionIndex::default();
        collection.update(&input.to_string()).unwrap();
        collection
    }

    #[test]
    fn deduplicates_tracks_and_groups_collaborations_with_original_indices() {
        let index = collection(json!([
            {"id": 10, "name": "First", "dt": 60000, "ar": [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}, {"id": 1, "name": "A"}], "al": {"id": 20, "name": "Album", "picUrl": " first.jpg "}},
            {"id": 10, "name": "Duplicate", "dt": 900000, "ar": [{"id": 3, "name": "Ignored"}], "al": {"id": 21, "name": "Ignored"}},
            {"id": 11, "name": "Second", "dt": 120000, "ar": [{"id": 1, "name": "A"}, {"id": 3, "name": "C"}], "al": {"id": 20, "name": "Album", "picUrl": "second.jpg"}}
        ]));
        let snapshot: Value = serde_json::from_str(&index.snapshot_json()).unwrap();
        assert_eq!(snapshot["duration"], 180000.0);
        assert_eq!(snapshot["albumCount"], 1);
        assert_eq!(snapshot["artists"][0]["trackIDs"], json!([10, 11]));
        assert_eq!(
            snapshot["artists"][0]["covers"],
            json!(["first.jpg", "second.jpg"])
        );
        assert_eq!(snapshot["albums"][0]["artist"], "A / B / C");
        assert_eq!(snapshot["albums"][0]["cover"], "first.jpg");
        assert_eq!(index.search_tracks("", None, None), [0, 2]);
        assert_eq!(index.search_tracks("", Some("artist"), Some("id:2")), [0]);
        assert_eq!(
            index.search_tracks("", Some("album"), Some("id:20")),
            [0, 2]
        );
    }

    #[test]
    fn separates_named_unknown_artists_and_same_name_different_ids() {
        let index = collection(json!([
            {"id": 1, "ar": [{"id": 0, "name": " Unknown A "}, {"id": -1, "name": "Unknown B"}, {"id": 0, "name": "Unknown A"}, {"id": 0, "name": " "}], "al": {"id": 0}},
            {"id": 2, "ar": [{"id": 1, "name": "Same"}, {"id": 2, "name": "Same"}], "al": {"id": -1}}
        ]));
        assert_eq!(index.snapshot.artists.len(), 4);
        assert_eq!(index.snapshot.album_count, 0);
        assert_eq!(index.snapshot.artists[0].key, "id:1");
        assert_eq!(index.snapshot.artists[1].key, "id:2");
        assert_eq!(
            index.search_tracks("", Some("artist"), Some("name:Unknown A")),
            [0]
        );
        assert_eq!(
            index.search_tracks("", Some("artist"), Some("name:Unknown B")),
            [0]
        );
    }

    #[test]
    fn searches_all_track_fields_case_insensitively_and_limits_group_scope() {
        let index = collection(json!([
            {"id": 1, "name": "Moon", "ar": [{"id": 1, "name": "Singer A"}], "al": {"id": 10, "name": "Night"}, "alia": ["别名"], "tns": ["Translated"]},
            {"id": 2, "name": "Sun", "ar": [{"id": 2, "name": "Singer B"}], "al": {"id": 20, "name": "Day"}}
        ]));
        for query in [" MOON ", "singer a", "NIGHT", "别名", "TRANSLATED"] {
            assert_eq!(index.search_tracks(query, None, None), [0]);
        }
        assert!(
            index
                .search_tracks("sun", Some("artist"), Some("id:1"))
                .is_empty()
        );
        assert_eq!(
            index.search_tracks("sun", Some("album"), Some("id:20")),
            [1]
        );
        assert!(
            index
                .search_tracks("", Some("artist"), Some("missing"))
                .is_empty()
        );
        assert!(index.search_tracks("", Some("album"), None).is_empty());
        assert!(
            index
                .search_tracks("", Some("unsupported"), None)
                .is_empty()
        );
        assert_eq!(index.search_tracks("", Some(""), Some("missing")), [0, 1]);
        assert_eq!(index.search_artists("SINGER B"), [1]);
        assert_eq!(index.search_albums("NIGHT"), [1]);
        assert_eq!(index.search_albums("singer b"), [0]);
        assert_eq!(index.search_artists(""), [0, 1]);
        assert_eq!(index.search_albums(""), [0, 1]);
    }

    #[test]
    fn orders_groups_deterministically_and_limits_distinct_covers() {
        let tracks: Vec<_> = (0..6).map(|index| json!({
            "id": index,
            "dt": 1000,
            "ar": [{"id": 1, "name": "Z"}],
            "al": {"id": index + 10, "name": format!("Album {index}"), "picUrl": format!("{index}.jpg")}
        })).chain([json!({"id": 10, "ar": [{"id": 2, "name": "A"}], "al": {"id": 10, "name": "Album 0"}})]).collect();
        let index = collection(Value::Array(tracks));
        assert_eq!(index.snapshot.artists[0].name, "Z");
        assert_eq!(
            index.snapshot.artists[0].covers,
            ["0.jpg", "1.jpg", "2.jpg", "3.jpg"]
        );
        assert_eq!(index.snapshot.albums[0].id, 10);
        assert_eq!(index.snapshot.albums[0].track_ids, [0, 10]);
        assert_eq!(index.snapshot.albums[1].name, "Album 1");
    }

    #[test]
    fn handles_empty_fields_and_non_positive_duration_without_phantom_groups() {
        let index = collection(json!([
            {"id": 1},
            {"id": 2, "dt": null, "ar": [], "al": {"id": 10}},
            {"id": 3, "dt": -3000, "ar": [{"name": ""}], "al": {"id": 10, "picUrl": " "}},
            {"id": 4, "dt": 0},
            {"id": 5, "dt": 1250.5}
        ]));
        assert_eq!(index.snapshot.duration, 1250.5);
        assert!(index.snapshot.artists.is_empty());
        assert_eq!(index.snapshot.album_count, 1);
        assert!(index.snapshot.albums[0].cover.is_none());
        assert_eq!(index.search_tracks("", None, None), [0, 1, 2, 3, 4]);
        assert!(index.search_artists("").is_empty());
        assert_eq!(index.search_albums(""), [0]);
    }

    #[test]
    fn normalizes_null_fractional_and_unsafe_artist_and_album_ids() {
        let input = json!([
            {"id": 1, "ar": [{"id": null, "name": "Null"}], "al": {"id": null}},
            {"id": 2, "ar": [{"id": 1.5, "name": "Fraction"}], "al": {"id": 10.5}},
            {"id": 3, "ar": [{"id": 9007199254740992_u64, "name": "Unsafe"}], "al": {"id": 9007199254740992_u64}},
            {"id": 4, "ar": [{"id": f64::NAN, "name": "Not finite"}], "al": {"id": f64::INFINITY}},
            {"id": 5, "ar": [{"id": -2, "name": "Negative"}], "al": {"id": -10}},
            {"id": 6, "ar": [{"id": 1, "name": "Safe"}], "al": {"id": 10}},
            {"id": 7, "ar": [{"id": 9007199254740991_i64, "name": "Maximum safe"}], "al": {"id": 9007199254740991_i64}}
        ]);
        // JavaScript JSON.stringify converts non-finite numbers to null as well.
        assert!(input[3]["ar"][0]["id"].is_null());
        assert!(input[3]["al"]["id"].is_null());
        let index = collection(input);
        assert_eq!(index.snapshot.artists.len(), 7);
        assert_eq!(index.snapshot.album_count, 2);
        for (key, input_index) in [
            ("name:Null", 0),
            ("name:Fraction", 1),
            ("name:Unsafe", 2),
            ("name:Not finite", 3),
            ("name:Negative", 4),
            ("id:1", 5),
            ("id:9007199254740991", 6),
        ] {
            assert_eq!(
                index.search_tracks("", Some("artist"), Some(key)),
                [input_index]
            );
        }
        assert_eq!(index.search_tracks("", Some("album"), Some("id:10")), [5]);
        assert_eq!(
            index.search_tracks("", Some("album"), Some("id:9007199254740991")),
            [6]
        );
    }

    #[test]
    fn refresh_replaces_every_index_and_invalid_input_keeps_previous_collection() {
        let mut index = collection(json!([
            {"id": 1, "name": "Old", "ar": [{"id": 1, "name": "Old singer"}], "al": {"id": 10, "name": "Old album"}}
        ]));
        let previous = index.snapshot_json();
        assert!(index.update("not json").is_err());
        assert_eq!(index.snapshot_json(), previous);
        index.update(r#"[{"id":2,"name":"New","dt":3000,"ar":[{"id":2,"name":"New singer"}],"al":{"id":20,"name":"New album"}}]"#).unwrap();
        assert!(index.search_tracks("old", None, None).is_empty());
        assert!(
            index
                .search_tracks("", Some("artist"), Some("id:1"))
                .is_empty()
        );
        assert_eq!(
            index.search_tracks("new", Some("album"), Some("id:20")),
            [0]
        );
        assert_eq!(index.search_artists("new"), [0]);
        assert_eq!(index.search_albums("new"), [0]);
        assert_eq!(index.snapshot.duration, 3000.0);
        index.update("[]").unwrap();
        assert_eq!(
            index.snapshot_json(),
            r#"{"duration":0.0,"albumCount":0,"artists":[],"albums":[]}"#
        );
        assert!(index.search_tracks("", None, None).is_empty());
    }
}
