import * as React from "react";
import { useState } from "react";
import { Button, Field, Textarea, tokens, makeStyles } from "@fluentui/react-components";

/* global HTMLTextAreaElement */

interface TextInsertionProps {
  sendText: (text: string) => void;
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
  const [text, setText] = useState<string>("Some text.");

    const handleTextSend = async () => {
      await props.sendText(text);
    };

  const handleTextChange = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const styles = useStyles();

  return (
    <div className={styles.textPromptAndInsertion}>
        <Field className={styles.textAreaField} size="large" label="Enter text to send to the API.">
          <Textarea size="large" value={text} onChange={handleTextChange} />
        </Field>
        <Field className={styles.instructions}>Click the button to send text.</Field>
        <Button appearance="primary" disabled={false} size="large" onClick={handleTextSend}>
          Send text
        </Button>
    </div>
  );
};

export default TextInsertion;
