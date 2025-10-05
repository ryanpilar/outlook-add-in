/* global console, setTimeout, clearTimeout, globalThis */

import type { PipelineResponse } from "../taskpane";

/**
 * Tracks long-running send operations across task pane lifecycles.
 *
 * When a user navigates away from the message or closes the pane we can lose the
 * React component tree, but the shared runtime remains loaded. By keeping the
 * operation registry on the global scope we can reconnect to requests after the
 * UI remounts and continue processing completions.
 */

type OperationStatus = "pending" | "succeeded" | "failed";

type OperationSubscriber = {
  onSuccess?: (response: PipelineResponse) => void;
  onError?: (error: unknown) => void;
};

interface OperationRecord {
  requestId: string;
  executor: () => Promise<PipelineResponse>;
  status: OperationStatus;
  promise: Promise<PipelineResponse>;
  result?: PipelineResponse;
  error?: unknown;
  subscribers: Set<OperationSubscriber>;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

interface RetryScheduleResult {
  scheduled: boolean;
  attempt: number;
  delayMs: number;
}

const GLOBAL_REGISTRY_KEY = "__contoso_pendingSendOperations__";
const GLOBAL_BACKGROUND_KEY = "__contoso_sendOperationBackgroundHost__";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 10000;

const getRegistry = (): Map<string, OperationRecord> => {
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_REGISTRY_KEY]?: Map<string, OperationRecord>;
  };

  if (!globalScope[GLOBAL_REGISTRY_KEY]) {
    globalScope[GLOBAL_REGISTRY_KEY] = new Map<string, OperationRecord>();
  }

  return globalScope[GLOBAL_REGISTRY_KEY] as Map<string, OperationRecord>;
};

const notifySuccess = (record: OperationRecord, response: PipelineResponse) => {
  for (const subscriber of Array.from(record.subscribers)) {
    try {
      subscriber.onSuccess?.(response);
    } catch (error) {
      // Subscriber errors should never break the registry pipeline; just log them.
      console.warn("[Taskpane] Send operation success subscriber threw.", error);
    }
  }
};

const notifyError = (record: OperationRecord, error: unknown) => {
  for (const subscriber of Array.from(record.subscribers)) {
    try {
      subscriber.onError?.(error);
    } catch (handlerError) {
      console.warn("[Taskpane] Send operation error subscriber threw.", handlerError);
    }
  }
};

const clearRetryTimer = (record: OperationRecord) => {
  if (record.retryTimer) {
    clearTimeout(record.retryTimer);
    record.retryTimer = null;
  }
};

const runOperation = (record: OperationRecord) => {
  clearRetryTimer(record);
  record.status = "pending";
  record.error = undefined;
  record.result = undefined;

  record.promise = record
    .executor()
    .then((response) => {
      record.status = "succeeded";
      record.result = response;
      record.retryCount = 0;
      notifySuccess(record, response);
      return response;
    })
    .catch((error) => {
      record.status = "failed";
      record.error = error;
      notifyError(record, error);
      return Promise.reject(error);
    })
    .finally(() => {
      clearRetryTimer(record);

      // Once all listeners have detached we can discard completed records so the
      // registry cannot grow indefinitely. Pending operations stay registered so
      // future subscribers can attach.
      if (record.status !== "pending" && record.subscribers.size === 0) {
        getRegistry().delete(record.requestId);
      }
    });
};

const createOperationRecord = (
  requestId: string,
  executor: () => Promise<PipelineResponse>
): OperationRecord => {
  const record: OperationRecord = {
    requestId,
    executor,
    status: "pending",
    promise: Promise.resolve(null as unknown as PipelineResponse),
    subscribers: new Set(),
    retryCount: 0,
    retryTimer: null,
  };

  runOperation(record);

  getRegistry().set(requestId, record);
  return record;
};

const ensureOperationRecord = (
  requestId: string,
  executor: () => Promise<PipelineResponse>
): OperationRecord => {
  const registry = getRegistry();
  const existing = registry.get(requestId);

  if (existing) {
    // Always keep the latest executor so resumed operations send the freshest
    // payload (prompt, metadata, etc.).
    existing.executor = executor;
    return existing;
  }

  return createOperationRecord(requestId, executor);
};

export const attachToSendOperation = (
  requestId: string,
  executor: () => Promise<PipelineResponse>,
  subscriber: OperationSubscriber
) => {
  const record = ensureOperationRecord(requestId, executor);
  record.subscribers.add(subscriber);

  // If the operation already completed before this subscriber attached we invoke
  // the handler immediately so the UI can hydrate without waiting for a rerun.
  if (record.status === "succeeded" && record.result) {
    subscriber.onSuccess?.(record.result);
  } else if (record.status === "failed" && record.error !== undefined) {
    subscriber.onError?.(record.error);
  }

  const detach = () => {
    record.subscribers.delete(subscriber);
    if (record.subscribers.size === 0 && record.status !== "pending") {
      getRegistry().delete(requestId);
    }
  };

  return { detach, status: record.status, record };
};

export const scheduleSendOperationRetry = (requestId: string): RetryScheduleResult => {
  const registry = getRegistry();
  const record = registry.get(requestId);

  if (!record || record.status !== "failed") {
    return { scheduled: false, attempt: record?.retryCount ?? 0, delayMs: 0 };
  }

  if (record.retryCount >= MAX_RETRIES) {
    return { scheduled: false, attempt: record.retryCount, delayMs: 0 };
  }

  clearRetryTimer(record);

  const attempt = record.retryCount + 1;
  const delayMs = Math.min(BASE_RETRY_DELAY_MS * attempt, MAX_RETRY_DELAY_MS);

  record.retryCount = attempt;
  record.retryTimer = setTimeout(() => {
    record.retryTimer = null;
    runOperation(record);
  }, delayMs);

  return { scheduled: true, attempt, delayMs };
};

export const clearSendOperation = (requestId: string): void => {
  const registry = getRegistry();
  const record = registry.get(requestId);

  if (!record) {
    return;
  }

  clearRetryTimer(record);
  registry.delete(requestId);
};

export const MAX_SEND_OPERATION_RETRIES = MAX_RETRIES;

export type { OperationRecord, OperationStatus };

export const initializeSendOperationBackgroundHost = (): void => {
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_BACKGROUND_KEY]?: boolean;
  };

  if (globalScope[GLOBAL_BACKGROUND_KEY]) {
    return;
  }

  globalScope[GLOBAL_BACKGROUND_KEY] = true;
  getRegistry();

  console.log("[Taskpane] Send operation background host activated.");
};
