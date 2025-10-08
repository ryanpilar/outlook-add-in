
import * as React from "react";
import {
  createEmptyState,
  loadPersistedState,
  PersistedTaskPaneState,
} from "../helpers/outlook-persistence";
import { resolveStorageKeyForCurrentItem } from "../helpers/outlook-mailboxItem";
import { cancelSendOperation, clearSendOperation } from "../helpers/outlook-runtimeLogic";
import { copyTextToClipboard } from "../helpers/clipboard";
import { insertResponseIntoBody } from "../helpers/emailBodyInsertion";
import { useTaskPaneStatePersistence } from "./useTaskPaneStatePersistence";
import { useSendLifecycleHandler } from "./useSendLifecycleHandler";
import { useMailboxLifecycleHandler } from "./useMailboxLifecycleHandler";
import { describeError } from "../utils/outlook-errorHandling";

export interface TaskPaneActions {
  refreshFromCurrentItem: () => Promise<void>;
  updateOptionalPrompt: (value: string) => void;
  setOptionalPromptVisible: (visible: boolean) => void;
  sendCurrentEmail: () => Promise<void>;
  cancelCurrentSend: () => Promise<void>;
  copyResponseToClipboard: (response: string) => Promise<void>;
  injectResponseIntoEmail: (response: string) => Promise<void>;
  resetTaskPaneState: () => Promise<void>;
}

export interface TaskPaneController {
  state: PersistedTaskPaneState;
  actions: TaskPaneActions;
}

