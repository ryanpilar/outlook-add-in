import * as React from "react";
import {useCallback} from "react";
import {Button, Toast, ToastBody, ToastTitle, useToastController} from "@fluentui/react-components";
import {CheckmarkCircle20Regular, Dismiss20Regular} from "@fluentui/react-icons";

export const useTextInsertionToasts = (toasterId: string) => {
    const {dispatchToast, dismissToast} = useToastController(toasterId);

    const showSuccessToast = useCallback(
        (title: string, subtitle?: string) => {
            // unique ID so you can dismiss it manually
            const toastId = crypto.randomUUID();

            dispatchToast(
                <Toast
                    appearance="inverted"
                    style={{position: "relative"}}
                >
                    <ToastTitle
                        media={<CheckmarkCircle20Regular/>}
                        action={
                            <Button
                                icon={<Dismiss20Regular/>}
                                appearance="transparent"
                                size="small"
                                aria-label="Close"
                                onClick={() => dismissToast(toastId)}
                            />
                        }
                    >
                        {title}
                    </ToastTitle>

                    {subtitle ? <ToastBody>{subtitle}</ToastBody> : null}
                </Toast>,
                {
                    toastId,
                    intent: "success",
                    timeout: 3500,
                }
            );
        },
        [dispatchToast, dismissToast]
    );

    const showErrorToast = useCallback(
        (title: string, subtitle?: string) => {
            dispatchToast(
                <Toast>
                    <ToastTitle>{title}</ToastTitle>
                    {subtitle ? <ToastBody>{subtitle}</ToastBody> : null}
                </Toast>,
                {intent: "error"}
            );
        },
        [dispatchToast]
    );

    return {showSuccessToast, showErrorToast};
};

export type UseTextInsertionToastsReturn = ReturnType<typeof useTextInsertionToasts>;
