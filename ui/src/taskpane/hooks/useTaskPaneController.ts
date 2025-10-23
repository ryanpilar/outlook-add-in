import * as React from "react";
import {
    createEmptyState,
    loadPersistedState,
    PersistedTaskPaneState,
} from "../helpers/outlook-persistence";
import {resolveStorageKeyForCurrentItem} from "../helpers/outlook-mailboxItem";
import {useTaskPaneStatePersistence} from "./useTaskPaneStatePersistence";
import {useSendLifecycleHandler} from "./useSendLifecycleHandler";
import {useSendLifecycleActions} from "./useSendLifecycleActions";
import {useMailboxLifecycleHandler} from "./useMailboxLifecycleHandler";
import {
    attemptToCopyResponse,
    attemptToInsertResponse,
} from "../helpers/responseActions";

export interface TaskPaneActions {
    refreshFromCurrentItem: () => Promise<void>;
    updateOptionalPrompt: (value: string) => void;
    setOptionalPromptVisible: (visible: boolean) => void;
    sendCurrentEmail: () => Promise<void>;
    cancelCurrentSend: () => Promise<void>;
    copyResponseToClipboard: (response: string) => Promise<void>;
    injectResponseIntoEmail: (response: string) => Promise<void>;
    showPreviousResponse: () => void;
    showNextResponse: () => void;
    resetTaskPaneState: () => Promise<void>;
}

export interface TaskPaneController {
    state: PersistedTaskPaneState;
    actions: TaskPaneActions;
}

/**
 * useTaskPaneController
 * -----------------------------------------------------------------------------
 * A central hook that wires together the individual lifecycle and persistence
 * helpers used throughout the task pane.
 *
 * The pieces plug together like this:
 *      useTaskPaneStatePersistence  →  owns the persisted state + refs shared below
 *      useSendLifecycleHandler      →  attaches listeners for background send flows
 *      useSendLifecycleActions      →  triggers/cancels send operations and updates
 *      useMailboxLifecycleHandler   →  responds to Office item + visibility changes
 *
 * The exported controller exposes the latest persisted state along with the
 * actions derived from these hooks so components can render UI and dispatch
 * user intent without needing to understand the plumbing behind the scenes.
 */

export const useTaskPaneController = (): TaskPaneController => {

    // Persist and synchronize the task pane state across mailbox items.
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

    // Listen for send lifecycle changes initiated outside the task pane UI.
    const {ensureSendLifecycle, resumePendingOperationIfNeeded} = useSendLifecycleHandler({
        applyStateForKey,
        detachOperationSubscription,
        operationSubscriptionsRef,
    });

    // Provide actions that drive the send lifecycle from the UI.
    const {sendCurrentEmail, cancelCurrentSend, resetTaskPaneState} = useSendLifecycleActions({
        applyStateForKey,
        mergeState,
        currentItemKeyRef,
        latestStateRef,
        operationSubscriptionsRef,
        detachOperationSubscription,
        ensureSendLifecycle,
    });

    // Re-evaluate the currently active mailbox item, load its persisted state if available,
    // and reconnect to any pending send operations that were in progress before navigation.
    const refreshFromCurrentItem = React.useCallback(async () => {
        console.info("[Taskpane] Refreshing task pane state for the current mailbox item.");
        const {key} = await resolveStorageKeyForCurrentItem();

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

    // React to mailbox and visibility changes to refresh controller state.
    useMailboxLifecycleHandler({refreshFromCurrentItem, isMountedRef, visibilityCleanupRef});

    // Update the status message shown in the task pane footer or console output.
    const setStatusMessage = React.useCallback((statusMessage: string) => {
            mergeState({statusMessage})
        },
        [mergeState]
    );

    // Persist user input in the optional prompt textarea so it survives navigation.
    const updateOptionalPrompt = React.useCallback((value: string) => {
            mergeState({optionalPrompt: value});
        },
        [mergeState]
    );

    // Toggle visibility of the optional prompt field based on tab or user interaction.
    const setOptionalPromptVisible = React.useCallback((visible: boolean) => {
            mergeState({isOptionalPromptVisible: visible});
        },
        [mergeState]
    );

    // Attempt to copy the generated response to the user’s clipboard
    const copyResponseToClipboard = React.useCallback(async (response: string) => {
            const result = await attemptToCopyResponse(response);
            setStatusMessage(result.statusMessage);
        },
        [setStatusMessage]
    );

    // Attempt to inject the generated response into the current Outlook draft body
    const injectResponseIntoEmail = React.useCallback(async (response: string) => {
            const result = await attemptToInsertResponse(response);
            setStatusMessage(result.statusMessage);
        },
        [setStatusMessage]
    );

    const showPreviousResponse = React.useCallback(() => {
            mergeState((previousState) => {
                const history = previousState.responseHistory ?? [];

                if (history.length === 0) {
                    return previousState;
                }

                const currentIndex = previousState.activeResponseIndex ?? history.length;
                const nextIndex = currentIndex - 1;

                if (nextIndex < 0) {
                    return previousState;
                }

                return {
                    ...previousState,
                    pipelineResponse: history[nextIndex],
                    activeResponseIndex: nextIndex,
                };
            });
        },
        [mergeState]
    );

    const showNextResponse = React.useCallback(() => {
            mergeState((previousState) => {
                const history = previousState.responseHistory ?? [];

                if (history.length === 0) {
                    return previousState;
                }

                const currentIndex = previousState.activeResponseIndex ?? history.length - 1;
                const nextIndex = currentIndex + 1;

                if (nextIndex >= history.length) {
                    return previousState;
                }

                return {
                    ...previousState,
                    pipelineResponse: history[nextIndex],
                    activeResponseIndex: nextIndex,
                };
            });
        },
        [mergeState]
    );

    // Bundle all user-facing actions into a stable object that can be passed to UI components
    const actions: TaskPaneActions = React.useMemo(
        () => ({
            refreshFromCurrentItem,
            updateOptionalPrompt,
            setOptionalPromptVisible,
            sendCurrentEmail,
            cancelCurrentSend,
            copyResponseToClipboard,
            injectResponseIntoEmail,
            showPreviousResponse,
            showNextResponse,
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
            showNextResponse,
            showPreviousResponse,
            updateOptionalPrompt,
        ]
    );

    return {state, actions};
};
