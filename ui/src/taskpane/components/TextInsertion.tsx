import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Field,
  Textarea,
  TextareaOnChangeData,
  tokens,
  makeStyles,
} from "@fluentui/react-components";
import { PipelineResponse } from "../taskpane";
import { usePerItemPersistedState } from "../hooks/usePerItemPersistedState";
import type { TaskPaneSnapshot } from "../storage/taskPaneSnapshot";
import { writeSnapshotForItem } from "../storage/taskPaneStorage";

interface TextInsertionProps {
  sendText: (optionalPrompt?: string) => Promise<PipelineResponse>;
  activeItemId: string | null;
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
  const { sendText, activeItemId } = props;
  const { snapshot, setSnapshot, isHydrated } = usePerItemPersistedState(activeItemId);
  const [isSending, setIsSending] = useState<boolean>(false);

  // The persisted snapshot drives all UI fields so rehydration from storage and
  // the live React state always agree.
  const statusMessage = snapshot.statusMessage;
  const pipelineResponse = snapshot.pipelineResponse;
  const isOptionalPromptVisible = snapshot.isOptionalPromptVisible;
  const optionalPrompt = snapshot.optionalPrompt;

  const handleTextSend = useCallback(async () => {
    const itemIdAtRequestStart = activeItemId;
    const baselineSnapshot: TaskPaneSnapshot = { ...snapshot };
    let sendingSnapshot: TaskPaneSnapshot | null = null;

    try {
      setIsSending(true);
      const preparedSnapshot: TaskPaneSnapshot = {
        ...baselineSnapshot,
        statusMessage: "Sending the current email content...",
        pipelineResponse: null,
      };
      sendingSnapshot = preparedSnapshot;
      setSnapshot(preparedSnapshot);

      // Send the email content using the optional instructions (if any). Trimming
      // avoids storing accidental whitespace-only prompts in the persisted state.
      const response = await sendText(optionalPrompt.trim() || undefined);
      const baseSnapshot = sendingSnapshot ?? preparedSnapshot;
      const successSnapshot: TaskPaneSnapshot = {
        ...baseSnapshot,
        statusMessage: "Email content sent to the server.",
        pipelineResponse: response,
      };

      if (itemIdAtRequestStart === activeItemId) {
        setSnapshot(successSnapshot);
      } else if (itemIdAtRequestStart) {
        // If the user switched messages mid-request we still persist the
        // originating snapshot so it's ready when they navigate back.
        await writeSnapshotForItem(itemIdAtRequestStart, successSnapshot);
      }
    } catch (error) {
      console.error(error);
      const failureSnapshot: TaskPaneSnapshot = {
        ...(sendingSnapshot ?? baselineSnapshot),
        statusMessage: "We couldn't send the email content. Please try again.",
        pipelineResponse: null,
      };

      if (itemIdAtRequestStart === activeItemId) {
        setSnapshot(failureSnapshot);
      } else if (itemIdAtRequestStart) {
        await writeSnapshotForItem(itemIdAtRequestStart, failureSnapshot);
      }
    } finally {
      setIsSending(false);
    }
  }, [activeItemId, optionalPrompt, sendText, setSnapshot, snapshot]);

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
          disabled={isSending || !isHydrated}
          onClick={() =>
            setSnapshot((previous) => ({
              ...previous,
              isOptionalPromptVisible: !previous.isOptionalPromptVisible,
            }))
          }
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
            ) =>
              setSnapshot((previous) => ({
                ...previous,
                optionalPrompt: data.value,
              }))
            }
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
      <Button
        appearance="primary"
        disabled={isSending || !isHydrated}
        size="large"
        onClick={handleTextSend}
      >
        {isSending ? "Sending..." : "Send email content"}
      </Button>
    </div>
  );
};

export default TextInsertion;
