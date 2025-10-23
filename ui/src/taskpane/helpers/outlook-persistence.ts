/* global OfficeRuntime, console, globalThis */

import type { PipelineResponse } from "../taskpane";

export interface PersistedTaskPaneState {
  optionalPrompt: string;
  statusMessage: string;
  pipelineResponse: PipelineResponse | null;
  isOptionalPromptVisible: boolean;
  isSending: boolean;
  /**
   * Tracks the identifier of the in-flight request, if any, so the UI can resume
   * waiting when the task pane is reopened on another item.
   */
  activeRequestId?: string | null;
  /**
   * Stores the sanitized optional prompt that accompanied the pending request so
   * retries or resumed operations reuse the exact same payload.
   */
  activeRequestPrompt?: string | null;
  lastUpdatedUtc?: string;
}

const STORAGE_NAMESPACE = "contoso-taskpane";

type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const createStorageAdapter = (): StorageAdapter => {
  const runtimeStorage = typeof OfficeRuntime !== "undefined" ? OfficeRuntime.storage : undefined;
  const globalScope = typeof globalThis !== "undefined" ? (globalThis as any) : undefined;

  if (runtimeStorage) {
    return {
      getItem: (key: string) => runtimeStorage.getItem(key),
      setItem: (key: string, value: string) => runtimeStorage.setItem(key, value),
      removeItem: (key: string) => runtimeStorage.removeItem(key),
    };
  }

  if (globalScope?.localStorage) {
    return {
      getItem: async (key: string) => globalScope.localStorage.getItem(key),
      setItem: async (key: string, value: string) => {
        globalScope.localStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        globalScope.localStorage.removeItem(key);
      },
    };
  }

  const inMemory = new Map<string, string>();
  return {
    getItem: async (key: string) => inMemory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      inMemory.set(key, value);
    },
    removeItem: async (key: string) => {
      inMemory.delete(key);
    },
  };
};

const storage = createStorageAdapter();

const createDefaultState = (): PersistedTaskPaneState => ({
  optionalPrompt: "",
  statusMessage: "",
  pipelineResponse: null,
  isOptionalPromptVisible: false,
  isSending: false,
  activeRequestId: null,
  activeRequestPrompt: null,
});

const buildStorageKey = (itemKey: string): string => `${STORAGE_NAMESPACE}:${itemKey}`;

export const loadPersistedState = async (itemKey: string): Promise<PersistedTaskPaneState> => {
  const storageKey = buildStorageKey(itemKey);
  const storedValue = await storage.getItem(storageKey);

  if (!storedValue) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<PersistedTaskPaneState>;
    return {
      ...createDefaultState(),
      ...parsed,
      pipelineResponse: parsed.pipelineResponse ?? null,
      isSending: parsed.isSending ?? false,
      activeRequestId: parsed.activeRequestId ?? null,
      activeRequestPrompt: parsed.activeRequestPrompt ?? null,
    };
  } catch (error) {
    console.warn(`[Taskpane] Failed to parse persisted state for key ${itemKey}.`, error);
    return createDefaultState();
  }
};

export const savePersistedState = async (
  itemKey: string,
  state: PersistedTaskPaneState
): Promise<void> => {
  const storageKey = buildStorageKey(itemKey);
  const payload = JSON.stringify(state);
  await storage.setItem(storageKey, payload);
};

export const clearPersistedState = async (itemKey: string): Promise<void> => {
  const storageKey = buildStorageKey(itemKey);
  await storage.removeItem(storageKey);
};

export type PersistedStateUpdate =
  | Partial<PersistedTaskPaneState>
  | ((previous: PersistedTaskPaneState) => PersistedTaskPaneState);

const mergeWithDefaults = (
  previous: PersistedTaskPaneState,
  partial: Partial<PersistedTaskPaneState>
): PersistedTaskPaneState => {
  const draft: PersistedTaskPaneState = {
    ...previous,
    ...partial,
  };

  return {
    ...draft,
    pipelineResponse:
      partial.pipelineResponse !== undefined
        ? partial.pipelineResponse
        : (draft.pipelineResponse ?? null),
    isSending: partial.isSending !== undefined ? partial.isSending : (draft.isSending ?? false),
    activeRequestId:
      partial.activeRequestId !== undefined
        ? partial.activeRequestId
        : (draft.activeRequestId ?? null),
    activeRequestPrompt:
      partial.activeRequestPrompt !== undefined
        ? partial.activeRequestPrompt
        : (draft.activeRequestPrompt ?? null),
  };
};

const normalizeUpdatedState = (candidate: PersistedTaskPaneState): PersistedTaskPaneState => ({
  ...candidate,
  pipelineResponse: candidate.pipelineResponse ?? null,
  isSending: candidate.isSending ?? false,
  activeRequestId: candidate.activeRequestId ?? null,
  activeRequestPrompt: candidate.activeRequestPrompt ?? null,
  lastUpdatedUtc: new Date().toISOString(),
});

export const updatePersistedState = async (
  itemKey: string,
  update: PersistedStateUpdate
): Promise<PersistedTaskPaneState> => {
  const currentState = await loadPersistedState(itemKey);

  const nextState = normalizeUpdatedState(
    typeof update === "function" ? update(currentState) : mergeWithDefaults(currentState, update)
  );

  await savePersistedState(itemKey, nextState);

  return nextState;
};

export const createEmptyState = createDefaultState;
