import { apiRequest } from "@/common/netease/api/request";

export default class _NeteaseRecordAPI {
  /** @desc 听歌足迹 - 今日收听 */
  static today() {
    return apiRequest<unknown, NeteaseAPI.NeteaseToplistResponse>(
      `/listen/data/today/song?timestamp=${Date.now()}`
    );
  }

  /**
   * @desc 听歌足迹 - 总收听时长
   * 说明 : 登录后调用此接口, 获取总收听时长; 相关接口可能需要 vip 权限
   * */
  static total() {
    return apiRequest<
      unknown,
      NeteaseAPI.NeteaseAPIResponse & {
        data: {
          totalDuration: number;
          message: string;
        };
      }
    >(`/listen/data/total?timestamp=${Date.now()}`);
  }

  /** @desc 听歌足迹 - 本周收听时长 */
  static week() {
    return apiRequest<unknown, NeteaseAPI.NeteaseWeekDurationResponse>(
      `/listen/data/realtime/report?type=week&timestamp=${Date.now()}`
    );
  }

  /** @desc 听歌足迹 - 本月收听时长 */
  static month() {
    return apiRequest<unknown, NeteaseAPI.NeteaseMonthDurationResponse>(
      `/listen/data/realtime/report?type=month&timestamp=${Date.now()}`
    );
  }

  /**
   * @desc 听歌足迹 - 周/月/年收听报告
   * @param endTime 周: 每周周六 0 点的时间戳 月: 每月最后一天 0 点的时间戳 年: 每年最后一天 0 点的时间戳 不填就是本周/月的, 今年没结束，则没有今年的数据
   * @param type type: 维度类型 周 week 月 month 年 year
   * */
  static report(type: "week" | "month" | "year", endTime?: number) {
    return apiRequest<unknown, NeteaseAPI.NeteaseAPIResponse>(
      `/listen/data/report?timestamp=${Date.now()}`,
      {
        params: { type, endTime }
      }
    );
  }
}
