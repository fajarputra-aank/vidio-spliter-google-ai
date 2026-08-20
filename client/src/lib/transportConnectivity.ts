import { useEffect, useState } from "react";

export type TransportConnectivityState = "stable" | "recovering" | "recovered";

let currentState: TransportConnectivityState = "stable";
let clearTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(state: TransportConnectivityState) => void>();

function emit(next: TransportConnectivityState) {
  currentState = next;
  listeners.forEach((listener) => listener(next));
}

function clearAfter(ms: number) {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => emit("stable"), ms);
}

/** Report only transient client state; nothing is persisted or sent from this module. */
export function reportTemporaryTransportFallback() {
  emit("recovering");
  clearAfter(12_000);
}

export function reportTransportRecovered() {
  emit("recovered");
  clearAfter(4_000);
}

export function subscribeTransportConnectivity(listener: (state: TransportConnectivityState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTransportConnectivity() {
  const [state, setState] = useState<TransportConnectivityState>(currentState);
  useEffect(() => subscribeTransportConnectivity(setState), []);
  return state;
}

export function resetTransportConnectivityForTests() {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  emit("stable");
}
