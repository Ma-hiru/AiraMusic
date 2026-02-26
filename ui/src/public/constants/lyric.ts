function getPreset(tips: string): FullVersionLyricLine {
  return {
    full: [],
    rm: [],
    tl: [],
    raw: [
      {
        words: [
          {
            startTime: 0,
            endTime: 999999999999,
            word: tips,
            romanWord: ""
          }
        ],
        translatedLyric: "",
        romanLyric: "",
        startTime: 0,
        endTime: 999999999999,
        isBG: false,
        isDuet: false
      }
    ]
  };
}

export const noLyricPreset = getPreset("暂无歌词");

export const pureMusicLyricPreset = getPreset("纯音乐，请欣赏");

export const loadErrorLyricPreset = getPreset("歌词加载失败");
