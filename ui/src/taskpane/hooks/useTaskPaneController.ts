/* global Office, console */

import * as React from "react";
import {
  createEmptyState,
  loadPersistedState,
  PersistedTaskPaneState,
  savePersistedState,
  updatePersistedState,
} from "../helpers/persistence";
import { resolveStorageKeyForCurrentItem } from "../helpers/mailboxItem";
import { registerTaskpaneVisibilityHandler } from "../helpers/runtime";
import { sendText } from "../taskpane";

export interface TaskPaneActions {
  refreshFromCurrentItem: () => Promise<void>;
  updateOptionalPrompt: (value: string) => void;
  setOptionalPromptVisible: (visible: boolean) => void;
  sendCurrentEmail: () => Promise<void>;
}

export interface TaskPaneController {
  state: PersistedTaskPaneState;
  actions: TaskPaneActions;
}

const usePersistedState = () => {
  const [state, setState] = React.useState<PersistedTaskPaneState>(() => createEmptyState());
  const currentItemKeyRef = React.useRef<string | null>(null);
  const isMountedRef = React.useRef<boolean>(false);
  const visibilityCleanupRef = React.useRef<(() => Promise<void>) | null>(null);
  const latestStateRef = React.useRef<PersistedTaskPaneState>(state);

  React.useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

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
    (partial: Partial<PersistedTaskPaneState>) => {
      applyStateUpdate((previous) => ({
        ...previous,
        ...partial,
        lastUpdatedUtc: new Date().toISOString(),
      }));
    },
    [applyStateUpdate]
  );

  const applyStateForKey = React.useCallback(
    async (itemKey: string | null, partial: Partial<PersistedTaskPaneState>) => {
      if (!itemKey) {
        console.debug("[Taskpane] Skipping background persistence because the item key was null.");
        return;
      }

      if (isMountedRef.current && currentItemKeyRef.current === itemKey) {
        mergeState(partial);
        return;
      }

      try {
        await updatePersistedState(itemKey, partial);
        console.info(`[Taskpane] Persisted background state update for key ${itemKey}.`);

        if (isMountedRef.current && currentItemKeyRef.current === itemKey) {
          console.debug(
            `[Taskpane] Item key ${itemKey} became active after background persistence. Synchronizing in-memory state.`
          );
          mergeState(partial);
        }
      } catch (error) {
        console.warn(
          `[Taskpane] Failed to apply background state update for key ${itemKey}.`,
          error
        );
      }
    },
    [mergeState]
  );

  const refreshFromCurrentItem = React.useCallback(async () => {
    console.info("[Taskpane] Refreshing task pane state for the current mailbox item.");
    const { key } = await resolveStorageKeyForCurrentItem();

    if (!isMountedRef.current) {
      console.debug("[Taskpane] Component is not mounted. Aborting refresh.");
      return;
    }

    if (key === null) {
      console.info("[Taskpane] No mailbox item detected. Resetting state to defaults.");
      currentItemKeyRef.current = null;
      setState(createEmptyState());
      return;
    }

    const hasChanged = currentItemKeyRef.current !== key;
    currentItemKeyRef.current = key;

    if (hasChanged) {
      console.info(`[Taskpane] Mailbox item changed. Loading persisted state for key ${key}.`);
      setState(createEmptyState());
    } else {
      console.debug(`[Taskpane] Mailbox item key ${key} unchanged. Using existing state.`);
    }

    try {
      const storedState = await loadPersistedState(key);

      if (!isMountedRef.current || currentItemKeyRef.current !== key) {
        console.debug("[Taskpane] Component unmounted or item changed before state load finished.");
        return;
      }

      console.info(`[Taskpane] Persisted state loaded for key ${key}.`);
      setState(storedState);
    } catch (error) {
      console.warn(`[Taskpane] Failed to load persisted state for key ${key}.`, error);

      if (isMountedRef.current && currentItemKeyRef.current === key) {
        console.info("[Taskpane] Falling back to empty state after load failure.");
        setState(createEmptyState());
      }
    }
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    console.info("[Taskpane] Task pane mounted. Initializing lifecycle handlers.");

    const initialize = async () => {
      await refreshFromCurrentItem();
      visibilityCleanupRef.current =
        await registerTaskpaneVisibilityHandler(refreshFromCurrentItem);
    };

    void initialize();

    const mailbox = Office.context.mailbox;
    const itemChangedHandler = () => {
      console.info("[Taskpane] Office item changed event received. Triggering refresh.");
      void refreshFromCurrentItem();
    };

    if (mailbox?.addHandlerAsync) {
      mailbox.addHandlerAsync(Office.EventType.ItemChanged, itemChangedHandler, (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          console.warn("[Taskpane] Failed to register ItemChanged handler.", result.error);
        } else {
          console.info("[Taskpane] ItemChanged handler registered.");
        }
      });
    }

    return () => {
      isMountedRef.current = false;
      console.info("[Taskpane] Task pane unmounted. Cleaning up handlers.");

      if (visibilityCleanupRef.current) {
        void visibilityCleanupRef.current();
        visibilityCleanupRef.current = null;
      }

      if (mailbox?.removeHandlerAsync) {
        mailbox.removeHandlerAsync(
          Office.EventType.ItemChanged,
          (result) => {
            if (result.status !== Office.AsyncResultStatus.Succeeded) {
              console.warn("[Taskpane] Failed to remove ItemChanged handler.", result.error);
            } else {
              console.info("[Taskpane] ItemChanged handler removed.");
            }
          }
        );
      }
    };
  }, [refreshFromCurrentItem]);

  const updateOptionalPrompt = React.useCallback(
    (value: string) => {
      console.debug("[Taskpane] Updating optional prompt.");
      mergeState({ optionalPrompt: value });
    },
    [mergeState]
  );

  const setOptionalPromptVisible = React.useCallback(
    (visible: boolean) => {
      console.debug(`[Taskpane] Setting optional prompt visibility to ${visible}.`);
      mergeState({ isOptionalPromptVisible: visible });
    },
    [mergeState]
  );

  const sendCurrentEmail = React.useCallback(async () => {
    console.info("[Taskpane] Initiating send workflow for current email content.");
    const targetKey = currentItemKeyRef.current;

    if (latestStateRef.current.isSending) {
      console.info("[Taskpane] Send request ignored because another send is already in progress.");
      return;
    }

    mergeState({
      statusMessage: "Sending the current email content...",
      pipelineResponse: null,
      isSending: true,
    });

    try {
      const prompt = latestStateRef.current.optionalPrompt.trim();
      const response = await sendText(prompt ? prompt : undefined);

      console.info("[Taskpane] Email content successfully sent to the logging service.");
      await applyStateForKey(targetKey, {
        statusMessage: "Email content sent to the server.",
        pipelineResponse: response,
        isSending: false,
      });
    } catch (error) {
      console.error("[Taskpane] Failed to send email content.", error);
      await applyStateForKey(targetKey, {
        statusMessage: "We couldn't send the email content. Please try again.",
        isSending: false,
      });
    }
  }, [applyStateForKey, mergeState]);

  const actions: TaskPaneActions = React.useMemo(
    () => ({
      refreshFromCurrentItem,
      updateOptionalPrompt,
      setOptionalPromptVisible,
      sendCurrentEmail,
    }),
    [refreshFromCurrentItem, sendCurrentEmail, setOptionalPromptVisible, updateOptionalPrompt]
  );

  return { state, actions };
};

export const useTaskPaneController = (): TaskPaneController => {
  return usePersistedState();
};
