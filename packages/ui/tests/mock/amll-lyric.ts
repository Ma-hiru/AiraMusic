type AMLLyricLine = {
  words: {
    word: string;
    romanWord: string;
    startTime: number;
    endTime: number;
  }[];
  translatedLyric: string;
  romanLyric: string;
  isBG: boolean;
  isDuet: boolean;
  startTime: number;
  endTime: number;
};

type TTMLMock = {
  lines: AMLLyricLine[];
  metadata: [string, string[]][];
};

let ttmlMock: TTMLMock = {
  lines: [],
  metadata: []
};

export function setTTMLMock(mock: TTMLMock) {
  ttmlMock = mock;
}

export function parseTTML() {
  return ttmlMock;
}

export function parseLrc() {
  return [];
}

export function parseQrc() {
  return [];
}

export function parseYrc() {
  return [];
}
