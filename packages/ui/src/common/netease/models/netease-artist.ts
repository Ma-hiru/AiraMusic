import { NeteaseTrackRecord } from "./netease-track-record";

export class NeteaseArtist {
  id;
  name;
  detail;
  desc;
  hotTracks;
  followInfos;

  constructor(props: {
    id: number;
    name: string;
    detail: NeteaseAPI.ArtistDetail;
    hotTracks: NeteaseTrackRecord[];
    followInfos: NeteaseAPI.NeteaseArtistFollowCountResponse["data"];
    desc: {
      /** 简要介绍 */
      count: number;
      briefDesc: string;
      introduction: {
        /** 介绍文本的标题 */
        ti: string;
        /** 介绍文本的内容 */
        txt: string;
      }[];
    };
  }) {
    this.id = props.id;
    this.name = props.name;
    this.detail = props.detail;
    this.desc = props.desc;
    this.hotTracks = props.hotTracks;
    this.followInfos = props.followInfos;
  }

  static fromNeteaseAPIs(props: {
    hotTracks: NeteaseTrackRecord[];
    desc: NeteaseAPI.NeteaseArtistDescResponse;
    detail: NeteaseAPI.NeteaseArtistDetailResponse;
    followInfos: NeteaseAPI.NeteaseArtistFollowCountResponse;
  }) {
    return new NeteaseArtist({
      id: props.detail.data.artist.id,
      name: props.detail.data.artist.name,
      detail: props.detail.data,
      desc: props.desc,
      hotTracks: props.hotTracks,
      followInfos: props.followInfos.data
    });
  }

  static fromObject(obj: Jsonify<NeteaseArtist>) {
    return new NeteaseArtist({
      id: obj.id,
      name: obj.name,
      detail: obj.detail,
      desc: obj.desc,
      hotTracks: obj.hotTracks.map(NeteaseTrackRecord.fromRecordObject),
      followInfos: obj.followInfos
    });
  }
}
