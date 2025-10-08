
import * as React from "react";
import {
    createEmptyState,
    loadPersistedState,
    PersistedTaskPaneState,
} from "../helpers/outlook-persistence";
import { resolveStorageKeyForCurrentItem } from "../helpers/outlook-mailboxItem";
import { registerTaskpaneVisibilityHandler } from "../helpers/outlook-runtime";
import {
    attachToSendOperation,
    cancelSendOperation,
    clearSendOperation,
    scheduleSendOperationRetry,
} from "../helpers/outlook-runtimeLogic";
import { sendText } from "../taskpane";
import { copyTextToClipboard } from "../helpers/clipboard";
import { insertResponseIntoBody } from "../helpers/emailBodyInsertion";
import { useTaskPaneStatePersistence } from "./useTaskPaneStatePersistence";
import {
    describeError,
    formatRetryStatusMessage,
    isAbortError,
    isRetryableNetworkError,
} from "../helpers/outlook-errorHandling";

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

    const handleSendSuccess = React.useCallback(
        async (itemKey: string, requestId: string, response: Awaited<ReturnType<typeof sendText>>) => {
            console.info(`[Taskpane] Send operation ${requestId} completed successfully.`);

            await applyStateForKey(itemKey, (currentState) => {
                if (currentState.activeRequestId && currentState.activeRequestId !== requestId) {
                    return currentState;
                }

                return {
                    ...currentState,
                    statusMessage: "Email content sent to the server.",
                    pipelineResponse: response,
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
                mailbox.removeHandlerAsync(Office.EventType.ItemChanged, (result) => {
                    if (result.status !== Office.AsyncResultStatus.Succeeded) {
                        console.warn("[Taskpane] Failed to remove ItemChanged handler.", result.error);
                    } else {
                        console.info("[Taskpane] ItemChanged handler removed.");
                    }
                });
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

import {ReactNode, useCallback, useEffect, useMemo, useState} from "react";
import {Badge, TabListProps, TabValue} from "@fluentui/react-components";
import {Checkmark16Regular} from "@fluentui/react-icons";

export interface UseTabsOptions {
    hasResponse: boolean;
    isOptionalPromptVisible: boolean;
    onOptionalPromptVisibilityChange: (visible: boolean) => void;
    responseBadgeClassName?: string;
    responseIconClassName?: string;
}

export interface UseTabsResult {
    selectedTab: TabValue;
    handleTabSelect: NonNullable<TabListProps["onTabSelect"]>;
    responseBadge: ReactNode;
}

export const useTabs = ({
    hasResponse,
    isOptionalPromptVisible,
    onOptionalPromptVisibilityChange,
    responseBadgeClassName,
    responseIconClassName,
}: UseTabsOptions): UseTabsResult => {
    const [selectedTab, setSelectedTab] = useState<TabValue>(() =>
        hasResponse ? "response" : "instruct"
    );

    useEffect(() => {
        setSelectedTab((current) => {
            if (hasResponse) {
                return "response";
            }

            if (current === "response") {
                return "instruct";
            }

            return current;
        });
    }, [hasResponse]);

    useEffect(() => {
        const shouldShowOptionalPrompt = selectedTab === "instruct";

        if (isOptionalPromptVisible !== shouldShowOptionalPrompt) {
            onOptionalPromptVisibilityChange(shouldShowOptionalPrompt);
        }
    }, [isOptionalPromptVisible, onOptionalPromptVisibilityChange, selectedTab]);

    const handleTabSelect = useCallback<NonNullable<TabListProps["onTabSelect"]>>(
        (_event, data) => {
            setSelectedTab(data.value);
        },
        []
    );

    const responseBadge = useMemo(() => (
        hasResponse ? (
            <Badge
                appearance="tint"
                shape="circular"
                color="success"
                className={responseBadgeClassName}
                icon={<Checkmark16Regular className={responseIconClassName} />}
            />
        ) : null
    ), [hasResponse, responseBadgeClassName, responseIconClassName]);

    return {
        selectedTab,
        handleTabSelect,
        responseBadge,
    };
};

export default useTabs;
