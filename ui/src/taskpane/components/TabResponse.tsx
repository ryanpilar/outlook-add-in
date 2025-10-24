import * as React from "react";
import {memo, useMemo} from "react";
import {Button, Field, makeStyles, mergeClasses, tokens} from "@fluentui/react-components";
import {ChevronLeft16Regular, ChevronRight16Regular, Copy16Regular} from "@fluentui/react-icons";
import {convertMarkdownToHtml} from "../helpers/htmlFormatting";

export interface ResponseTabProps {
    emailResponse: string;
    onInjectResponse: () => void;
    onCopyResponse: () => void;
    onShowPreviousResponse: () => void;
    onShowNextResponse: () => void;
    canShowPrevious: boolean;
    canShowNext: boolean;
    containerClassName: string;
    fieldClassName: string;
    actionsClassName: string;
    buttonClassName: string;
    navigationButtonClassName?: string;
    textAreaRootClassName: string;
    textAreaClassName: string;
}

const useStyles = makeStyles({
    responseSurface: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
    },
    responseContent: {
        flexGrow: 1,
        minHeight: 0,
        width: "100%",
        overflowY: "auto",
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        backgroundColor: tokens.colorNeutralBackground1,
        color: tokens.colorNeutralForeground1,
        fontSize: "inherit",
        lineHeight: "inherit",
        boxSizing: "border-box",
        '& ul': {
            marginTop: 0,
            marginBottom: tokens.spacingVerticalL,
            paddingLeft: tokens.spacingHorizontalXL,
        },
        '& ol': {
            marginTop: 0,
            marginBottom: tokens.spacingVerticalL,
            paddingLeft: tokens.spacingHorizontalXL,
        },
        '& p': {
            marginTop: 0,
            marginBottom: tokens.spacingVerticalM,
        },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
            marginTop: 0,
            marginBottom: tokens.spacingVerticalS,
            fontWeight: tokens.fontWeightSemibold,
        },
        '& a': {
            color: tokens.colorBrandForegroundLink,
        },
        '& code': {
            fontFamily: tokens.fontFamilyMonospace,
            backgroundColor: tokens.colorNeutralBackground2,
            padding: `0 ${tokens.spacingHorizontalXXS}`,
            borderRadius: tokens.borderRadiusSmall,
        },
    },
    placeholder: {
        color: tokens.colorNeutralForeground3,
        fontStyle: "italic",
    },
});

const ResponseTabComponent: React.FC<ResponseTabProps> = ({
    emailResponse,
    onInjectResponse,
    onCopyResponse,
    onShowPreviousResponse,
    onShowNextResponse,
    canShowPrevious,
    canShowNext,
    containerClassName,
    fieldClassName,
    actionsClassName,
    buttonClassName,
    navigationButtonClassName,
    textAreaRootClassName,
    textAreaClassName,
}) => {
    const styles = useStyles();
    const hasResponse = emailResponse.trim().length > 0;

    const renderedHtml = useMemo(() => {
        if (!hasResponse) {
            return "";
        }

        return convertMarkdownToHtml(emailResponse);
    }, [emailResponse, hasResponse]);

    return (
        <div className={containerClassName}>
            <Field className={fieldClassName}>
                <div className={actionsClassName}>
                    <Button
                        appearance="secondary"
                        icon={<ChevronLeft16Regular />}
                    size="medium"
                    disabled={!canShowPrevious}
                    onClick={onShowPreviousResponse}
                    className={navigationButtonClassName}
                    aria-label="Show previous response"
                />
                <Button
                    appearance="secondary"
                    size="medium"
                    disabled={!emailResponse}
                    onClick={onInjectResponse}
                    className={buttonClassName}
                >
                    Insert
                </Button>
                <Button
                    appearance="secondary"
                    icon={<Copy16Regular/>}
                    size="small"
                    disabled={!emailResponse}
                    onClick={onCopyResponse}
                    className={buttonClassName}
                >
                    Copy
                </Button>
                <Button
                    appearance="secondary"
                    icon={<ChevronRight16Regular />}
                    size="small"
                    disabled={!canShowNext}
                    onClick={onShowNextResponse}
                    className={navigationButtonClassName}
                        aria-label="Show next response"
                    />
                </div>
                <div className={mergeClasses(textAreaRootClassName, styles.responseSurface)}>
                    {hasResponse ? (
                        <div
                            className={mergeClasses(textAreaClassName, styles.responseContent)}
                            dangerouslySetInnerHTML={{__html: renderedHtml}}
                        />
                    ) : (
                        <div className={mergeClasses(textAreaClassName, styles.placeholder)}>
                            The generated email response will appear here.
                        </div>
                    )}
                </div>
            </Field>
        </div>
    );
};

export const TabResponse = memo(ResponseTabComponent);

export default TabResponse;
