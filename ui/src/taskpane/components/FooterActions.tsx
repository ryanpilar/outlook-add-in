import * as React from "react";
import { Button, Spinner, makeStyles, tokens } from "@fluentui/react-components";

interface FooterActionsProps {
    isSending: boolean;
    emailResponse: string;
    onSend: () => void;
    onCancel: () => void;
    onClear: () => void;
}

const useStyles = makeStyles({
    root: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: "auto",
        paddingTop: "8px",
        paddingBottom: "8px",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    primaryActionButton: {
        flexGrow: 1,
    },
    primaryButtonContent: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacingHorizontalSNudge,
        width: "100%",
    },
    stopButton: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
    },
    clearButton: {
        whiteSpace: "nowrap",
    },
});

const FooterActions: React.FC<FooterActionsProps> = ({
    isSending,
    emailResponse,
    onSend,
    onCancel,
    onClear,
}) => {
    const styles = useStyles();

    return (
        <div className={styles.root}>
            <Button
                appearance="primary"
                disabled={isSending}
                size="large"
                onClick={onSend}
                className={styles.primaryActionButton}
            >
                {isSending ? (
                    <span className={styles.primaryButtonContent}>
                        <Spinner size="extra-tiny" />
                        Sending...
                    </span>
                ) : (
                    emailResponse ? "Try Again" : "Generate"
                )}
            </Button>
            {isSending ? (
                <Button
                    appearance="secondary"
                    size="large"
                    onClick={onCancel}
                    className={styles.stopButton}
                >
                    Stop
                </Button>
            ) : (
                <Button
                    appearance="secondary"
                    size="large"
                    onClick={onClear}
                    className={styles.clearButton}
                >
                    Reset
                </Button>
            )}
        </div>
    );
};

export default FooterActions;
