/* global console, Office, OfficeRuntime */
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

type StorageSurface = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let hasLoggedMissingStorage = false;
let lastLoggedSurface: "OfficeRuntime.storage" | "Office.context.roamingSettings" | "none" | null =
  null;

const describeItemKey = (itemKey: string): string => {
  if (itemKey.length <= 32) {
    return itemKey;
  }

  return `${itemKey.slice(0, 12)}…${itemKey.slice(-6)}`;
};

const createRoamingSettingsAdapter = (): StorageSurface | null => {
  const roamingSettings = Office?.context?.roamingSettings;

  if (!roamingSettings) {
    return null;
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const value = roamingSettings.get(key);

      if (typeof value === "string") {
        return value;
      }

      return value == null ? null : String(value);
    },
    setItem(key: string, value: string): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          roamingSettings.set(key, value);
          roamingSettings.saveAsync((asyncResult) => {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
              resolve();
            } else {
              reject(asyncResult.error);
            }
          });
        } catch (error) {
          reject(error as Error);
        }
      });
    },
    removeItem(key: string): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          roamingSettings.remove(key);
          roamingSettings.saveAsync((asyncResult) => {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
              resolve();
            } else {
              reject(asyncResult.error);
            }
          });
        } catch (error) {
          reject(error as Error);
        }
      });
    },
  };
};

// OfficeRuntime.storage is the preferred roaming surface because it survives
// task pane reloads across platforms. When it's unavailable (classic desktop
// hosts, older builds, or during development) we fall back to
// Office.context.roamingSettings so users still regain their per-item state when
// reopening the pane.
const detectStorageSurface = (): {
  surface: StorageSurface | null;
  kind: "OfficeRuntime.storage" | "Office.context.roamingSettings" | "none";
} => {
  try {
    if (typeof OfficeRuntime !== "undefined" && OfficeRuntime.storage) {
      return { surface: OfficeRuntime.storage, kind: "OfficeRuntime.storage" };
    }
  } catch (error) {
    console.error("[TaskPaneStorage] Failed to access OfficeRuntime.storage", error);
  }

  const roamingSettings = createRoamingSettingsAdapter();

  if (roamingSettings) {
    return { surface: roamingSettings, kind: "Office.context.roamingSettings" };
  }

  return { surface: null, kind: "none" };
};

const getStorageSurface = (): StorageSurface | null => {
  const { surface, kind } = detectStorageSurface();

  if (kind !== lastLoggedSurface) {
    if (kind === "none") {
      if (!hasLoggedMissingStorage) {
        console.warn(
          "[TaskPaneStorage] No supported roaming storage surface is available. Task pane state will not persist across reloads."
        );
        hasLoggedMissingStorage = true;
      }
    } else {
      console.info(`[TaskPaneStorage] Using ${kind} for persisted task pane state.`);
    }

    lastLoggedSurface = kind;
  }

  return surface;
};

const buildStorageKey = (itemKey: string): string => `${STORAGE_PREFIX}${itemKey}`;

