import {useCallback} from "react";
import {UseTextInsertionToastsReturn} from "./useToasts";

interface TextInsertionActionCallbacks {
    isSending: boolean;
    onSend: () => Promise<void>;
    onCancel: () => Promise<void>;
    onCopyResponse: (response: string) => Promise<void>;
    onInjectResponse: (response: string) => Promise<void>;
    onClear: () => Promise<void>;
}

interface UseTextInsertionActionsParams extends TextInsertionActionCallbacks {
    emailResponse: string;
    showSuccessToast: UseTextInsertionToastsReturn["showSuccessToast"];
    showErrorToast: UseTextInsertionToastsReturn["showErrorToast"];
}

export const useTextInsertionActions = ({
    emailResponse,
    isSending,
    onSend,
    onCancel,
    onCopyResponse,
    onInjectResponse,
    onClear,
    showSuccessToast,
    showErrorToast,
}: UseTextInsertionActionsParams) => {
    const handleTextSend = useCallback(async () => {
        // Bail out if a send is already underway so we don't queue duplicate requests.
        if (isSending) {
            return;
        }

        try {
            await onSend();
        } catch (error) {
            console.error(error);
            showErrorToast(
                "Unable to send request",
                "Something went wrong while contacting the service. Please try again."
            );
        }
    }, [isSending, onSend, showErrorToast]);

    const handleCancel = useCallback(() => {
        void onCancel().catch((error) => {
            console.error(error);
            showErrorToast(
                "Unable to cancel request",
                "We couldn't stop the current request. Please try again."
            );
        });
    }, [onCancel, showErrorToast]);

    const handleCopyResponse = useCallback(() => {
        void onCopyResponse(emailResponse)
            .then(() => {
                showSuccessToast(
                    "Copied to clipboard",
                    "The response is ready to paste anywhere."
                );
            })
            .catch((error) => {
                console.error(error);
                showErrorToast(
                    "Unable to copy response",
                    "Check your clipboard permissions and try again."
                );
            });
    }, [emailResponse, onCopyResponse, showErrorToast, showSuccessToast]);

    const handleInjectResponse = useCallback(() => {
        void onInjectResponse(emailResponse)
            .then(() => {
                showSuccessToast(
                    "Inserted into email",
                    "Check your draft body for the newly added response."
                );
            })
            .catch((error) => {
                console.error(error);
                showErrorToast(
                    "Unable to insert response",
                    "Please try again after confirming you have an email open."
                );
            });
    }, [emailResponse, onInjectResponse, showErrorToast, showSuccessToast]);

    const handleClear = useCallback(() => {
        void onClear().catch((error) => {
            console.error(error);
            showErrorToast(
                "Unable to reset",
                "Please try again to clear the current response."
            );
        });
    }, [onClear, showErrorToast]);

    return {
        handleTextSend,
        handleCancel,
        handleCopyResponse,
        handleInjectResponse,
        handleClear,
    };
};

export type UseTextInsertionActionsReturn = ReturnType<typeof useTextInsertionActions>;
