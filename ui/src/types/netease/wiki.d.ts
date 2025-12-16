interface NeteaseUGCSongResponse extends NeteaseAPIResponse {
  data: NeteaseUGCSongData;
  message: string;
}

interface NeteaseUGCSongData {
  albumRepVo: {
    albumId: number;
    albumName: string;
    albumPicUrl: null;
    albumSubTitle: null;
    artistRepVos: null;
    company: null;
    language: null;
    production: null;
    publishTime: null;
    songRepVos: null;
    songTags: null;
    transName: null;
    type: null;
  };
  arrangeArtists: string[];
  artistRepVos: {
    alias: null;
    area: null;
    artistId: number;
    artistName: string;
    avatarPicUrl: null;
    desc: null;
    headPicUrl: null;
    production: null;
    transName: null;
    type: null;
  }[];
  company: null;
  composeArtists: {
    alias?: null;
    area?: null;
    artistId: number;
    artistName: string;
    avatarPicUrl?: null;
    desc?: null;
    headPicUrl?: null;
    production?: null;
    transName?: null;
    type?: null;
  }[];
  disc: string;
  duration: number;
  forTransLyric: number;
  language: string;
  lyricArtists: {
    alias?: null;
    area?: null;
    artistId: number;
    artistName: string;
    avatarPicUrl?: null;
    desc?: null;
    headPicUrl?: null;
    production?: null;
    transName?: null;
    type?: null;
  }[];
  lyricContent: string;
  lyricIsEdited: number;
  lyricLock: number;
  mvIds: number[];
  no: null;
  noNeedLyric: number;
  originalCover: number;
  originalSong: null;
  playUrl: string;
  publishTime: number;
  roleArtists: null;
  songId: number;
  songName: string;
  songSubTitle: string;
  songTags: null;
  transLyricContent: string;
  transLyricLock: number;
  transName: null;
}

interface NeteaseUGCAlbumResponse extends NeteaseAPIResponse {
  data: NeteaseUGCAlbumData;
  message: string;
}

interface NeteaseUGCAlbumData {
  albumId: number;
  albumName: string;
  albumPicUrl: string;
  albumSubTitle: null;
  artistRepVos: {
    alias?: null;
    area?: null;
    artistId?: number;
    artistName?: string;
    avatarPicUrl?: null;
    desc?: null;
    headPicUrl?: null;
    production?: null;
    transName?: null;
    type?: null;
  }[];
  company: string;
  language: string;
  production: null;
  publishTime: number;
  songRepVos: {
    albumRepVo: null;
    arrangeArtists: null;
    artistRepVos: {
      alias: null;
      area: null;
      artistId: number;
      artistName: string;
      avatarPicUrl: null;
      desc: null;
      headPicUrl: null;
      production: null;
      transName: null;
      type: null;
    }[];
    company: null;
    composeArtists: null;
    disc: string;
    duration: null;
    forTransLyric: null;
    language: null | string;
    lyricArtists: null;
    lyricContent: null;
    lyricIsEdited: null;
    lyricLock: null;
    mvIds: null;
    no: number;
    noNeedLyric: null;
    originalCover: null;
    originalSong: null;
    playUrl: null;
    publishTime: number;
    roleArtists: null;
    songId: number;
    songName: string;
    songSubTitle: null | string;
    songTags: {
      id: number;
      name: string;
    }[];
    transLyricContent: null;
    transLyricLock: null;
    transName: null;
  }[];
  songTags: { id?: number; name?: string }[];
  transName: null;
  type: string;
}