export const readSnapshotForItem = async (itemKey: string): Promise<TaskPaneSnapshot | null> => {
  const storage = getStorageSurface();
  const itemDescription = describeItemKey(itemKey);

  if (!storage) {
    console.warn(
      `[TaskPaneStorage] Skipping snapshot hydration for ${itemDescription} because no storage surface is available.`
    );
    return null;
  }

  try {
    console.info(`[TaskPaneStorage] Loading snapshot for ${itemDescription} from roaming storage.`);
    const storageKey = buildStorageKey(itemKey);
    const serializedValue = await storage.getItem(storageKey);

    if (!serializedValue) {
      console.info(`[TaskPaneStorage] No persisted snapshot found for ${itemDescription}.`);
      return null;
    }

    console.info(
      `[TaskPaneStorage] Retrieved ${serializedValue.length} bytes for ${itemDescription}; attempting to deserialize.`
    );
    // JSON.parse throws on malformed payloads (for example, if another build used
    // a different schema). Sanitization below constrains the shape we accept.
    const parsedValue = JSON.parse(serializedValue) as unknown;
    const sanitized = sanitizePersistedSnapshot(parsedValue);

    if (!sanitized) {
      console.warn(
        `[TaskPaneStorage] Ignoring persisted snapshot for ${itemDescription} because it failed schema validation. Clearing the stored value.`
      );

      try {
        await storage.removeItem(storageKey);
      } catch (cleanupError) {
        console.error(
          `[TaskPaneStorage] Failed to remove invalid snapshot for ${itemDescription} during cleanup`,
          cleanupError
        );
      }

      return null;
    }

    console.info(`[TaskPaneStorage] Snapshot hydrated for ${itemDescription}.`, {
      optionalPromptLength: sanitized.optionalPrompt.length,
      hasPipelineResponse: sanitized.pipelineResponse !== null,
      statusLength: sanitized.statusMessage.length,
      isOptionalPromptVisible: sanitized.isOptionalPromptVisible,
    });

    return sanitized;
  } catch (error) {
    console.error(
      `[TaskPaneStorage] Failed to read task pane snapshot for ${itemDescription} from roaming storage`,
      error
    );
    return null;
  }
};

export const writeSnapshotForItem = async (
  itemKey: string,
  snapshot: TaskPaneSnapshot
): Promise<void> => {
  const storage = getStorageSurface();
  const itemDescription = describeItemKey(itemKey);

  if (!storage) {
    console.warn(
      `[TaskPaneStorage] Unable to persist snapshot for ${itemDescription} because no storage surface is available.`
    );
    return;
  }

  try {
    if (snapshotEqualsEmpty(snapshot)) {
      console.info(
        `[TaskPaneStorage] Snapshot for ${itemDescription} is empty. Removing it from roaming storage to conserve quota.`
      );
      await storage.removeItem(buildStorageKey(itemKey));
      console.info(`[TaskPaneStorage] Snapshot removed for ${itemDescription}.`);
      return;
    }

    const payload = {
      version: TASK_PANE_SNAPSHOT_VERSION,
      snapshot,
    };

    console.info(`[TaskPaneStorage] Persisting snapshot for ${itemDescription}.`, {
      optionalPromptLength: snapshot.optionalPrompt.length,
      hasPipelineResponse: snapshot.pipelineResponse !== null,
      statusLength: snapshot.statusMessage.length,
      isOptionalPromptVisible: snapshot.isOptionalPromptVisible,
    });
    await storage.setItem(buildStorageKey(itemKey), JSON.stringify(payload));
    console.info(`[TaskPaneStorage] Snapshot persisted for ${itemDescription}.`);
  } catch (error) {
    console.error(
      `[TaskPaneStorage] Failed to write task pane snapshot for ${itemDescription} to roaming storage`,
      error
    );
  }
};

export const clearSnapshotForItem = async (itemKey: string): Promise<void> => {
  const storage = getStorageSurface();
  const itemDescription = describeItemKey(itemKey);

  if (!storage) {
    console.warn(
      `[TaskPaneStorage] Skipping snapshot clear for ${itemDescription} because no storage surface is available.`
    );
    return;
  }

  try {
    console.info(
      `[TaskPaneStorage] Clearing snapshot for ${itemDescription} from roaming storage.`
    );
    await storage.removeItem(buildStorageKey(itemKey));
    console.info(`[TaskPaneStorage] Snapshot cleared for ${itemDescription}.`);
  } catch (error) {
    console.error(
      `[TaskPaneStorage] Failed to clear task pane snapshot for ${itemDescription} from roaming storage`,
      error
    );
  }
};

export const ensureSnapshotForItem = async (itemKey: string): Promise<TaskPaneSnapshot> => {
  console.info(`[TaskPaneStorage] Ensuring snapshot exists for ${describeItemKey(itemKey)}.`);
  const existing = await readSnapshotForItem(itemKey);

  if (existing) {
    return existing;
  }

  const snapshot = createEmptyTaskPaneSnapshot();
  await writeSnapshotForItem(itemKey, snapshot);
  return snapshot;
};
