import * as React from "react";
import { useMemo, useState } from "react";
import { Button, Field, Textarea, tokens, makeStyles } from "@fluentui/react-components";
import { PipelineResponse } from "../taskpane";

interface TextInsertionProps {
  sendText: () => Promise<PipelineResponse>;
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
  },
  instructions: {
    fontWeight: tokens.fontWeightSemibold,
  },
  textAreaField: {
    width: "100%",
  },
  textArea: {
    width: "100%",
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
});

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pipelineResponse, setPipelineResponse] = useState<PipelineResponse | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleTextSend = async () => {
    try {
      setIsSending(true);
      setStatusMessage("Sending the current email content...");
      setPipelineResponse(null);
      const response = await props.sendText();
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
  const pipelineResponseAsJson = useMemo(
    () => (pipelineResponse ? JSON.stringify(pipelineResponse, null, 2) : ""),
    [pipelineResponse]
  );

  return (
    <div className={styles.textPromptAndInsertion}>
      <Field className={styles.instructions}>
        Press the button to send the body of the email you're viewing to the server.
      </Field>
      <Field className={styles.textAreaField} label="Status" size="large">
        <Textarea className={styles.textArea} value={statusMessage} readOnly resize="vertical" />
      </Field>
      <Field className={styles.textAreaField} label="Pipeline response" size="large">
        <Textarea
          className={styles.textArea}
          value={pipelineResponseAsJson}
          readOnly
          resize="vertical"
        />
      </Field>
      {pipelineResponse?.assistantResponse?.sourceCitations?.length ? (
        <div className={styles.linksSection}>
          <Field className={styles.textAreaField} label="Links provided">
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
