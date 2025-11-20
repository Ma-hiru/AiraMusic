#[cfg(test)]
mod tests {
    use crate::search::track::SearchTrack;

    #[test]
    fn test_search_track() {
        let instance = instance();
        let result = instance.search(String::from("hope"));
        assert_eq!(result, vec![0]);
        let result = instance.search(String::from("azusa"));
        assert_eq!(result, vec![1]);
        let result = instance.search(String::from("初音ミク"));
        assert_eq!(result, vec![2]);
        let result = instance.search(String::from("唯一的希望"));
        assert_eq!(result, vec![0]);
    }

    fn instance() -> SearchTrack {
        SearchTrack::new(String::from(
            r#"[
      {
        "name": "ONE's hope",
        "mainTitle": null,
        "additionalTitle": null,
        "id": 776039,
        "pst": 0,
        "t": 0,
        "ar": [
          {
            "id": 18303,
            "name": "やなぎなぎ",
            "tns": [],
            "alias": []
          }
        ],
        "alia": [],
        "pop": 95,
        "st": 0,
        "rt": "",
        "fee": 0,
        "v": 56,
        "crbt": null,
        "cf": "",
        "al": {
          "id": 76484,
          "name": "Colorful Parade",
          "picUrl": "http://p4.music.126.net/l22TRH7bs4VG6HMT2Iy56w==/2511284557902801.jpg",
          "tns": [],
          "pic": 2511284557902801
        },
        "dt": 369720,
        "h": {
          "br": 320000,
          "fid": 0,
          "size": 14791619,
          "vd": -50526
        },
        "m": {
          "br": 192000,
          "fid": 0,
          "size": 8874989,
          "vd": -47977
        },
        "l": {
          "br": 128000,
          "fid": 0,
          "size": 5916674,
          "vd": -46416
        },
        "sq": {
          "br": 1122000,
          "fid": 0,
          "size": 42685655,
          "vd": -50513
        },
        "hr": null,
        "a": null,
        "cd": "1",
        "no": 8,
        "rtUrl": null,
        "ftype": 0,
        "rtUrls": [],
        "djId": 0,
        "copyright": 2,
        "s_id": 0,
        "mark": 9007199255003136,
        "originCoverType": 0,
        "originSongSimpleData": null,
        "tagPicList": null,
        "resourceState": true,
        "version": 22,
        "songJumpInfo": null,
        "entertainmentTags": null,
        "awardTags": null,
        "displayTags": null,
        "single": 0,
        "noCopyrightRcmd": null,
        "alg": null,
        "displayReason": null,
        "pubDJProgramData": null,
        "rtype": 0,
        "rurl": null,
        "mst": 9,
        "cp": 663018,
        "mv": 0,
        "publishTime": 1313164800000,
        "tns": ["唯一的希望"]
      },
      {
        "name": "i Love",
        "mainTitle": null,
        "additionalTitle": null,
        "id": 28953511,
        "pst": 0,
        "t": 0,
        "ar": [
          {
            "id": 797335,
            "name": "azusa",
            "tns": [],
            "alias": []
          }
        ],
        "alia": ["TV动画《圣诞之吻SS》OP1 ； TVアニメ「アマガミSS」OP1テーマ"],
        "pop": 90,
        "st": 0,
        "rt": null,
        "fee": 1,
        "v": 78,
        "crbt": null,
        "cf": "",
        "al": {
          "id": 2957091,
          "name": "i Love",
          "picUrl": "http://p3.music.126.net/hMhR9R35fqW2VDCueNMb1Q==/109951163597080965.jpg",
          "tns": [],
          "pic_str": "109951163597080965",
          "pic": 109951163597080960
        },
        "dt": 265880,
        "h": {
          "br": 320000,
          "fid": 0,
          "size": 10638150,
          "vd": -33399
        },
        "m": {
          "br": 192000,
          "fid": 0,
          "size": 6382907,
          "vd": -30825
        },
        "l": {
          "br": 128000,
          "fid": 0,
          "size": 4255286,
          "vd": -29077
        },
        "sq": {
          "br": 974085,
          "fid": 0,
          "size": 32373718,
          "vd": -33382
        },
        "hr": null,
        "a": null,
        "cd": "1",
        "no": 1,
        "rtUrl": null,
        "ftype": 0,
        "rtUrls": [],
        "djId": 0,
        "copyright": 2,
        "s_id": 0,
        "mark": 17180139520,
        "originCoverType": 1,
        "originSongSimpleData": null,
        "tagPicList": null,
        "resourceState": true,
        "version": 44,
        "songJumpInfo": null,
        "entertainmentTags": null,
        "awardTags": null,
        "displayTags": null,
        "single": 0,
        "noCopyrightRcmd": null,
        "alg": null,
        "displayReason": null,
        "pubDJProgramData": null,
        "rtype": 0,
        "rurl": null,
        "mst": 9,
        "cp": 2709832,
        "mv": 0,
        "publishTime": 1279670400000
      },
      {
        "name": "from Y to Y",
        "mainTitle": null,
        "additionalTitle": null,
        "id": 4890973,
        "pst": 0,
        "t": 0,
        "ar": [
          {
            "id": 15436,
            "name": "ジミーサムP",
            "tns": [],
            "alias": []
          },
          {
            "id": 159692,
            "name": "初音ミク",
            "tns": [],
            "alias": []
          }
        ],
        "alia": [],
        "pop": 50,
        "st": 0,
        "rt": "",
        "fee": 0,
        "v": 65,
        "crbt": null,
        "cf": "",
        "al": {
          "id": 491004,
          "name": "EXIT TUNES PRESENTS Vocalostar feat.初音ミク",
          "picUrl": "http://p4.music.126.net/Nc6WGO_IoV2l0JRm8j-4vA==/2262794930014227.jpg",
          "tns": [],
          "pic": 2262794930014227
        },
        "dt": 330933,
        "h": {
          "br": 320000,
          "fid": 0,
          "size": 13239946,
          "vd": -73773
        },
        "m": null,
        "l": {
          "br": 128000,
          "fid": 0,
          "size": 5296004,
          "vd": -69852
        },
        "sq": {
          "br": 932281,
          "fid": 0,
          "size": 38571425,
          "vd": -73757
        },
        "hr": null,
        "a": null,
        "cd": "1",
        "no": 17,
        "rtUrl": null,
        "ftype": 0,
        "rtUrls": [],
        "djId": 0,
        "copyright": 2,
        "s_id": 0,
        "mark": 9007199255003136,
        "originCoverType": 0,
        "originSongSimpleData": null,
        "tagPicList": null,
        "resourceState": true,
        "version": 31,
        "songJumpInfo": null,
        "entertainmentTags": null,
        "awardTags": null,
        "displayTags": null,
        "single": 0,
        "noCopyrightRcmd": null,
        "alg": null,
        "displayReason": null,
        "pubDJProgramData": null,
        "rtype": 0,
        "rurl": null,
        "mst": 9,
        "cp": 663018,
        "mv": 0,
        "publishTime": 1245168000000
      }
    ]"#,
        ))
    }
}
