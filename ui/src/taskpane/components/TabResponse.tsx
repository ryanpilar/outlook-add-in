import * as React from "react";
import {memo} from "react";
import {Button, Field, Textarea} from "@fluentui/react-components";
import {ChevronLeft16Regular, ChevronRight16Regular, Copy16Regular} from "@fluentui/react-icons";

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
}) => (
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
            <Textarea
                className={textAreaRootClassName}
                value={emailResponse}
                placeholder="The generated email response will appear here."
                readOnly
                resize="vertical"
                textarea={{className: textAreaClassName}}
            />
        </Field>
    </div>
);

export const TabResponse = memo(ResponseTabComponent);

export default TabResponse;
