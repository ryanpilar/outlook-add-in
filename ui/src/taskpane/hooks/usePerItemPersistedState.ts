/* global clearTimeout, console, setTimeout */
/**
 * Per-Item Task Pane Persistence Hook
 * ---------------------------------------------------------------------------
 * TextInsertion calls this hook to hydrate its UI from OfficeRuntime.storage
 * and to save updates while the user works through a message. The objective is
 * to make returning to a mail item feel instant instead of reissuing expensive
 * API calls.
 *
 * - Reloads the serialized snapshot whenever the mailbox key changes, falling
 *   back to an empty state when no data was cached.
 * - Debounces writes to OfficeRuntime.storage yet flushes immediately on
 *   cleanup so roaming storage keeps up with prompt edits.
 * - Tracks the last hydrated key to avoid persisting stale data during quick
 *   navigation between emails.
 */
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { createEmptyTaskPaneSnapshot, type TaskPaneSnapshot } from "../storage/taskPaneSnapshot";
import { readSnapshotForItem, writeSnapshotForItem } from "../storage/taskPaneStorage";

const WRITE_DEBOUNCE_MS = 300;

const summarizeSnapshot = (snapshot: TaskPaneSnapshot) => ({
  optionalPromptLength: snapshot.optionalPrompt.length,
  hasPipelineResponse: snapshot.pipelineResponse !== null,
  statusLength: snapshot.statusMessage.length,
  isOptionalPromptVisible: snapshot.isOptionalPromptVisible,
});

const describeItemKey = (itemKey: string | null): string => {
  if (!itemKey) {
    return "<none>";
  }

  if (itemKey.length <= 32) {
    return itemKey;
  }

  return `${itemKey.slice(0, 12)}…${itemKey.slice(-6)}`;
};

export interface UsePerItemPersistedStateResult {
  snapshot: TaskPaneSnapshot;
  setSnapshot: Dispatch<SetStateAction<TaskPaneSnapshot>>;
  isHydrated: boolean;
}

export const usePerItemPersistedState = (
  itemKey: string | null
): UsePerItemPersistedStateResult => {
  const [snapshot, setSnapshot] = useState<TaskPaneSnapshot>(() => createEmptyTaskPaneSnapshot());
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const lastHydratedItemKeyRef = useRef<string | null>(null);
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSnapshotRef = useRef<TaskPaneSnapshot>(snapshot);

  useEffect(() => {
    latestSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!itemKey) {
      // Without a concrete item we fall back to the in-memory defaults so the UI
      // remains interactive even if we cannot persist anything meaningful yet.
      lastHydratedItemKeyRef.current = null;
      console.info(
        "[TaskPaneState] No active mailbox item is available. Resetting snapshot to defaults and marking as hydrated."
      );
      setSnapshot(createEmptyTaskPaneSnapshot());
      setIsHydrated(true);
      return undefined;
    }

    let isCancelled = false;
    setIsHydrated(false);
    lastHydratedItemKeyRef.current = null;
    const itemDescription = describeItemKey(itemKey);

    console.info(`[TaskPaneState] Hydrating snapshot for ${itemDescription}.`);

    (async () => {
      // Retrieve the serialized snapshot for the current Outlook item. Older
      // payloads are gracefully ignored by the sanitizer so schema bumps are safe.
      const storedSnapshot = await readSnapshotForItem(itemKey);

      if (isCancelled) {
        console.info(
          `[TaskPaneState] Hydration for ${itemDescription} was cancelled before completion.`
        );
        return;
      }

      lastHydratedItemKeyRef.current = itemKey;
      setSnapshot(storedSnapshot ?? createEmptyTaskPaneSnapshot());
      setIsHydrated(true);

      if (storedSnapshot) {
        console.info(
          `[TaskPaneState] Snapshot restored for ${itemDescription}.`,
          summarizeSnapshot(storedSnapshot)
        );
      } else {
        console.info(
          `[TaskPaneState] No persisted snapshot for ${itemDescription}. Using defaults.`
        );
      }
    })();

    return () => {
      isCancelled = true;
      console.info(`[TaskPaneState] Cancelling hydration for ${itemDescription}.`);
    };
  }, [itemKey]);

  useEffect(() => {
    if (!itemKey || !isHydrated || lastHydratedItemKeyRef.current !== itemKey) {
      return undefined;
    }

    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
      console.info(
        `[TaskPaneState] Resetting pending persistence timer for ${describeItemKey(itemKey)} because the snapshot changed again.`
      );
    }

    // Debounce writes so free-form prompt typing does not thrash OfficeRuntime.storage.
    writeTimeoutRef.current = setTimeout(() => {
      writeTimeoutRef.current = null;
      console.info(
        `[TaskPaneState] Debounced persistence triggered for ${describeItemKey(itemKey)}.`,
        summarizeSnapshot(latestSnapshotRef.current)
      );
      void writeSnapshotForItem(itemKey, latestSnapshotRef.current);
    }, WRITE_DEBOUNCE_MS);

    console.info(
      `[TaskPaneState] Scheduled snapshot persistence for ${describeItemKey(itemKey)} in ${WRITE_DEBOUNCE_MS}ms.`,
      summarizeSnapshot(snapshot)
    );

    return () => {
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
        writeTimeoutRef.current = null;
        console.info(
          `[TaskPaneState] Flushing pending snapshot persistence for ${describeItemKey(itemKey)} during effect cleanup.`,
          summarizeSnapshot(latestSnapshotRef.current)
        );
        void writeSnapshotForItem(itemKey, latestSnapshotRef.current);
      }
    };
  }, [itemKey, isHydrated, snapshot]);

  // Ensure the pending snapshot is flushed one last time if the hook unmounts
  // while a timer is still pending (for example, when the task pane closes).
  useEffect(() => {
    return () => {
      if (writeTimeoutRef.current && itemKey && lastHydratedItemKeyRef.current === itemKey) {
        clearTimeout(writeTimeoutRef.current);
        writeTimeoutRef.current = null;
        console.info(
          `[TaskPaneState] Flushing pending snapshot persistence for ${describeItemKey(itemKey)} during unmount.`,
          summarizeSnapshot(latestSnapshotRef.current)
        );
        void writeSnapshotForItem(itemKey, latestSnapshotRef.current);
      }
    };
  }, [itemKey]);

  return { snapshot, setSnapshot, isHydrated };
};
