import * as React from "react";
import {useMemo, useCallback} from "react";
import {
    Button,
    Field,
    Textarea,
    TextareaOnChangeData,
    tokens,
    makeStyles,
} from "@fluentui/react-components";
import {Copy16Regular} from "@fluentui/react-icons";
import {PipelineResponse} from "../taskpane";

interface TextInsertionProps {
    optionalPrompt: string;
    onOptionalPromptChange: (value: string) => void;
    isOptionalPromptVisible: boolean;
    onOptionalPromptVisibilityChange: (visible: boolean) => void;
    statusMessage: string;
    pipelineResponse: PipelineResponse | null;
    onSend: () => Promise<void>;
    isSending: boolean;
    onCancel: () => Promise<void>;
    onCopyResponse: (response: string) => Promise<void>;
    onInjectResponse: (response: string) => Promise<void>;
    onClear: () => Promise<void>;
}

const useStyles = makeStyles({
    textPromptAndInsertion: {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "16px",
        padding: "24px",
        width: "100%",
        boxSizing: "border-box",
        height: "100%",
    },
    instructions: {
        fontWeight: tokens.fontWeightSemibold,
    },
    optionalPromptField: {
        width: "100%",
    },
    optionalPromptTextArea: {
        width: "100%",
        minHeight: "140px",
    },
    statusField: {
        width: "100%",
    },
    statusTextArea: {
        width: "100%",
        minHeight: "56px",
        resize: "none",
    },
    responseField: {
        width: "100%",
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    responseTextArea: {
        width: "100%",
        flexGrow: 1,
        minHeight: "400px",
    },
    responseActions: {
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        justifyContent: "flex-start",
    },
    linksList: {
        margin: 0,
        paddingLeft: "20px",
    },
    linksSection: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    linksField: {
        width: "100%",
    },
    actionsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
    },
    primaryActionButton: {
        width: "100%",
    },
});

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
    const handleTextSend = async () => {
        // Bail out if a send is already underway so we don't queue duplicate requests.
        if (props.isSending) {
            return;
        }

        try {
            await props.onSend();
        } catch (error) {
            console.error(error);
        }
    };

    const styles = useStyles();
    const handleCancel = () => {
        props
            .onCancel()
            .catch((error) => {
                console.error(error);
            });
    };
    const emailResponse = useMemo(
        () => props.pipelineResponse?.assistantResponse?.emailResponse?.trim() ?? "",
        [props.pipelineResponse]
    );

    const handleCopyResponse = useCallback(() => {
        void props
            .onCopyResponse(emailResponse)
            .catch((error) => {
                console.error(error);
            });
    }, [emailResponse, props]);

    const handleInjectResponse = useCallback(() => {
        void props
            .onInjectResponse(emailResponse)
            .catch((error) => {
                console.error(error);
            });
    }, [emailResponse, props]);

    const handleClear = useCallback(() => {
        void props
            .onClear()
            .catch((error) => {
                console.error(error);
            });
    }, [props]);

    return (
        <div className={styles.textPromptAndInsertion}>
            <Field className={styles.instructions}>
                Press the button to send the body of the email you're viewing to the server.
            </Field>
            <div className={styles.actionsRow}>
                <Button
                    appearance="secondary"
                    disabled={props.isSending}
                    onClick={() => props.onOptionalPromptVisibilityChange(!props.isOptionalPromptVisible)}
                >
                    {props.isOptionalPromptVisible ? "Hide instructions" : "Add instructions"}
                </Button>
            </div>
            {props.isOptionalPromptVisible ? (
                <Field
                    className={styles.optionalPromptField}
                    label="Additional instructions"
                    size="large"
                    hint="Provide extra guidance for the assistant."
                >
                    <Textarea
                        // className={styles.optionalPromptTextArea}
                        value={props.optionalPrompt}
                        onChange={(
                            _event: React.ChangeEvent<HTMLTextAreaElement>,
                            data: TextareaOnChangeData
                        ) => props.onOptionalPromptChange(data.value)}
                        placeholder="Add extra details or tone preferences for the generated response."
                        resize="vertical"
                        textarea={{className: styles.optionalPromptTextArea}}
                    />
                </Field>
            ) : null}
            <Field className={styles.statusField} label="Status" size="large">
                <Textarea
                    value={props.statusMessage}
                    readOnly
                    textarea={{className: styles.statusTextArea}}
                />
            </Field>
            <Field className={styles.responseField} label="Email response" size="large">
                <Textarea
                    // className={styles.responseTextArea}
                    value={emailResponse}
                    placeholder="The generated email response will appear here."
                    readOnly
                    resize="vertical"
                    textarea={{className: styles.responseTextArea}}
                />
                <div className={styles.responseActions}>
                    <Button
                        appearance="secondary"
                        size="large"
                        disabled={!emailResponse}
                        onClick={handleInjectResponse}
                    >
                        Insert
                    </Button>
                    <Button
                        appearance="secondary"
                        // icon={<Copy16Regular/>}
                        size="medium"
                        disabled={!emailResponse}
                        onClick={handleCopyResponse}
                    >
                        Copy
                    </Button>
                    <Button appearance="secondary" size="medium" onClick={handleClear}>
                        Clear
                    </Button>
                </div>
            </Field>
            {props.pipelineResponse?.assistantResponse?.sourceCitations?.length ? (
                <div className={styles.linksSection}>
                    <Field className={styles.linksField} label="Links provided">
                        <ul className={styles.linksList}>
                            {props.pipelineResponse.assistantResponse.sourceCitations.map((citation, index) =>
                                citation?.url ? (
                                    <li key={`${citation.url}-${index}`}>
                                        <a href={citation.url} target="_blank" rel="noreferrer">
                                            {citation.title || citation.url}
                                        </a>
                                    </li>
                                ) : null
                            )}
                        </ul>
                    </Field>
                </div>
            ) : null}
            <div className={styles.actionsRow}>
                <Button
                    appearance="primary"
                    disabled={props.isSending}
                    size="large"
                    onClick={handleTextSend}
                    className={styles.primaryActionButton}
                >
                    {props.isSending ? "Sending..." : emailResponse ? "Generate new response" : "Generate response"}
                </Button>
                {props.isSending ? (
                    <Button appearance="secondary" size="large" onClick={handleCancel}>
                        Stop
                    </Button>
                ) : null}
            </div>
        </div>
    );
};

export default TextInsertion;
