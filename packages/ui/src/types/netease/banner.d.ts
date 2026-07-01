namespace NeteaseAPI {
  interface NeteaseBannerResponse extends NeteaseAPIResponse {
    trp: NeteaseTrp;
    banners: NeteaseBanner[];
  }

  interface NeteaseBanner {
    url: string;
    s_ctrp: string;
    imageUrl: string;
    targetId: number;
    targetType: number;
    bigImageUrl: string;
    typeTitle: "数字专辑" | "新歌首发" | "新碟首发" | "热歌推荐" | "独家策划" | string;
  }

  interface NeteaseTrp {
    rules: string[];
  }
}
