import { afterEach, describe, expect, it, vi } from "vitest";
import { reportTemporaryTransportFallback, reportTransportRecovered, resetTransportConnectivityForTests, subscribeTransportConnectivity } from "./transportConnectivity";

describe("transport connectivity state", () => {
  afterEach(() => {
    resetTransportConnectivityForTests();
    vi.useRealTimers();
  });

  it("shows temporary recovery then clears an unresolved fallback", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const unsubscribe = subscribeTransportConnectivity((state) => seen.push(state));
    reportTemporaryTransportFallback();
    vi.advanceTimersByTime(12_000);
    unsubscribe();
    expect(seen).toEqual(["recovering", "stable"]);
  });

  it("shows a short recovered state after the retry returns JSON", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const unsubscribe = subscribeTransportConnectivity((state) => seen.push(state));
    reportTemporaryTransportFallback();
    reportTransportRecovered();
    vi.advanceTimersByTime(4_000);
    unsubscribe();
    expect(seen).toEqual(["recovering", "recovered", "stable"]);
  });
});
