import { writable } from 'svelte/store';

/** Global toast notifications so errors/successes are surfaced to the user
 * instead of being silently swallowed. Rendered by <Toasts /> in the layout. */
export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DEFAULT_TTL_MS = 6000;

export const toasts = writable<Toast[]>([]);

let _id = 0;

export function pushToast(kind: ToastKind, message: string, ttlMs = DEFAULT_TTL_MS): number {
  const id = ++_id;
  toasts.update((list) => [...list, { id, kind, message }]);
  if (ttlMs > 0 && typeof setTimeout !== 'undefined') {
    setTimeout(() => dismissToast(id), ttlMs);
  }
  return id;
}

export function dismissToast(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export const toastError = (message: string, ttlMs = 8000) => pushToast('error', message, ttlMs);
export const toastSuccess = (message: string, ttlMs?: number) => pushToast('success', message, ttlMs);
export const toastInfo = (message: string, ttlMs?: number) => pushToast('info', message, ttlMs);
