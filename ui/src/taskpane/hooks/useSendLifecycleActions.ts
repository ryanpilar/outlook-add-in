import * as React from "react";

import {createEmptyState} from "../helpers/outlook-persistence";
import {cancelSendOperation, clearSendOperation} from "../helpers/outlook-runtimeLogic";
import {TaskPaneStatePersistence} from "./useTaskPaneStatePersistence";

interface SendLifecycleActionsOptions {
    applyStateForKey: TaskPaneStatePersistence["applyStateForKey"];
    mergeState: TaskPaneStatePersistence["mergeState"];
    currentItemKeyRef: TaskPaneStatePersistence["currentItemKeyRef"];
    latestStateRef: TaskPaneStatePersistence["latestStateRef"];
    operationSubscriptionsRef: TaskPaneStatePersistence["operationSubscriptionsRef"];
    detachOperationSubscription: TaskPaneStatePersistence["detachOperationSubscription"];
    ensureSendLifecycle: (itemKey: string, requestId: string, prompt: string | null) => void;
}

interface SendLifecycleActions {
    sendCurrentEmail: () => Promise<void>;
    cancelCurrentSend: () => Promise<void>;
    resetTaskPaneState: () => Promise<void>;
}

export const useSendLifecycleActions = ({
    applyStateForKey,
    mergeState,
    currentItemKeyRef,
    latestStateRef,
    operationSubscriptionsRef,
    detachOperationSubscription,
    ensureSendLifecycle,
}: SendLifecycleActionsOptions): SendLifecycleActions => {

    const sendCurrentEmail = React.useCallback(async () => {
        console.info("[Taskpane] Initiating send workflow for current email content.");
        const targetKey = currentItemKeyRef.current;

        if (latestStateRef.current.isSending) {
            // When a request is already running we simply ignore additional presses so the
            // background workflow is not duplicated.
            console.info("[Taskpane] A send operation is already in progress. Ignoring duplicate request.");
            return;
        }

        if (!targetKey) {
            console.warn("[Taskpane] Unable to determine a storage key for the current item. Aborting send.");
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

    return {
        sendCurrentEmail,
        cancelCurrentSend,
        resetTaskPaneState,
    };
};
