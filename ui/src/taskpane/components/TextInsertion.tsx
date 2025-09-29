import * as React from "react";
import { useState } from "react";
import { Button, Field, Textarea, tokens, makeStyles } from "@fluentui/react-components";

interface TextInsertionProps {
  sendText: () => Promise<void>;
}

const useStyles = makeStyles({
  instructions: {
    fontWeight: tokens.fontWeightSemibold,
    marginTop: "20px",
    marginBottom: "10px",
  },
  textPromptAndInsertion: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  textAreaField: {
    marginLeft: "20px",
    marginTop: "30px",
    marginBottom: "20px",
    marginRight: "20px",
    maxWidth: "50%",
  },
});

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleTextSend = async () => {
    try {
      setIsSending(true);
      setStatusMessage("Sending the current email content...");
      await props.sendText();
      setStatusMessage("Email content sent to the server.");
    } catch (error) {
      console.error(error);
      setStatusMessage("We couldn't send the email content. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const styles = useStyles();

  return (
    <div className={styles.textPromptAndInsertion}>
      <Field className={styles.instructions}>
        Press the button to send the body of the email you're viewing to the server.
      </Field>
      <Field className={styles.textAreaField} label="Status" size="large">
        <Textarea value={statusMessage} readOnly resize="vertical" />
      </Field>
      <Button appearance="primary" disabled={isSending} size="large" onClick={handleTextSend}>
        {isSending ? "Sending..." : "Send email content"}
      </Button>
    </div>
  );
};

export default TextInsertion;
