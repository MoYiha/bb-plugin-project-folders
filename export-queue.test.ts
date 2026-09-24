import { afterEach, describe, expect, it, vi } from "vitest";
import { makeExportQueue } from "./export-queue";

afterEach(() => vi.useRealTimers());

describe("automatic export queue", () => {
  it("coalesces bursts and runs only one export at a time", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const run = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            release = r;
          }),
      )
      .mockResolvedValue(undefined);
    const settled = vi.fn();
    const q = makeExportQueue({ run, settled, failed: vi.fn() });
    q.enqueue("a");
    q.enqueue("a");
    q.enqueue("b");
    await vi.advanceTimersByTimeAsync(2000);
    expect(run.mock.calls).toEqual([["a"]]);
    q.enqueue("a");
    release();
    await vi.advanceTimersByTimeAsync(1);
    expect(run.mock.calls).toEqual([["a"], ["b"]]);
    expect(settled.mock.calls).toEqual([["b"]]);
    await vi.advanceTimersByTimeAsync(30000);
    expect(run.mock.calls).toEqual([["a"], ["b"], ["a"]]);
    expect(settled.mock.calls).toEqual([["b"], ["a"]]);
    await q.stop();
  });

  it("retries a failed export without blocking another chat", async () => {
    vi.useFakeTimers();
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const failed = vi.fn();
    const settled = vi.fn();
    const q = makeExportQueue({ run, settled, failed });
    q.enqueue("a");
    q.enqueue("b");
    await vi.advanceTimersByTimeAsync(2001);
    expect(run.mock.calls).toEqual([["a"], ["b"]]);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(settled.mock.calls).toEqual([["b"]]);
    await vi.advanceTimersByTimeAsync(60000);
    expect(settled.mock.calls).toEqual([["b"], ["a"]]);
    await q.stop();
  });

  it("stops queued work and waits for an active export before disposal", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const q = makeExportQueue({ run, settled: vi.fn(), failed: vi.fn() });
    q.enqueue("a");
    q.enqueue("b");
    await vi.advanceTimersByTimeAsync(2000);
    const done = vi.fn();
    const stop = q.stop().then(done);
    await vi.advanceTimersByTimeAsync(10000);
    expect(done).not.toHaveBeenCalled();
    release();
    await stop;
    await vi.advanceTimersByTimeAsync(60000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
