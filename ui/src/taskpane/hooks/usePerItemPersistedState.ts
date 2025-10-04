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
import {
  createEmptyTaskPaneSnapshot,
  type TaskPaneSnapshot,
} from "../storage/taskPaneSnapshot";
import { readSnapshotForItem, writeSnapshotForItem } from "../storage/taskPaneStorage";

const WRITE_DEBOUNCE_MS = 300;

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
      setSnapshot(createEmptyTaskPaneSnapshot());
      setIsHydrated(true);
      return undefined;
    }

    let isCancelled = false;
    setIsHydrated(false);
    lastHydratedItemKeyRef.current = null;

    (async () => {
      // Retrieve the serialized snapshot for the current Outlook item. Older
      // payloads are gracefully ignored by the sanitizer so schema bumps are safe.
      const storedSnapshot = await readSnapshotForItem(itemKey);

      if (isCancelled) {
        return;
      }

      lastHydratedItemKeyRef.current = itemKey;
      setSnapshot(storedSnapshot ?? createEmptyTaskPaneSnapshot());
      setIsHydrated(true);
    })();

    return () => {
      isCancelled = true;
    };
  }, [itemKey]);

  useEffect(() => {
    if (!itemKey || !isHydrated || lastHydratedItemKeyRef.current !== itemKey) {
      return undefined;
    }

    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }

    // Debounce writes so free-form prompt typing does not thrash OfficeRuntime.storage.
    writeTimeoutRef.current = setTimeout(() => {
      writeTimeoutRef.current = null;
      void writeSnapshotForItem(itemKey, latestSnapshotRef.current);
    }, WRITE_DEBOUNCE_MS);

    return () => {
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
        writeTimeoutRef.current = null;
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
        void writeSnapshotForItem(itemKey, latestSnapshotRef.current);
      }
    };
  }, [itemKey]);

  return { snapshot, setSnapshot, isHydrated };
};
