type AMLLyricLine = {
  isBG: boolean;
  endTime: number;
  isDuet: boolean;
  startTime: number;
  romanLyric: string;
  translatedLyric: string;
  words: {
    word: string;
    endTime: number;
    romanWord: string;
    startTime: number;
  }[];
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
