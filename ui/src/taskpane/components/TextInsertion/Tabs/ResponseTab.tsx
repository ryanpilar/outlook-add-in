import * as React from "react";
import {memo} from "react";
import {Button, Field, Textarea} from "@fluentui/react-components";
import {Copy16Regular} from "@fluentui/react-icons";

export interface ResponseTabProps {
    emailResponse: string;
    onInjectResponse: () => void;
    onCopyResponse: () => void;
    containerClassName: string;
    fieldClassName: string;
    actionsClassName: string;
    buttonClassName: string;
    textAreaRootClassName: string;
    textAreaClassName: string;
}

const ResponseTabComponent: React.FC<ResponseTabProps> = ({
    emailResponse,
    onInjectResponse,
    onCopyResponse,
    containerClassName,
    fieldClassName,
    actionsClassName,
    buttonClassName,
    textAreaRootClassName,
    textAreaClassName,
}) => (
    <div className={containerClassName}>
        <Field className={fieldClassName}>
            <div className={actionsClassName}>
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

export const ResponseTab = memo(ResponseTabComponent);

export default ResponseTab;
