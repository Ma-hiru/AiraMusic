export class MainExitCodeConstants {
  static readonly NORMAL_EXIT = 0;
  static readonly MULTI_INSTANCE = this.NORMAL_EXIT;
  static readonly SERVICES_START_ERROR = 1;
  static readonly REGISTER_PROTOCOL_FAILED = 2;
  static readonly REGISTER_IPC_HANDLERS_FAILED = 3;
  static readonly LAUNCH_MAIN_RENDERER_FAILED = 4;
  static readonly UNCAUGHT_ERROR = 5;
}
