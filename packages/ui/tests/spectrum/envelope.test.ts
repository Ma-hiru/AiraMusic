import { SpectrumEnvelope } from "@mahiru/ui/wins/main/componets/spectrum/envelope";

describe("SpectrumEnvelope", () => {
  it("has the same attack and release duration across screen refresh rates", () => {
    const tails: number[] = [];
    for (const fps of [30, 60, 120]) {
      const envelope = new SpectrumEnvelope();
      let values = new Float32Array(0);
      for (let i = 0; i < fps; i++) {
        values = envelope.advance(new Float32Array([1]), 1000 / fps);
      }
      expect(values[0]).toBeGreaterThan(0.99);
      for (let i = 0; i < fps / 2; i++) {
        values = envelope.advance(new Float32Array([0]), 1000 / fps);
      }
      expect(values[0]).toBeLessThan(0.05);
      tails.push(values[0]!);
    }
    expect(tails[0]).toBeCloseTo(tails[2]!, 5);
  });

  it("moves between worker updates and settles on pause despite stale data", () => {
    const envelope = new SpectrumEnvelope();
    const target = new Float32Array([0.8]);
    const first = envelope.advance(target, 1000 / 60)[0]!;
    const next = envelope.advance(target, 1000 / 60)[0]!;
    expect(next).toBeGreaterThan(first);
    for (let i = 0; i < 90; i++) envelope.advance(target, 1000 / 60, false);
    expect(envelope.advance(target, 0, false)[0]).toBe(0);
  });

  it("handles changing band counts and invalid input without propagating NaN", () => {
    const envelope = new SpectrumEnvelope();
    envelope.advance(new Float32Array([1]), 100);
    const frame = envelope.advance(new Float32Array([NaN, Infinity, -1, 2]), 100);
    expect(frame).toHaveLength(4);
    expect(Array.from(frame).every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
  });
});
