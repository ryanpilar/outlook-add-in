import * as React from "react";
import { useMemo, useState } from "react";
import {
  Button,
  Field,
  Textarea,
  TextareaOnChangeData,
  tokens,
  makeStyles,
} from "@fluentui/react-components";
import { PipelineResponse } from "../taskpane";

interface TextInsertionProps {
  sendText: (optionalPrompt?: string) => Promise<PipelineResponse>;
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
  },
  responseTextArea: {
    width: "100%",
    flexGrow: 1,
    minHeight: "400px",
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
  },
});

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pipelineResponse, setPipelineResponse] = useState<PipelineResponse | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isOptionalPromptVisible, setIsOptionalPromptVisible] = useState<boolean>(false);
  const [optionalPrompt, setOptionalPrompt] = useState<string>("");

  const handleTextSend = async () => {
    try {
      setIsSending(true);
      setStatusMessage("Sending the current email content...");
      setPipelineResponse(null);
      const response = await props.sendText(optionalPrompt.trim() || undefined);
      setStatusMessage("Email content sent to the server.");
      setPipelineResponse(response);
    } catch (error) {
      console.error(error);
      setStatusMessage("We couldn't send the email content. Please try again.");
      setPipelineResponse(null);
    } finally {
      setIsSending(false);
    }
  };

  const styles = useStyles();
  const emailResponse = useMemo(
    () => pipelineResponse?.assistantResponse?.emailResponse?.trim() ?? "",
    [pipelineResponse]
  );

  return (
    <div className={styles.textPromptAndInsertion}>
      <Field className={styles.instructions}>
        Press the button to send the body of the email you're viewing to the server.
      </Field>
      <div className={styles.actionsRow}>
        <Button
          appearance="secondary"
          disabled={isSending}
          onClick={() => setIsOptionalPromptVisible((previous) => !previous)}
        >
          {isOptionalPromptVisible ? "Hide instructions" : "Add instructions"}
        </Button>
      </div>
      {isOptionalPromptVisible ? (
        <Field
          className={styles.optionalPromptField}
          label="Additional instructions"
          size="large"
          hint="Provide extra guidance for the assistant."
        >
          <Textarea
            className={styles.optionalPromptTextArea}
            value={optionalPrompt}
            onChange={(
              _event: React.ChangeEvent<HTMLTextAreaElement>,
              data: TextareaOnChangeData
            ) => setOptionalPrompt(data.value)}
            placeholder="Add extra details or tone preferences for the generated response."
            resize="vertical"
          />
        </Field>
      ) : null}
      <Field className={styles.statusField} label="Status" size="large">
        <Textarea className={styles.statusTextArea} value={statusMessage} readOnly />
      </Field>
      <Field className={styles.responseField} label="Email response" size="large">
        <Textarea
          className={styles.responseTextArea}
          value={emailResponse}
          placeholder="The generated email response will appear here."
          readOnly
          resize="vertical"
        />
      </Field>
      {pipelineResponse?.assistantResponse?.sourceCitations?.length ? (
        <div className={styles.linksSection}>
          <Field className={styles.linksField} label="Links provided">
            <ul className={styles.linksList}>
              {pipelineResponse.assistantResponse.sourceCitations.map((citation, index) =>
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
      <Button appearance="primary" disabled={isSending} size="large" onClick={handleTextSend}>
        {isSending ? "Sending..." : "Send email content"}
      </Button>
    </div>
  );
};

export default TextInsertion;
