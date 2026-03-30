namespace NeteaseAPI {
  interface NeteaseBannerResponse extends NeteaseAPIResponse {
    banners: NeteaseBanner[];
    trp: NeteaseTrp;
  }

  interface NeteaseBanner {
    bigImageUrl: string;
    imageUrl: string;
    s_ctrp: string;
    targetId: number;
    targetType: number;
    typeTitle: string | "独家策划" | "新歌首发" | "数字专辑" | "新碟首发" | "热歌推荐";
    url: string;
  }

  interface NeteaseTrp {
    rules: string[];
  }
}
