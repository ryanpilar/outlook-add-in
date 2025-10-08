import * as React from "react";
import {useMemo, useCallback, useEffect, useState} from "react";
import {
    Badge,
    Tab,
    TabList,
    TabListProps,
    TabValue,
    tokens,
    makeStyles,
    Toaster,
    mergeClasses,
} from "@fluentui/react-components";
import {Checkmark16Regular} from "@fluentui/react-icons";
import {PipelineResponse} from "../taskpane";
import {copyTextToClipboard} from "../helpers/clipboard";
import {useTextInsertionToasts} from "../hooks/useTextInsertionToasts";
import {ResponseTab} from "./ResponseTab";
import {LinksTab} from "./LinksTab";
import {InstructTab} from "./InstructTab";
import FooterActions from "./FooterActions";

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
});

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
    const styles = useStyles();
    const {showSuccessToast, showErrorToast} = useTextInsertionToasts(TOASTER_ID);

    const [selectedCitationIndexes, setSelectedCitationIndexes] = useState<number[]>([]);

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
        }, []);

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
                        <Tab value="instruct" className={mergeClasses(styles.tab, styles.firstTab)}>
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
                        <ResponseTab
                            emailResponse={emailResponse}
                            onInjectResponse={handleInjectResponse}
                            onCopyResponse={handleCopyResponse}
                            containerClassName={mergeClasses(styles.tabPanel, styles.responseTabPanel)}
                            fieldClassName={styles.responseField}
                            actionsClassName={styles.responseActions}
                            buttonClassName={styles.responseButtons}
                            textAreaRootClassName={styles.responseTextAreaRoot}
                            textAreaClassName={styles.responseTextArea}
                        />
                    ) : null}
                    {selectedTab === "links" ? (
                        <LinksTab
                            sourceCitations={sourceCitations}
                            selectedCitationIndexes={selectedCitationIndexes}
                            selectedLinksCount={selectedLinksCount}
                            onCitationSelectionChange={handleCitationSelectionChange}
                            onCopySelectedLinks={handleCopySelectedLinks}
                            containerClassName={styles.tabPanel}
                            sectionClassName={styles.linksSection}
                            fieldClassName={styles.linksField}
                            toolbarClassName={styles.linksToolbar}
                            copyButtonClassName={styles.linksCopyButton}
                            listClassName={styles.linksList}
                            listItemClassName={styles.linkListItem}
                            anchorClassName={styles.linkAnchor}
                            emptyMessageClassName={styles.emptyLinksMessage}
                        />
                    ) : null}
                    {selectedTab === "instruct" ? (
                        <InstructTab
                            optionalPrompt={props.optionalPrompt}
                            onOptionalPromptChange={props.onOptionalPromptChange}
                            containerClassName={styles.tabPanel}
                            fieldClassName={styles.optionalPromptField}
                            textAreaRootClassName={styles.optionalPromptTextAreaRoot}
                            textAreaClassName={styles.optionalPromptTextArea}
                        />
                    ) : null}
                </div>
            </div>
            <FooterActions
                isSending={props.isSending}
                emailResponse={emailResponse}
                onSend={handleTextSend}
                onCancel={handleCancel}
                onClear={handleClear}
            />
        </div>
    );
};

export default TextInsertion;
