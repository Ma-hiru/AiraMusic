function getPreset(tips: string) {
  return <NeteaseLyricModel>{
    data: [],
    rmActive: false,
    tlActive: false,
    rmExisted: false,
    tlExisted: false,
    noteExisted: false,
    tips
  };
}

export const noLyricPreset = getPreset("暂无歌词");

export const pureMusicLyricPreset = getPreset("纯音乐，请欣赏");

export const loadErrorLyricPreset = getPreset("歌词加载失败");
