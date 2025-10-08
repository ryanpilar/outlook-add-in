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
import {useToasts} from "../hooks/useToasts";
import {TabResponse} from "./TabResponse";
import {TabLinks} from "./TabLinks";
import {TabInstruct} from "./TabInstruct";
import FooterActions from "./FooterActions";
import {useCitationSelection} from "../hooks/useCitationSelection";

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
    const {showSuccessToast, showErrorToast} = useToasts(TOASTER_ID);

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

    const {
        selectedCitationIndexes,
        selectedLinksCount,
        handleCitationSelectionChange,
        handleCopySelectedLinks,
    } = useCitationSelection({
        pipelineResponse: props.pipelineResponse,
        sourceCitations,
        showErrorToast,
        showSuccessToast,
    });

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
                    <TabList selectedValue={selectedTab} onTabSelect={handleTabSelect} className={styles.tabList}>
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
                        <TabResponse
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
                        <TabLinks
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
                        <TabInstruct
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
