type MediaDevicesMock = Pick<
  MediaDevices,
  "addEventListener" | "enumerateDevices" | "removeEventListener"
>;
type AudioSinkIdMock = string | { type: "none" };
type AudioElementMock = {
  sinkId: string;
  readyState: number;
  setSinkId: ReturnType<typeof vi.fn<(sinkId: string) => Promise<void>>>;
};
type AudioContextMock = {
  sinkId: AudioSinkIdMock;
  setSinkId?: ReturnType<typeof vi.fn<(sinkId: AudioSinkIdMock) => Promise<void>>>;
};
type AudioTargetMock = {
  sinkId?: string;
  audio: AudioElementMock;
  context: null | AudioContextMock;
};

describe("RendererOutput", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } satisfies MediaDevicesMock
    });
  });

  it("uses AudioContext.setSinkId as the active playback route when Web Audio is attached", async () => {
    const { RendererOutput } = await import("@mahiru/ui/common/lib/output");
    const context = createContextMock();
    const audio = createAudioMock({
      setSinkId: vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
    });
    const target: AudioTargetMock = { audio, context };

    await expect(RendererOutput.set(target, "device-1")).resolves.toBeUndefined();

    expect(context.setSinkId).toHaveBeenCalledWith("device-1");
    expect(audio.setSinkId).not.toHaveBeenCalled();
    expect(RendererOutput.currentID(target)).toBe("device-1");
    expect(target.sinkId).toBe("device-1");
  });

  it("fails the switch when the attached AudioContext cannot change output", async () => {
    const { RendererOutput } = await import("@mahiru/ui/common/lib/output");
    const context = createContextMock({
      setSinkId: vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
    });
    const audio = createAudioMock();

    await expect(RendererOutput.set({ audio, context }, "device-1")).rejects.toMatchObject({
      phase: "AudioContext.setSinkId",
      deviceId: "device-1",
      name: "AbortError"
    });

    expect(audio.setSinkId).not.toHaveBeenCalled();
  });

  it("falls back to the media element path when the attached AudioContext cannot select a sink", async () => {
    const { RendererOutput } = await import("@mahiru/ui/common/lib/output");
    const context = createContextMock({ setSinkId: undefined });
    const audio = createAudioMock();

    await RendererOutput.set({ audio, context }, "device-1");

    expect(audio.setSinkId).toHaveBeenCalledWith("device-1");
    expect(RendererOutput.currentID({ audio, context })).toBe("device-1");
  });

  it("falls back to the media element path when no AudioContext is attached", async () => {
    const { RendererOutput } = await import("@mahiru/ui/common/lib/output");
    const audio = createAudioMock();
    const target: AudioTargetMock = { audio, context: null };

    await RendererOutput.set(target, "device-1");

    expect(audio.setSinkId).toHaveBeenCalledWith("device-1");
    expect(RendererOutput.currentID(target)).toBe("device-1");
  });
});

function createAudioMock(props: Partial<AudioElementMock> = {}) {
  const audio = {
    readyState: 4,
    sinkId: "",
    setSinkId: vi.fn(async (sinkId: string) => {
      audio.sinkId = sinkId;
    }),
    ...props
  };
  return audio;
}

function createContextMock(props: Partial<AudioContextMock> = {}) {
  const context = {
    sinkId: "",
    setSinkId: vi.fn(async (sinkId: AudioSinkIdMock) => {
      context.sinkId = sinkId;
    }),
    ...props
  };
  return context;
}
