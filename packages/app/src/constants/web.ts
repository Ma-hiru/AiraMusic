export class MainWebSearchPageConstants {
  static readonly DEFAULT_CONTENT_CHARS = 6_000;
  static readonly MAX_CONTENT_CHARS = 12_000;
  static readonly METADATA_CHARS = 4_000;
  static readonly OUTPUT_CHARS = 7_400;
  static readonly MAX_LINKS = 10;
  static readonly MAX_IMAGES = 6;
  static readonly DEFAULT_ITEMS = 6;
  static readonly MAX_SOURCE_CHARS = 120_000;
  static readonly MAX_PAGE_CACHE_CHARS = 512_000;
  static readonly EXTRACTION_LIMITS = {
    maxNodes: 4_000,
    maxDepth: 64,
    maxContentChars: this.MAX_SOURCE_CHARS,
    maxAttributeChars: 16_000,
    maxLinks: 40,
    maxImages: 40,
    maxURLChars: 2_048,
    maxTitleChars: 500,
    maxSearchChars: 10_000,
    maxContextChars: 350
  };
  static readonly SNAPSHOT_LIMITS = {
    maxChars: 12_000,
    maxNodes: 2_000,
    maxDepth: 64,
    maxAttributeChars: 2_048
  };
}
