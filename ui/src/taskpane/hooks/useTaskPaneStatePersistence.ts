import * as React from "react";
import {
  createEmptyState,
  PersistedStateUpdate,
  PersistedTaskPaneState,
  savePersistedState,
  updatePersistedState,
  normalizeResponseState,
} from "../helpers/outlook-persistence";

export interface TaskPaneStatePersistence {
  state: PersistedTaskPaneState;
  setState: React.Dispatch<React.SetStateAction<PersistedTaskPaneState>>;
  currentItemKeyRef: React.MutableRefObject<string | null>;
  isMountedRef: React.MutableRefObject<boolean>;
  visibilityCleanupRef: React.MutableRefObject<(() => Promise<void>) | null>;
  latestStateRef: React.MutableRefObject<PersistedTaskPaneState>;
  operationSubscriptionsRef: React.MutableRefObject<Map<string, () => void>>;
  mergeState: (update: PersistedStateUpdate) => void;
  applyStateForKey: (
    itemKey: string | null,
    update: PersistedStateUpdate
  ) => Promise<void>;
  detachOperationSubscription: (requestId: string) => void;
}

export const useTaskPaneStatePersistence = (): TaskPaneStatePersistence => {
  const [state, setState] = React.useState<PersistedTaskPaneState>(() => createEmptyState());
  const currentItemKeyRef = React.useRef<string | null>(null);
  const isMountedRef = React.useRef<boolean>(false);
  const visibilityCleanupRef = React.useRef<(() => Promise<void>) | null>(null);
  const latestStateRef = React.useRef<PersistedTaskPaneState>(state);
  const operationSubscriptionsRef = React.useRef<Map<string, () => void>>(new Map());

  React.useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const detachOperationSubscription = React.useCallback((requestId: string) => {
    const subscription = operationSubscriptionsRef.current.get(requestId);

    if (!subscription) {
      return;
    }

    try {
      subscription();
    } catch (error) {
      console.warn(`[Taskpane] Failed to detach send operation ${requestId}.`, error);
    }

    operationSubscriptionsRef.current.delete(requestId);
  }, []);

  const applyStateUpdate = React.useCallback(
    (updater: (previous: PersistedTaskPaneState) => PersistedTaskPaneState) => {
      const targetKey = currentItemKeyRef.current;

      setState((previous) => {
        const next = updater(previous);

        if (targetKey) {
          console.debug(`[Taskpane] Persisting state for key ${targetKey}.`);
          savePersistedState(targetKey, next).catch((error) => {
            console.warn(`[Taskpane] Failed to persist state for key ${targetKey}.`, error);
          });
        } else {
          console.debug("[Taskpane] Skipping persistence because there is no active item key.");
        }

        return next;
      });
    },
    []
  );

  const mergeState = React.useCallback(
    (update: PersistedStateUpdate) => {
      applyStateUpdate((previous) => {
        const nextState =
          typeof update === "function"
            ? update(previous)
            : {
                ...previous,
                ...update,
              };

        const normalized = normalizeResponseState({
          ...nextState,
          pipelineResponse: nextState.pipelineResponse ?? null,
          isSending: nextState.isSending ?? false,
          activeRequestId: nextState.activeRequestId ?? null,
          activeRequestPrompt: nextState.activeRequestPrompt ?? null,
        });

        return {
          ...normalized,
          lastUpdatedUtc: new Date().toISOString(),
        };
      });
    },
    [applyStateUpdate]
  );

  const applyStateForKey = React.useCallback(
    async (itemKey: string | null, update: PersistedStateUpdate) => {
      if (!itemKey) {
        console.debug("[Taskpane] Skipping background persistence because the item key was null.");
        return;
      }

      if (isMountedRef.current && currentItemKeyRef.current === itemKey) {
        mergeState(update);
        return;
      }

      try {
        await updatePersistedState(itemKey, update);
        console.info(`[Taskpane] Persisted background state update for key ${itemKey}.`);
      } catch (error) {
        console.warn(
          `[Taskpane] Failed to apply background state update for key ${itemKey}.`,
          error
        );
      }
    },
    [mergeState]
  );

  return {
    state,
    setState,
    currentItemKeyRef,
    isMountedRef,
    visibilityCleanupRef,
    latestStateRef,
    operationSubscriptionsRef,
    mergeState,
    applyStateForKey,
    detachOperationSubscription,
  };
};
