import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models/NeteaseTrackRecord";

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
    desc: {
      /** 简要介绍 */
      briefDesc: string;
      count: number;
      introduction: {
        /** 介绍文本的标题 */
        ti: string;
        /** 介绍文本的内容 */
        txt: string;
      }[];
    };
    hotTracks: NeteaseTrackRecord[];
    followInfos: NeteaseAPI.NeteaseArtistFollowCountResponse["data"];
  }) {
    this.id = props.id;
    this.name = props.name;
    this.detail = props.detail;
    this.desc = props.desc;
    this.hotTracks = props.hotTracks;
    this.followInfos = props.followInfos;
  }

  static fromNeteaseAPIs(props: {
    detail: NeteaseAPI.NeteaseArtistDetailResponse;
    desc: NeteaseAPI.NeteaseArtistDescResponse;
    followInfos: NeteaseAPI.NeteaseArtistFollowCountResponse;
    hotTracks: NeteaseTrackRecord[];
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

  static fromObject(obj: NeteaseArtist) {
    return new NeteaseArtist({
      id: obj.id,
      name: obj.name,
      detail: obj.detail,
      desc: obj.desc,
      hotTracks: obj.hotTracks.map(NeteaseTrackRecord.fromObject),
      followInfos: obj.followInfos
    });
  }
}
