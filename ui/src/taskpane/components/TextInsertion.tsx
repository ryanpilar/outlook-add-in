import * as React from "react";
import {useMemo, useCallback, useEffect, useState} from "react";
import {
    Button,
    Badge,
    Field,
    Textarea,
    TextareaOnChangeData,
    Tab,
    TabList,
    TabListProps,
    TabValue,
    tokens,
    makeStyles,
    Toaster,
    useToastController,
    Toast,
    ToastTitle,
    ToastBody,
} from "@fluentui/react-components";
import {Copy16Regular, Checkmark16Regular} from "@fluentui/react-icons";
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

const TOASTER_ID = "text-insertion-toaster";

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
        minHeight: 0,
    },
    contentArea: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flexGrow: 1,
        minHeight: 0,
        overflow: "hidden",
    },
    instructions: {
        fontWeight: tokens.fontWeightSemibold,
    },
    optionalPromptField: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        "& .fui-Field__control": {
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            minHeight: 0,
            width: "100%",
        },
    },
    optionalPromptTextAreaRoot: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        width: "100%",
    },
    optionalPromptTextArea: {
        width: "100%",
        minHeight: "100%",
        flexGrow: 1,
        height: "100%",
        boxSizing: "border-box",
    },
    statusField: {
        width: "100%",
    },
    statusTextArea: {
        width: "100%",
        minHeight: "50px",
        resize: "none",
    },
    responseField: {
        width: "100%",
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: 0,
        "& .fui-Field__control": {
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            minHeight: 0,
            width: "100%",
        },
    },
    responseTextAreaRoot: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        width: "100%",
    },
    responseTextArea: {
        width: "100%",
        flexGrow: 1,
        minHeight: 0,
        height: "100%",
        boxSizing: "border-box",
        maxHeight: "100%",

    },
    responseActions: {
        display: "flex",
        gap: "4px",
        justifyContent: "space-between",
        width: "100%",
    },
    responseButtons: {
        flex: 1,
        minWidth: "50px",
    },
    responseIcon: {
        width: "13px",
    },
    badge: {
        display: "flex",
        width: "6px",
    },
    tabContainer: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        flexGrow: 1,
        minHeight: 0,
        overflow: "hidden",
    },
    tabList: {
        width: "100%",
        paddingLeft: "0px",
        paddingInlineStart: "0px",
        marginLeft: "0px",
        marginInlineStart: "0px",
    },
    tab: {
        paddingTop: tokens.spacingVerticalXXS,
        paddingBottom: tokens.spacingVerticalXXS,
    },
    firstTab: {
        paddingLeft: "0px",
        paddingInlineStart: "0px",
        marginLeft: "0px",
        marginInlineStart: "0px",
        "&::before": {
            left: "0px",
        },
        "&::after": {
            left: "0px",
        },
    },
    tabPanel: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        flexGrow: 1,
        minHeight: 0,
        overflowY: "auto",
    },
    responseTabPanel: {
        overflow: "hidden",
    },
    tabLabelWithBadge: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
    },
    linksList: {
        margin: 0,
        paddingLeft: "20px",
        listStyleType: "decimal",
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
        gap: "8px",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: "auto",
        paddingTop: "8px",
        paddingBottom: "4px",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    stopButton: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
    },
    primaryActionButton: {
        flexGrow: 1,
    },
    clearButton: {
        whiteSpace: "nowrap",
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
    const { dispatchToast } = useToastController(TOASTER_ID);

    const showSuccessToast = useCallback(
        (title: string, subtitle?: string) => {
            dispatchToast(
                <Toast intent="success">
                    <ToastTitle>{title}</ToastTitle>
                    {subtitle ? <ToastBody>{subtitle}</ToastBody> : null}
                </Toast>,
                { intent: "success" }
            );
        },
        [dispatchToast]
    );
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
            .then(() => {
                showSuccessToast("Copied to clipboard", "The response is ready to paste anywhere.");
            })
            .catch((error) => {
                console.error(error);
            });
    }, [emailResponse, props, showSuccessToast]);

    const handleInjectResponse = useCallback(() => {
        void props
            .onInjectResponse(emailResponse)
            .then(() => {
                showSuccessToast(
                    "Inserted into email",
                    "Check your draft body for the newly added response."
                );
            })
            .catch((error) => {
                console.error(error);
            });
    }, [emailResponse, props, showSuccessToast]);

    const handleClear = useCallback(() => {
        void props
            .onClear()
            .catch((error) => {
                console.error(error);
            });
    }, [props]);

    const hasResponse = emailResponse.length > 0;

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

    const responseBadge = hasResponse ? (
        <Badge appearance="tint" shape="circular" color="success" className={styles.badge}
               icon={<Checkmark16Regular className={styles.responseIcon}/>}/>
    ) : null;


    return (
        <div className={styles.textPromptAndInsertion}>
            <Toaster toasterId={TOASTER_ID} position="top-end" />
            <div className={styles.contentArea}>
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
                        <Tab value="instruct" className={`${styles.tab} ${styles.firstTab}`}>
                            Instruct
                        </Tab>
                        <Tab value="response" className={styles.tab}>
                            <span className={styles.tabLabelWithBadge}>
                                Response
                                {responseBadge}
                            </span>
                        </Tab>
                        <Tab value="links" className={styles.tab}>
                            <span className={styles.tabLabelWithBadge}>
                                Links
                                <Badge appearance="tint" shape="circular" className={styles.badge}>{linksCount}</Badge>
                            </span>
                        </Tab>
                    </TabList>
                    {selectedTab === "response" ? (
                        <div className={`${styles.tabPanel} ${styles.responseTabPanel}`}>
                            <Field
                                className={styles.responseField}
                            >
                                <div className={styles.responseActions}>

                                    <Button
                                        appearance="secondary"
                                        size="small"
                                        disabled={!emailResponse}
                                        onClick={handleInjectResponse}
                                        className={styles.responseButtons}
                                    >
                                        Insert Into Email
                                    </Button>
                                    <Button
                                        appearance="secondary"
                                        icon={<Copy16Regular/>}
                                        size="small"
                                        disabled={!emailResponse}
                                        onClick={handleCopyResponse}
                                        className={styles.responseButtons}
                                    />

                                </div>
                                <Textarea
                                    className={styles.responseTextAreaRoot}
                                    value={emailResponse}
                                    placeholder="The generated email response will appear here."
                                    readOnly
                                    resize="vertical"
                                    textarea={{className: styles.responseTextArea}}
                                />

                            </Field>
                        </div>
                    ) : null}
                    {selectedTab === "links" ? (
                        <div className={styles.tabPanel}>
                            <div className={styles.linksSection}>
                                <Field
                                    className={styles.linksField}
                                >
                                    {linksCount ? (
                                        <ol className={styles.linksList}>
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
                                        </ol>
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
                                size="large"
                                hint="Provide extra guidance for the assistant."
                            >
                                <Textarea
                                    value={props.optionalPrompt}
                                    onChange={(
                                        _event: React.ChangeEvent<HTMLTextAreaElement>,
                                        data: TextareaOnChangeData
                                    ) => props.onOptionalPromptChange(data.value)}
                                    placeholder="When you press Generate, we'll send the email message you're viewing to get an answer. Add extra details or tone preferences for the generated response. It's hooked up to web search too!"
                                    resize="vertical"
                                    className={styles.optionalPromptTextAreaRoot}

                                    textarea={{className: styles.optionalPromptTextArea}}
                                />
                            </Field>
                        </div>
                    ) : null}
                </div>
            </div>
            <div className={styles.actionsRow}>
                <Button
                    appearance="primary"
                    disabled={props.isSending}
                    size="large"
                    onClick={handleTextSend}
                    className={styles.primaryActionButton}
                >
                    {props.isSending ? "Sending..." : emailResponse ? "Regenerate" : "Generate"}
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
                ) : (
                    <Button
                        appearance="secondary"
                        size="large"
                        onClick={handleClear}
                        className={styles.clearButton}
                    >
                        Reset
                    </Button>
                )}
            </div>
        </div>
    );
};

export default TextInsertion;
