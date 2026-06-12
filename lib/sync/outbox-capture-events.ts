export type OutboxCaptureEvent = {
  userId: string;
};

type OutboxCaptureListener = (event: OutboxCaptureEvent) => void;

const listeners = new Set<OutboxCaptureListener>();

export function subscribeToOutboxCaptures(
  listener: OutboxCaptureListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyOutboxCaptured(event: OutboxCaptureEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      console.error("Outbox capture listener failed", error);
    }
  }
}
