interface NeteaseSongUrlResponse extends NeteaseAPIResponse {
  data: NeteaseSongUrlItem[];
}

interface NeteaseLikedSongIdsResponse extends NeteaseAPIResponse {
  ids: number[];
  checkPoint: number;
}

interface NeteaseSongUrlItem {
  id: number;
  url: string | null;
  br: number;
  size: number;
  type: string;
  encodeType?: string;
  /** 试听片段附加信息。 */
  freeTrialInfo?: Record<string, any> | null;
}

interface NeteaseTopSongResponse extends NeteaseAPIResponse {
  data: Datum[];
}

interface Datum {
  album: Album;
  albumData: null;
  alias: string[];
  artists: DatumArtist[];
  audition: null;
  bMusic: BMusic;
  commentThreadId: string;
  copyFrom: string;
  copyrightId: number;
  crbt: null;
  dayPlays: number;
  disc: string;
  duration: number;
  exclusive: boolean;
  fee: number;
  ftype: number;
  hearTime: number;
  hMusic: HMusic;
  id: number;
  lMusic: LMusic;
  mMusic: MMusic;
  mp3Url: null | string;
  mvid: number;
  name: string;
  no: number;
  playedNum: number;
  popularity: number;
  position: number;
  privilege: NeteaseSongPrivilege;
  relatedVideo: null;
  ringtone: string;
  rtUrl: null;
  rtUrls: null;
  rtype: number;
  rurl: null;
  score: number;
  st: number;
  starred: boolean;
  starredNum: number;
  status: number;
  transNames: string[];
  videoInfo: null;
}

interface Album {
  alias: string[];
  artist: PurpleArtist;
  artists: FluffyArtist[];
  blurPicUrl: string;
  briefDesc: string;
  commentThreadId: string;
  company: string;
  companyId: number;
  copyrightId: number;
  description: string;
  id: number;
  name: string;
  onSale: boolean;
  paid: boolean;
  pic: number;
  picId: number;
  picId_str: string;
  picUrl: string;
  publishTime: number;
  size: number;
  songs: null;
  status: number;
  subType: string;
  tags: string;
  transNames?: string[];
  type: string;
}

interface PurpleArtist {
  albumSize: number;
  alias: string[];
  briefDesc: string;
  followed: boolean;
  id: number;
  img1v1Id: number;
  img1v1Id_str: string;
  img1v1Url: string;
  musicSize: number;
  name: string;
  picId: number;
  picUrl: string;
  topicPerson: number;
  trans: string;
}

interface FluffyArtist {
  albumSize: number;
  alias: string[];
  briefDesc: string;
  followed: boolean;
  id: number;
  img1v1Id: number;
  img1v1Id_str: string;
  img1v1Url: string;
  musicSize: number;
  name: string;
  picId: number;
  picUrl: string;
  topicPerson: number;
  trans: string;
}

interface DatumArtist {
  albumSize: number;
  alias: string[];
  briefDesc: string;
  followed: boolean;
  id: number;
  img1v1Id: number;
  img1v1Id_str: string;
  img1v1Url: string;
  musicSize: number;
  name: string;
  picId: number;
  picUrl: string;
  topicPerson: number;
  trans: string;
}

interface BMusic {
  bitrate: number;
  dfsId: number;
  extension: string;
  id: number;
  name: null;
  playTime: number;
  size: number;
  sr: number;
  volumeDelta: number;
}

interface HMusic {
  bitrate: number;
  dfsId: number;
  extension: string;
  id: number;
  name: null;
  playTime: number;
  size: number;
  sr: number;
  volumeDelta: number;
}

interface LMusic {
  bitrate: number;
  dfsId: number;
  extension: string;
  id: number;
  name: null;
  playTime: number;
  size: number;
  sr: number;
  volumeDelta: number;
}

interface MMusic {
  bitrate: number;
  dfsId: number;
  extension: string;
  id: number;
  name: null;
  playTime: number;
  size: number;
  sr: number;
  volumeDelta: number;
}

interface NeteaseSongPrivilege {
  chargeInfoList: ChargeInfoList[];
  cp: number;
  cs: boolean;
  dl: number;
  dlLevel: string;
  downloadMaxbr: number;
  downloadMaxBrLevel: string;
  fee: number;
  fl: number;
  flag: number;
  flLevel: string;
  freeTrialPrivilege: FreeTrialPrivilege;
  id: number;
  maxbr: number;
  maxBrLevel: string;
  payed: number;
  pl: number;
  playMaxbr: number;
  playMaxBrLevel: string;
  plLevel: string;
  preSell: boolean;
  rightSource: number;
  rscl: null;
  sp: number;
  st: number;
  subp: number;
  toast: boolean;
}
