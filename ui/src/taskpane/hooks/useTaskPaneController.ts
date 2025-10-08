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

    const {ensureSendLifecycle, resumePendingOperationIfNeeded} = useSendLifecycleHandler({
        applyStateForKey,
        detachOperationSubscription,
        operationSubscriptionsRef,
    });

    const {sendCurrentEmail, cancelCurrentSend, resetTaskPaneState} = useSendLifecycleActions({
        applyStateForKey,
        mergeState,
        currentItemKeyRef,
        latestStateRef,
        operationSubscriptionsRef,
        detachOperationSubscription,
        ensureSendLifecycle,
    });

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

    useMailboxLifecycleHandler({refreshFromCurrentItem, isMountedRef, visibilityCleanupRef});

    const setStatusMessage = React.useCallback((statusMessage: string) => {
            mergeState({statusMessage})
        },
        [mergeState]
    );

    const updateOptionalPrompt = React.useCallback((value: string) => {
            mergeState({optionalPrompt: value});
        },
        [mergeState]
    );

    const setOptionalPromptVisible = React.useCallback((visible: boolean) => {
            mergeState({isOptionalPromptVisible: visible});
        },
        [mergeState]
    );

    const copyResponseToClipboard = React.useCallback(async (response: string) => {
            const result = await attemptToCopyResponse(response);
            setStatusMessage(result.statusMessage);
        },
        [setStatusMessage]
    );

    const injectResponseIntoEmail = React.useCallback(async (response: string) => {
            const result = await attemptToInsertResponse(response);
            setStatusMessage(result.statusMessage);
        },
        [setStatusMessage]
    );

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

    return {state, actions};
};
