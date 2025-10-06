import * as React from "react";
import {useMemo, useCallback, useEffect, useState} from "react";
import {
    Button,
    Checkbox,
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
    ToastBody, Spinner,
} from "@fluentui/react-components";
import {Copy16Regular, Checkmark16Regular, CheckmarkCircle20Regular, Dismiss20Regular} from "@fluentui/react-icons";
import {PipelineResponse} from "../taskpane";
import {copyTextToClipboard} from "../helpers/clipboard";

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

const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (match) => {
        switch (match) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return match;
        }
    });

const useStyles = makeStyles({
    textPromptAndInsertion: {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "16px",
        paddingLeft: "12px",
        paddingRight: "12px",
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
        paddingLeft: "4px",
        paddingRight: "4px"
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
        fontWeight: 'normal'
    },
    responseIcon: {
        width: "13px",
    },
    badge: {
        display: "flex",
        width: "1px",
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
        paddingBottom: tokens.spacingVerticalS,
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
    linksToolbar: {
        display: "flex",
        alignItems: "center",
        marginBottom: "8px",
        gap: "8px",
        justifyContent: "end"
    },
    linksList: {
        margin: 0,
        paddingLeft: "0px",
        listStyleType: "none",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    linkListItem: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    linkAnchor: {
        wordBreak: "break-word",
    },
    linksSection: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    linksField: {
        width: "100%",
    },
    linksCopyButton: {
        fontWeight: 'normal',
        minWidth: "50%",
        fontSize: "small"
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
        // background: '#2A2A2A',
    },
    primaryButtonContent: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacingHorizontalSNudge,
        width: "100%",
    },
    clearButton: {
        whiteSpace: "nowrap",
    },
});

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
    const styles = useStyles();
    const {dispatchToast, dismissToast} = useToastController(TOASTER_ID);

    const [selectedCitationIndexes, setSelectedCitationIndexes] = useState<number[]>([]);

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

    const handleTextSend = async () => {
        // Bail out if a send is already underway so we don't queue duplicate requests.
        if (props.isSending) {
            return;
        }

        try {
            await props.onSend();
        } catch (error) {
            console.error(error);
            showErrorToast(
                "Unable to send request",
                "Something went wrong while contacting the service. Please try again."
            );
        }
    };
    const handleCancel = () => {
        props
            .onCancel()
            .catch((error) => {
                console.error(error);
                showErrorToast(
                    "Unable to cancel request",
                    "We couldn't stop the current request. Please try again."
                );
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
                showErrorToast(
                    "Unable to copy response",
                    "Check your clipboard permissions and try again."
                );
            });
    }, [emailResponse, props, showErrorToast, showSuccessToast]);

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
                showErrorToast(
                    "Unable to insert response",
                    "Please try again after confirming you have an email open."
                );
            });
    }, [emailResponse, props, showErrorToast, showSuccessToast]);

    const handleClear = useCallback(() => {
        void props
            .onClear()
            .catch((error) => {
                console.error(error);
                showErrorToast(
                    "Unable to reset",
                    "Please try again to clear the current response."
                );
            });
    }, [props, showErrorToast]);

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

    const selectedLinksCount = selectedCitationIndexes.length;

    useEffect(() => {
        setSelectedCitationIndexes((current) =>
            current.filter((index) => index < sourceCitations.length)
        );
    }, [sourceCitations.length]);

    useEffect(() => {
        setSelectedCitationIndexes([]);
    }, [props.pipelineResponse]);

    const handleCitationSelectionChange = useCallback((index: number, isSelected: boolean) => {
        setSelectedCitationIndexes((current) => {
            if (isSelected) {
                if (current.includes(index)) {
                    return current;
                }

                return [...current, index].sort((a, b) => a - b);
            }

            return current.filter((value) => value !== index);
        });
    }, []);

    const handleCopySelectedLinks = useCallback(async () => {
        if (!selectedLinksCount) {
            return;
        }

        const selectedLinks = selectedCitationIndexes
            .map((citationIndex) => sourceCitations[citationIndex])
            .filter((citation) => Boolean(citation?.url));

        if (!selectedLinks.length) {
            showErrorToast("Nothing to copy", "Select at least one link first.");
            return;
        }

        const textToCopy = selectedLinks
            .map((citation) => {
                const url = citation?.url ?? "";
                const title = citation?.title?.trim();

                if (title && title !== url) {
                    return `${title} - ${url}`;
                }

                return url;
            })
            .join("\n");

        const htmlToCopy = selectedLinks
            .map((citation) => {
                const url = citation?.url ?? "";
                const title = citation?.title?.trim() || url;

                if (!url) {
                    return escapeHtml(title);
                }

                return `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`;
            })
            .join("<br />");

        try {
            await copyTextToClipboard(textToCopy, htmlToCopy);
            showSuccessToast(
                selectedLinks.length === 1
                    ? "Link copied to clipboard"
                    : "Links copied to clipboard",
                selectedLinks.length === 1
                    ? "The selected link is ready to paste."
                    : `${selectedLinks.length} links are ready to paste.`
            );
        } catch (error) {
            console.error(error);
            showErrorToast(
                "Unable to copy links",
                "Check your clipboard permissions and try again."
            );
        }
    }, [selectedCitationIndexes, selectedLinksCount, showErrorToast, showSuccessToast, sourceCitations]);

    const responseBadge = hasResponse ? (
        <Badge appearance="tint" shape="circular" color="success" className={styles.badge}
               icon={<Checkmark16Regular className={styles.responseIcon}/>}/>
    ) : null;


    return (
        <div className={styles.textPromptAndInsertion}>
            <Toaster toasterId={TOASTER_ID} position="bottom-end"/>
            <div className={styles.contentArea}>

                {/*<Field className={styles.instructions}>*/}
                {/*    Press the button to send the body of the email you're viewing to the server.*/}
                {/*</Field>*/}
                {/*<Field className={styles.statusField} label="Status" size="large">*/}
                {/*    <Textarea*/}
                {/*        value={props.statusMessage}*/}
                {/*        readOnly*/}
                {/*        textarea={{className: styles.statusTextArea}}*/}
                {/*    />*/}
                {/*</Field>*/}

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
                                <Badge shape="circular" className={styles.badge}>
                                    {linksCount}
                                </Badge>
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
                                        size="medium"
                                        disabled={!emailResponse}
                                        onClick={handleInjectResponse}
                                        className={styles.responseButtons}
                                    >
                                        Insert
                                    </Button>
                                    <Button
                                        appearance="secondary"
                                        icon={<Copy16Regular/>}
                                        size="small"
                                        disabled={!emailResponse}
                                        onClick={handleCopyResponse}
                                        className={styles.responseButtons}
                                    >
                                        Copy
                                    </Button>

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
                                        <div className={styles.linksSection}>
                                            <div className={styles.linksToolbar}>
                                                <Button
                                                    appearance="secondary"
                                                    icon={<Copy16Regular/>}
                                                    size="medium"
                                                    onClick={() => {
                                                        if (!selectedLinksCount) return
                                                        handleCopySelectedLinks()
                                                    }}
                                                    className={styles.linksCopyButton}
                                                >
                                                    {`Copy (${selectedLinksCount})`}
                                                </Button>
                                            </div>
                                            <ul className={styles.linksList}>
                                                {sourceCitations.map((citation, index) => {
                                                    const anchorId = `citation-link-${index}`;
                                                    const isSelected = selectedCitationIndexes.includes(index);

                                                    return (
                                                        <li
                                                            className={styles.linkListItem}
                                                            key={`${citation?.url ?? "missing-url"}-${index}`}
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onChange={(_event, data) =>
                                                                    handleCitationSelectionChange(index, Boolean(data?.checked))
                                                                }
                                                                aria-labelledby={anchorId}
                                                            />
                                                            <a
                                                                id={anchorId}
                                                                className={styles.linkAnchor}
                                                                href={citation?.url ?? undefined}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                {citation?.title || citation?.url}
                                                            </a>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
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
                                    placeholder={
                                        "If you need to add any extra details or tone preferences, do so in this space right here!\n\nWhen you press 'Generate', we'll use the email you're viewing to draft a relevant reply with source links.\n\nIt's connected to the web, too!"
                                    }

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
                    {props.isSending ? (
                        <span className={styles.primaryButtonContent}>
                            <Spinner size="extra-tiny"/>
                            Sending...
                        </span>
                    ) : (
                        emailResponse ? "Try Again" : "Generate"
                    )}
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
