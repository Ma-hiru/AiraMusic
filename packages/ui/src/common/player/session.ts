import { Listenable } from "@/common/utils/listenable";
import { NeteaseSession } from "@/common/netease/models";
import dayjs from "dayjs";

export default class RendererPlayerSession extends Listenable {
  private session: NeteaseSession;
  private track_id: number;

  get netease_session() {
    return this.session;
  }

  get sessionId() {
    return this.session.id;
  }

  get trackId() {
    return this.track_id;
  }

  get createAt() {
    return this.session.createAt;
  }

  constructor(
    props: { trackId: number; session: NeteaseSession } = {
      trackId: 0,
      session: NeteaseSession.generate()
    }
  ) {
    super("NeteaseSession");
    this.session = props.session;
    this.track_id = props.trackId;
  }

  /** @desc 两个 session 是否相同 */
  equals(other: { trackId: number; session: { id: string } }): boolean {
    return this.sessionId === other.session.id && this.trackId === other.trackId;
  }

  /** @return 从创建到现在经过的分钟数 */
  elapse(): number {
    const now = dayjs();
    return now.diff(this.createAt, "minute");
  }

  next(trackId: number) {
    this.track_id = trackId;
    this.updateSession();
  }

  updateSession() {
    this.session = NeteaseSession.generate();
    this.executeListeners();
  }

  static save(instance: RendererPlayerSession) {
    return {
      session: { ...instance.session },
      trackId: instance.track_id
    };
  }

  static fromSave(save: ReturnType<typeof this.save>): RendererPlayerSession {
    if (!save) return new RendererPlayerSession(); //兼容性代码
    return new RendererPlayerSession({
      ...save,
      session: new NeteaseSession(
        NeteaseSession.checkId(save.session.id) ? save.session.id : NeteaseSession.generateId(),
        save.session.createAt
      )
    });
  }
}
