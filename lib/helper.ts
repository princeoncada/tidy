import { useRef } from "react";

export function useMutationQueue() {
  // Stores the current promise chain
  const queueRef = useRef(Promise.resolve());

  // Tracks how many queued tasks are still running/waiting
  const pendingCountRef = useRef(0);

  function enqueue(task: () => Promise<void>, onQueueEmpty?: () => void) {
    // A new task entered the queue
    pendingCountRef.current += 1

    queueRef.current = queueRef.current
      .then(async () => {
        // Runs only after the previous queued task finished
        await task();
      })
      .catch((error) => {
        // Prevents one failed task from breaking the whole queue
        console.error("Queue mutation failed:", error)
      })
      .finally(() => {
        // This task is now finished
        pendingCountRef.current -= 1;

        // Only run when all queued tasks are done
        if (pendingCountRef.current === 0) {
          onQueueEmpty?.();
        }
      })

    return queueRef.current;
  }

  return { enqueue }
}