import * as React from "react";

import { sendText } from "../taskpane";
import {
  attachToSendOperation,
  clearSendOperation,
  scheduleSendOperationRetry,
} from "../helpers/outlook-runtimeLogic";
import { PersistedTaskPaneState } from "../helpers/outlook-persistence";
import {
  describeError,
  formatRetryStatusMessage,
  isAbortError,
  isRetryableNetworkError,
} from "../helpers/outlook-errorHandling";
import { TaskPaneStatePersistence } from "./useTaskPaneStatePersistence";

export interface SendLifecycleHandlerOptions {
  applyStateForKey: TaskPaneStatePersistence["applyStateForKey"];
  detachOperationSubscription: TaskPaneStatePersistence["detachOperationSubscription"];
  operationSubscriptionsRef: TaskPaneStatePersistence["operationSubscriptionsRef"];
}

export const useSendLifecycleHandler = ({
  applyStateForKey,
  detachOperationSubscription,
  operationSubscriptionsRef,
}: SendLifecycleHandlerOptions) => {
  const handleSendSuccess = React.useCallback(
    async (
      itemKey: string,
      requestId: string,
      response: Awaited<ReturnType<typeof sendText>>
    ) => {
      console.info(`[Taskpane] Send operation ${requestId} completed successfully.`);

      await applyStateForKey(itemKey, (currentState) => {
        if (currentState.activeRequestId && currentState.activeRequestId !== requestId) {
          return currentState;
        }

        const previousHistory = currentState.responseHistory ?? [];
        const updatedHistory = [...previousHistory, response];
        const nextIndex = updatedHistory.length - 1;

        return {
          ...currentState,
          statusMessage: "Email content sent to the server.",
          pipelineResponse: response,
          responseHistory: updatedHistory,
          activeResponseIndex: nextIndex,
          isSending: false,
          activeRequestId: null,
          activeRequestPrompt: null,
        };
      });

      detachOperationSubscription(requestId);
      clearSendOperation(requestId);
    },
    [applyStateForKey, clearSendOperation, detachOperationSubscription]
  );

  const handleSendFailure = React.useCallback(
    async (itemKey: string, requestId: string, error: unknown) => {
      const errorMessage = describeError(error);

      if (isAbortError(error)) {
        console.info(`[Taskpane] Send operation ${requestId} was cancelled.`);

        await applyStateForKey(itemKey, (currentState) => {
          if (currentState.activeRequestId && currentState.activeRequestId !== requestId) {
            return currentState;
          }

          return {
            ...currentState,
            statusMessage: "Send operation cancelled.",
            isSending: false,
            activeRequestId: null,
            activeRequestPrompt: null,
          };
        });

        detachOperationSubscription(requestId);
        clearSendOperation(requestId);
        return;
      }

      if (isRetryableNetworkError(error)) {
        const retryPlan = scheduleSendOperationRetry(requestId);

        if (retryPlan.scheduled) {
          console.warn(
            `[Taskpane] Send operation ${requestId} will retry in ${retryPlan.delayMs}ms (attempt ${retryPlan.attempt}).`,
            error
          );

          await applyStateForKey(itemKey, (currentState) => {
            if (currentState.activeRequestId && currentState.activeRequestId !== requestId) {
              return currentState;
            }

            return {
              ...currentState,
              statusMessage: formatRetryStatusMessage(retryPlan.attempt, retryPlan.delayMs),
              isSending: true,
            };
          });

          return;
        }
      }

      console.error(`[Taskpane] Send operation ${requestId} failed.`, error);

      const truncatedError = errorMessage ? errorMessage.slice(0, 200) : "";
      const failureMessage = truncatedError
        ? `We couldn't send the email content. Reason: ${truncatedError}`
        : "We couldn't send the email content. Please try again.";

      await applyStateForKey(itemKey, (currentState) => {
        if (currentState.activeRequestId && currentState.activeRequestId !== requestId) {
          return currentState;
        }

        return {
          ...currentState,
          statusMessage: failureMessage,
          isSending: false,
          activeRequestId: null,
          activeRequestPrompt: null,
        };
      });

      detachOperationSubscription(requestId);
      clearSendOperation(requestId);
    },
    [applyStateForKey, clearSendOperation, detachOperationSubscription, scheduleSendOperationRetry]
  );

  const ensureSendLifecycle = React.useCallback(
    (itemKey: string, requestId: string, prompt: string | null) => {
      if (!requestId) {
        return;
      }

      const sanitizedPrompt = prompt?.trim() ?? "";

      // Replace any previous subscription to avoid duplicate handlers when the
      // user rapidly toggles between emails or reopens the task pane.
      detachOperationSubscription(requestId);

      const subscription = attachToSendOperation(
        requestId,
        (signal) =>
          sendText(sanitizedPrompt ? sanitizedPrompt : undefined, {
            signal,
          }),
        {
          onSuccess: (response) => {
            void handleSendSuccess(itemKey, requestId, response);
          },
          onError: (error) => {
            void handleSendFailure(itemKey, requestId, error);
          },
        }
      );

      operationSubscriptionsRef.current.set(requestId, subscription.detach);
    },
    [attachToSendOperation, detachOperationSubscription, handleSendFailure, handleSendSuccess]
  );

  const resumePendingOperationIfNeeded = React.useCallback(
    (itemKey: string, persistedState: PersistedTaskPaneState) => {
      if (!persistedState.isSending || !persistedState.activeRequestId) {
        return;
      }

      console.info(
        `[Taskpane] Reconnecting to in-flight request ${persistedState.activeRequestId} for mailbox item ${itemKey}.`
      );

      ensureSendLifecycle(
        itemKey,
        persistedState.activeRequestId,
        persistedState.activeRequestPrompt ?? null
      );
    },
    [ensureSendLifecycle]
  );

  return {
    handleSendSuccess,
    handleSendFailure,
    ensureSendLifecycle,
    resumePendingOperationIfNeeded,
  };
};
