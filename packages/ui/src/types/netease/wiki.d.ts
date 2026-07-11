namespace NeteaseAPI {
  interface NeteaseUGCSongResponse extends NeteaseAPIResponse {
    message: string;
    data: NeteaseUGCSongData;
  }

  interface NeteaseUGCSongData {
    no: null;
    disc: string;
    company: null;
    songId: number;
    songTags: null;
    mvIds: number[];
    playUrl: string;
    transName: null;
    duration: number;
    language: string;
    songName: string;
    lyricLock: number;
    roleArtists: null;
    originalSong: null;
    noNeedLyric: number;
    publishTime: number;
    lyricContent: string;
    songSubTitle: string;
    forTransLyric: number;
    lyricIsEdited: number;
    originalCover: number;
    transLyricLock: number;
    arrangeArtists: string[];
    transLyricContent: string;
    artistRepVos: {
      area: null;
      desc: null;
      type: null;
      alias: null;
      transName: null;
      artistId: number;
      headPicUrl: null;
      production: null;
      artistName: string;
      avatarPicUrl: null;
    }[];
    lyricArtists: {
      area?: null;
      desc?: null;
      type?: null;
      alias?: null;
      artistId: number;
      transName?: null;
      headPicUrl?: null;
      production?: null;
      artistName: string;
      avatarPicUrl?: null;
    }[];
    composeArtists: {
      area?: null;
      desc?: null;
      type?: null;
      alias?: null;
      artistId: number;
      transName?: null;
      headPicUrl?: null;
      production?: null;
      artistName: string;
      avatarPicUrl?: null;
    }[];
    albumRepVo: {
      type: null;
      company: null;
      language: null;
      songTags: null;
      albumId: number;
      transName: null;
      production: null;
      songRepVos: null;
      albumName: string;
      albumPicUrl: null;
      publishTime: null;
      artistRepVos: null;
      albumSubTitle: null;
    };
  }

  interface NeteaseUGCAlbumResponse extends NeteaseAPIResponse {
    message: string;
    data: NeteaseUGCAlbumData;
  }

  interface NeteaseUGCAlbumData {
    type: string;
    albumId: number;
    company: string;
    transName: null;
    language: string;
    production: null;
    albumName: string;
    albumPicUrl: string;
    albumSubTitle: null;
    publishTime: number;
    songTags: { id?: number; name?: string }[];
    artistRepVos: {
      area?: null;
      desc?: null;
      type?: null;
      alias?: null;
      transName?: null;
      artistId?: number;
      headPicUrl?: null;
      production?: null;
      artistName?: string;
      avatarPicUrl?: null;
    }[];
    songRepVos: {
      no: number;
      mvIds: null;
      disc: string;
      company: null;
      playUrl: null;
      duration: null;
      songId: number;
      lyricLock: null;
      transName: null;
      albumRepVo: null;
      songName: string;
      noNeedLyric: null;
      roleArtists: null;
      lyricArtists: null;
      lyricContent: null;
      originalSong: null;
      forTransLyric: null;
      lyricIsEdited: null;
      originalCover: null;
      publishTime: number;
      arrangeArtists: null;
      composeArtists: null;
      transLyricLock: null;
      language: null | string;
      transLyricContent: null;
      songSubTitle: null | string;
      songTags: {
        id: number;
        name: string;
      }[];
      artistRepVos: {
        area: null;
        desc: null;
        type: null;
        alias: null;
        transName: null;
        artistId: number;
        headPicUrl: null;
        production: null;
        artistName: string;
        avatarPicUrl: null;
      }[];
    }[];
  }
}
