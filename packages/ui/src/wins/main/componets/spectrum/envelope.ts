/** 显示高度的唯一默认时间平滑：快起、缓落，独立于 worker 的分析帧率。 */
export class SpectrumEnvelope {
  private values = new Float32Array(0);

  advance(target: Float32Array, elapsedMs: number, active = true): Float32Array<ArrayBuffer> {
    if (this.values.length !== target.length) this.values = new Float32Array(target.length);
    const dt = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(1000, elapsedMs)) : 0;
    const attack = Math.exp(-dt / 32);
    const release = Math.exp(-dt / 160);
    for (let i = 0; i < target.length; i++) {
      const value = active && Number.isFinite(target[i]) ? Math.max(0, Math.min(1, target[i]!)) : 0;
      const previous = this.values[i]!;
      const factor = value > previous ? attack : release;
      const next = value + (previous - value) * factor;
      this.values[i] = next < 0.001 ? 0 : next;
    }
    return this.values;
  }
}