export const useTaskPaneController = (): TaskPaneController => {
  const {
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
  } = useTaskPaneStatePersistence();

  const { handleSendSuccess, handleSendFailure, ensureSendLifecycle, resumePendingOperationIfNeeded } =
    useSendLifecycleHandler({
      applyStateForKey,
      detachOperationSubscription,
      operationSubscriptionsRef,
    });

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
      resumePendingOperationIfNeeded(key, storedState);
      setState(storedState);
    } catch (error) {
      console.warn(`[Taskpane] Failed to load persisted state for key ${key}.`, error);

      if (isMountedRef.current && currentItemKeyRef.current === key) {
        console.info("[Taskpane] Falling back to empty state after load failure.");
        setState(createEmptyState());
      }
    }
  }, [resumePendingOperationIfNeeded]);

  useMailboxLifecycleHandler({ refreshFromCurrentItem, isMountedRef, visibilityCleanupRef });

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

  const copyResponseToClipboard = React.useCallback(
    async (response: string) => {
      const sanitized = response.trim();

      if (!sanitized) {
        mergeState({ statusMessage: "There isn't an email response to copy yet." });
        return;
      }

      try {
        await copyTextToClipboard(sanitized);
        mergeState({ statusMessage: "Email response copied to the clipboard." });
      } catch (error) {
        console.error("[Taskpane] Failed to copy the email response.", error);
        const description = describeError(error);
        mergeState({
          statusMessage: description
            ? `We couldn't copy the email response automatically. Reason: ${description}`
            : "We couldn't copy the email response automatically. Please copy it manually.",
        });
      }
    },
    [mergeState]
  );

  const injectResponseIntoEmail = React.useCallback(
    async (response: string) => {
      const sanitized = response.trim();

      if (!sanitized) {
        mergeState({ statusMessage: "There isn't an email response to insert yet." });
        return;
      }

      try {
        await insertResponseIntoBody(sanitized);
        mergeState({ statusMessage: "Email response inserted into your draft." });
      } catch (error) {
        console.error(
          "[Taskpane] Failed to insert the email response into the compose body.",
          error
        );
        const description = describeError(error);
        mergeState({
          statusMessage: description
            ? `We couldn't insert the email response. Reason: ${description}`
            : "We couldn't insert the email response. Please paste it manually.",
        });
      }
    },
    [mergeState]
  );

  const sendCurrentEmail = React.useCallback(async () => {
    console.info("[Taskpane] Initiating send workflow for current email content.");
    const targetKey = currentItemKeyRef.current;

    if (latestStateRef.current.isSending) {
      // When a request is already running we simply ignore additional presses so the
      // background workflow is not duplicated.
      console.info(
        "[Taskpane] A send operation is already in progress. Ignoring duplicate request."
      );
      return;
    }

    if (!targetKey) {
      console.warn(
        "[Taskpane] Unable to determine a storage key for the current item. Aborting send."
      );
      return;
    }

    // Generate a lightweight identifier so we can correlate the response with the request
    // when it completes, even if the user navigates away from the original email.
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optionalPrompt = latestStateRef.current.optionalPrompt.trim();

    // Persist the "sending" flag against the originating item key so the UI can resume the
    // pending state after navigation. This runs through `applyStateForKey` so we reuse the same
    // code path regardless of whether the item is currently displayed or only updated in storage.
    await applyStateForKey(targetKey, (previous) => ({
      ...previous,
      statusMessage: "Sending the current email content...",
      pipelineResponse: null,
      isSending: true,
      activeRequestId: requestId,
      activeRequestPrompt: optionalPrompt || null,
    }));

    ensureSendLifecycle(targetKey, requestId, optionalPrompt || null);
  }, [applyStateForKey, ensureSendLifecycle]);

  const cancelCurrentSend = React.useCallback(async () => {
    const targetKey = currentItemKeyRef.current;
    const activeRequestId = latestStateRef.current.activeRequestId;

    if (!activeRequestId) {
      console.info("[Taskpane] No active send operation to cancel.");
      return;
    }

    console.info(`[Taskpane] Cancelling send operation ${activeRequestId}.`);
    const cancelled = cancelSendOperation(activeRequestId);

    if (!targetKey) {
      console.warn(
        "[Taskpane] Unable to determine a storage key while cancelling the current send."
      );
      return;
    }

    await applyStateForKey(targetKey, (previous) => {
      if (previous.activeRequestId && previous.activeRequestId !== activeRequestId) {
        return previous;
      }

      return {
        ...previous,
        statusMessage: cancelled
          ? "Stopping the send operation..."
          : "No send operation in progress.",
        isSending: false,
        activeRequestId: null,
        activeRequestPrompt: null,
      };
    });

    if (!cancelled) {
      detachOperationSubscription(activeRequestId);
      clearSendOperation(activeRequestId);
    }
  }, [applyStateForKey, cancelSendOperation, clearSendOperation, detachOperationSubscription]);

  const resetTaskPaneState = React.useCallback(async () => {
    console.info("[Taskpane] Resetting task pane state to defaults.");
    const activeRequestId = latestStateRef.current.activeRequestId;

    if (activeRequestId) {
      try {
        cancelSendOperation(activeRequestId);
      } catch (error) {
        console.warn(
          `[Taskpane] Failed to cancel send operation ${activeRequestId} while resetting the task pane.`,
          error
        );
      }
    }

    operationSubscriptionsRef.current.forEach((detach, requestId) => {
      try {
        detach();
      } catch (error) {
        console.warn(
          `[Taskpane] Failed to detach send operation ${requestId} while resetting the task pane.`,
          error
        );
      }

      clearSendOperation(requestId);
    });
    operationSubscriptionsRef.current.clear();

    mergeState(() => createEmptyState());
  }, [cancelSendOperation, clearSendOperation, mergeState]);

  const actions: TaskPaneActions = React.useMemo(
    () => ({
      refreshFromCurrentItem,
      updateOptionalPrompt,
      setOptionalPromptVisible,
      sendCurrentEmail,
      cancelCurrentSend,
      copyResponseToClipboard,
      injectResponseIntoEmail,
      resetTaskPaneState,
    }),
    [
      cancelCurrentSend,
      copyResponseToClipboard,
      resetTaskPaneState,
      injectResponseIntoEmail,
      refreshFromCurrentItem,
      sendCurrentEmail,
      setOptionalPromptVisible,
      updateOptionalPrompt,
    ]
  );

  return { state, actions };
};
