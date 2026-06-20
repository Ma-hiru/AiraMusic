export class RendererLyricConstants {
  static getPreset(tips: string) {
    return <NeteaseLyricModel>{
      data: [
        {
          words: [
            {
              startTime: 0,
              endTime: 999999,
              word: tips
            }
          ],
          translatedLyric: "",
          romanLyric: "",
          startTime: 0,
          endTime: 999999
        }
      ],
      rmActive: false,
      tlActive: false,
      rmExisted: false,
      tlExisted: false,
      noteExisted: false
    };
  }

  static get noLyricPreset() {
    return this.getPreset("暂无歌词");
  }

  static get pureMusicLyricPreset() {
    return this.getPreset("纯音乐，请欣赏");
  }

  static get loadErrorLyricPreset() {
    return this.getPreset("歌词加载失败");
  }
}
