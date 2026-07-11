export class RendererImagePreviewConstants {
  static readonly MIN_SCALE = 0.25;
  static readonly MAX_SCALE = 5;
  static readonly WHEEL_STEP = 0.12;
  static readonly BUTTON_ZOOM_STEP = 0.35;
  static readonly ROTATE_STEP = 90;
  static readonly DOUBLE_TAP_DELAY = 300;
  static readonly DOUBLE_TAP_DISTANCE = 30;
  static readonly MOVE_THRESHOLD = 10;
  static readonly TOOLBAR_HIDE_DELAY = 3000;
  static readonly EMPTY_IMAGE: { alt?: string; url?: string } = {};
}
