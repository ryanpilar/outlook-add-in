import * as React from "react";
import {memo} from "react";
import {Field, Textarea, TextareaOnChangeData} from "@fluentui/react-components";

export interface InstructTabProps {
    optionalPrompt: string;
    onOptionalPromptChange: (value: string) => void;
    containerClassName: string;
    fieldClassName: string;
    textAreaRootClassName: string;
    textAreaClassName: string;
}

const InstructTabComponent: React.FC<InstructTabProps> = ({
    optionalPrompt,
    onOptionalPromptChange,
    containerClassName,
    fieldClassName,
    textAreaRootClassName,
    textAreaClassName,
}) => (
    <div className={containerClassName}>
        <Field
            className={fieldClassName}
            size="large"
            hint="Provide extra guidance for the assistant."
        >
            <Textarea
                value={optionalPrompt}
                onChange={(
                    _event: React.ChangeEvent<HTMLTextAreaElement>,
                    data: TextareaOnChangeData
                ) => onOptionalPromptChange(data.value)}
                placeholder={
                    "If you need to add any extra details or tone preferences, do so in this space right here!\n\nWhen you press 'Generate', we'll use the email you're viewing to draft a relevant reply with source links.\n\nIt's connected to the web, too!"
                }
                resize="vertical"
                className={textAreaRootClassName}
                textarea={{className: textAreaClassName}}
            />
        </Field>
    </div>
);

export const InstructTab = memo(InstructTabComponent);

export default InstructTab;
