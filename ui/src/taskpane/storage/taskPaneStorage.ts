/* global OfficeRuntime */
/**
 * Task Pane Storage Helpers
 * ---------------------------------------------------------------------------
 * OfficeRuntime.storage is the roaming surface that survives task pane reloads
 * across Outlook clients. These helpers keep the serialization logic in one
 * place so hooks can read/write snapshots without duplicating host checks or
 * key management.
 *
 * - Namespaces keys per mailbox item so each message restores the correct data.
 * - Tolerates missing OfficeRuntime.storage during development or older hosts.
 * - Drops empty snapshots to avoid spending the roaming quota on defaults.
 */
import {
  TASK_PANE_SNAPSHOT_VERSION,
  createEmptyTaskPaneSnapshot,
  sanitizePersistedSnapshot,
  snapshotEqualsEmpty,
  type TaskPaneSnapshot,
} from "./taskPaneSnapshot";

// Use a compact prefix so we stay within the host's key length limits even for
// large conversation IDs that Outlook sometimes emits for shared mailboxes.
const STORAGE_PREFIX = "taskpane:snapshot:";

let hasLoggedMissingRuntimeStorage = false;

// OfficeRuntime.storage is the only storage surface that roams with the mailbox
// across Outlook hosts. In dev environments (or older builds) it may not exist,
// so every access is gated and logs once for easier diagnostics.
const getRuntimeStorage = (): OfficeRuntime.Storage | null => {
  if (typeof OfficeRuntime === "undefined" || !OfficeRuntime.storage) {
    if (!hasLoggedMissingRuntimeStorage) {
      console.warn("OfficeRuntime.storage is not available in this environment.");
      hasLoggedMissingRuntimeStorage = true;
    }
    return null;
  }

  return OfficeRuntime.storage;
};

const buildStorageKey = (itemKey: string): string => `${STORAGE_PREFIX}${itemKey}`;

export const readSnapshotForItem = async (
  itemKey: string
): Promise<TaskPaneSnapshot | null> => {
  const storage = getRuntimeStorage();

  if (!storage) {
    return null;
  }

  try {
    const serializedValue = await storage.getItem(buildStorageKey(itemKey));

    if (!serializedValue) {
      return null;
    }

    // JSON.parse throws on malformed payloads (for example, if another build used
    // a different schema). Sanitization below constrains the shape we accept.
    const parsedValue = JSON.parse(serializedValue) as unknown;
    const sanitized = sanitizePersistedSnapshot(parsedValue);

    return sanitized ?? null;
  } catch (error) {
    console.error("Failed to read task pane snapshot from OfficeRuntime.storage", error);
    return null;
  }
};

export const writeSnapshotForItem = async (
  itemKey: string,
  snapshot: TaskPaneSnapshot
): Promise<void> => {
  const storage = getRuntimeStorage();

  if (!storage) {
    return;
  }

  try {
    if (snapshotEqualsEmpty(snapshot)) {
      await storage.removeItem(buildStorageKey(itemKey));
      return;
    }

    const payload = {
      version: TASK_PANE_SNAPSHOT_VERSION,
      snapshot,
    };

    await storage.setItem(buildStorageKey(itemKey), JSON.stringify(payload));
  } catch (error) {
    console.error("Failed to write task pane snapshot to OfficeRuntime.storage", error);
  }
};

export const clearSnapshotForItem = async (itemKey: string): Promise<void> => {
  const storage = getRuntimeStorage();

  if (!storage) {
    return;
  }

  try {
    await storage.removeItem(buildStorageKey(itemKey));
  } catch (error) {
    console.error("Failed to clear task pane snapshot from OfficeRuntime.storage", error);
  }
};

export const ensureSnapshotForItem = async (
  itemKey: string
): Promise<TaskPaneSnapshot> => {
  const existing = await readSnapshotForItem(itemKey);

  if (existing) {
    return existing;
  }

  const snapshot = createEmptyTaskPaneSnapshot();
  await writeSnapshotForItem(itemKey, snapshot);
  return snapshot;
};
