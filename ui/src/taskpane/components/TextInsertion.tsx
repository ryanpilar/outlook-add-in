import * as React from "react";
import {useMemo, useCallback, useEffect, useState} from "react";
import {
    Button,
    CounterBadge,
    Field,
    Textarea,
    TextareaOnChangeData,
    Tab,
    TabList,
    TabListProps,
    TabValue,
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
        gap: "4px",
        justifyContent: "space-between",
        width: "100%",
    },
    responseButtons: {
        flex: 1,
        maxWidth: "100px",
    },
    tabContainer: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        flexGrow: 1,
    },
    tabList: {
        width: "100%",
    },
    tabPanel: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        flexGrow: 1,
    },
    tabLabelWithBadge: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
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
    linksHeading: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
    },
    emptyLinksMessage: {
        color: tokens.colorNeutralForeground3,
        fontStyle: "italic",
    },
    actionsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
    },
    fullWidthButton: {
        width: "100%",
    },
    stopButton: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
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

    const [selectedTab, setSelectedTab] = useState<TabValue>(
        props.isOptionalPromptVisible ? "instruct" : "response"
    );

    useEffect(() => {
        setSelectedTab((current) => {
            if (props.isOptionalPromptVisible && current !== "instruct") {
                return "instruct";
            }

            if (!props.isOptionalPromptVisible && current === "instruct") {
                return "response";
            }

            return current;
        });
    }, [props.isOptionalPromptVisible]);

    useEffect(() => {
        const shouldShowOptionalPrompt = selectedTab === "instruct";

        if (props.isOptionalPromptVisible !== shouldShowOptionalPrompt) {
            props.onOptionalPromptVisibilityChange(shouldShowOptionalPrompt);
        }
    }, [props.isOptionalPromptVisible, props.onOptionalPromptVisibilityChange, selectedTab]);

    const handleTabSelect = useCallback<NonNullable<TabListProps["onTabSelect"]>>(
        (_event, data) => {
            setSelectedTab(data.value);
        },
        []
    );

    const sourceCitations = useMemo(
        () =>
            props.pipelineResponse?.assistantResponse?.sourceCitations?.filter(
                (citation) => Boolean(citation?.url)
            ) ?? [],
        [props.pipelineResponse]
    );

    const linksCount = sourceCitations.length;

    return (
        <div className={styles.textPromptAndInsertion}>
            <Field className={styles.instructions}>
                Press the button to send the body of the email you're viewing to the server.
            </Field>
            <Field className={styles.statusField} label="Status" size="large">
                <Textarea
                    value={props.statusMessage}
                    readOnly
                    textarea={{className: styles.statusTextArea}}
                />
            </Field>
            <div className={styles.tabContainer}>
                <TabList
                    selectedValue={selectedTab}
                    onTabSelect={handleTabSelect}
                    className={styles.tabList}
                >
                    <Tab value="response">Response</Tab>
                    <Tab value="links">
                        <span className={styles.tabLabelWithBadge}>
                            Links
                            <CounterBadge count={linksCount} size="extra-small" appearance="filled" />
                        </span>
                    </Tab>
                    <Tab value="instruct">Instruct</Tab>
                </TabList>
                {selectedTab === "response" ? (
                    <div className={styles.tabPanel}>
                        <Field className={styles.responseField} label="Email response" size="large">
                            <Textarea
                                value={emailResponse}
                                placeholder="The generated email response will appear here."
                                readOnly
                                resize="vertical"
                                textarea={{className: styles.responseTextArea}}
                            />
                            <div className={styles.responseActions}>
                                <Button
                                    appearance="secondary"
                                    icon={<Copy16Regular/>}
                                    size="small"
                                    disabled={!emailResponse}
                                    onClick={handleCopyResponse}
                                    className={styles.responseButtons}
                                />
                                <Button
                                    appearance="secondary"
                                    size="small"
                                    disabled={!emailResponse}
                                    onClick={handleInjectResponse}
                                    className={styles.responseButtons}
                                >
                                    Insert
                                </Button>
                                <Button
                                    appearance="secondary"
                                    size="small"
                                    onClick={handleClear}
                                    className={styles.responseButtons}
                                >
                                    Clear
                                </Button>
                            </div>
                        </Field>
                    </div>
                ) : null}
                {selectedTab === "links" ? (
                    <div className={styles.tabPanel}>
                        <div className={styles.linksSection}>
                            <Field
                                className={styles.linksField}
                                label={
                                    <span className={styles.linksHeading}>
                                        Links
                                        <CounterBadge
                                            count={linksCount}
                                            size="extra-small"
                                            appearance="filled"
                                        />
                                    </span>
                                }
                            >
                                {linksCount ? (
                                    <ul className={styles.linksList}>
                                        {sourceCitations.map((citation, index) => (
                                            <li key={`${citation?.url ?? "missing-url"}-${index}`}>
                                                <a
                                                    href={citation?.url ?? undefined}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {citation?.title || citation?.url}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className={styles.emptyLinksMessage}>
                                        No links available for this response yet.
                                    </span>
                                )}
                            </Field>
                        </div>
                    </div>
                ) : null}
                {selectedTab === "instruct" ? (
                    <div className={styles.tabPanel}>
                        <Field
                            className={styles.optionalPromptField}
                            label="Additional instructions"
                            size="large"
                            hint="Provide extra guidance for the assistant."
                        >
                            <Textarea
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
                    </div>
                ) : null}
            </div>
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
                    <Button
                        appearance="secondary"
                        size="large"
                        onClick={handleCancel}
                        className={styles.stopButton}
                    >
                        Stop
                    </Button>
                ) : null}
            </div>
        </div>
    );
};

export default TextInsertion;
