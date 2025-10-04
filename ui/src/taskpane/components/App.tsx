/* global Office, console */

import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import Header from "./Header";
import TextInsertion from "./TextInsertion";
import { sendText } from "../taskpane";
import {
  createEmptyState,
  loadPersistedState,
  PersistedTaskPaneState,
  savePersistedState,
} from "../helpers/persistence";
import { resolveStorageKeyForCurrentItem } from "../helpers/mailboxItem";
import { registerTaskpaneVisibilityHandler } from "../helpers/runtime";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
  },
});

const App: React.FC<AppProps> = ({ title }) => {
  const styles = useStyles();
  const [viewState, setViewState] = React.useState<PersistedTaskPaneState>(() =>
    createEmptyState()
  );
  const currentItemKeyRef = React.useRef<string | null>(null);
  const visibilityCleanupRef = React.useRef<(() => Promise<void>) | null>(null);
  const isMountedRef = React.useRef<boolean>(false);

  const applyStateUpdate = React.useCallback(
    (updater: (previous: PersistedTaskPaneState) => PersistedTaskPaneState) => {
      const targetKey = currentItemKeyRef.current;
      setViewState((previous) => {
        const next = updater(previous);

        if (targetKey) {
          savePersistedState(targetKey, next).catch((error) => {
            console.warn(`[Taskpane] Failed to persist state for key ${targetKey}.`, error);
          });
        }

        return next;
      });
    },
    []
  );

  const mergeState = React.useCallback(
    (partial: Partial<PersistedTaskPaneState>) => {
      applyStateUpdate((previous) => ({
        ...previous,
        ...partial,
        lastUpdatedUtc: new Date().toISOString(),
      }));
    },
    [applyStateUpdate]
  );

  const refreshFromCurrentItem = React.useCallback(async () => {
    const { key } = await resolveStorageKeyForCurrentItem();

    if (!isMountedRef.current) {
      return;
    }

    if (key === null) {
      currentItemKeyRef.current = null;
      setViewState(createEmptyState());
      return;
    }

    const hasChanged = currentItemKeyRef.current !== key;
    currentItemKeyRef.current = key;

    if (hasChanged) {
      setViewState(createEmptyState());
    }

    try {
      const storedState = await loadPersistedState(key);

      if (!isMountedRef.current || currentItemKeyRef.current !== key) {
        return;
      }

      setViewState(storedState);
    } catch (error) {
      console.warn(`[Taskpane] Failed to load persisted state for key ${key}.`, error);

      if (isMountedRef.current && currentItemKeyRef.current === key) {
        setViewState(createEmptyState());
      }
    }
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;

    const initialize = async () => {
      await refreshFromCurrentItem();
      visibilityCleanupRef.current =
        await registerTaskpaneVisibilityHandler(refreshFromCurrentItem);
    };

    void initialize();

    const mailbox = Office.context.mailbox;
    const itemChangedHandler = () => {
      void refreshFromCurrentItem();
    };

    if (mailbox?.addHandlerAsync) {
      mailbox.addHandlerAsync(Office.EventType.ItemChanged, itemChangedHandler, (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          console.warn("[Taskpane] Failed to register ItemChanged handler.", result.error);
        }
      });
    }

    return () => {
      isMountedRef.current = false;

      if (visibilityCleanupRef.current) {
        void visibilityCleanupRef.current();
        visibilityCleanupRef.current = null;
      }

      if (mailbox?.removeHandlerAsync) {
        mailbox.removeHandlerAsync(
          Office.EventType.ItemChanged,
          { handler: itemChangedHandler },
          (result) => {
            if (result.status !== Office.AsyncResultStatus.Succeeded) {
              console.warn("[Taskpane] Failed to remove ItemChanged handler.", result.error);
            }
          }
        );
      }
    };
  }, [refreshFromCurrentItem]);

  const handleOptionalPromptChange = React.useCallback(
    (value: string) => {
      mergeState({ optionalPrompt: value });
    },
    [mergeState]
  );

  const handleOptionalPromptVisibilityChange = React.useCallback(
    (visible: boolean) => {
      mergeState({ isOptionalPromptVisible: visible });
    },
    [mergeState]
  );

  const handleSend = React.useCallback(async () => {
    mergeState({
      statusMessage: "Sending the current email content...",
      pipelineResponse: null,
    });

    try {
      const prompt = viewState.optionalPrompt.trim();
      const response = await sendText(prompt ? prompt : undefined);

      mergeState({
        statusMessage: "Email content sent to the server.",
        pipelineResponse: response,
      });
    } catch (error) {
      console.error(error);
      mergeState({
        statusMessage: "We couldn't send the email content. Please try again.",
      });
    }
  }, [mergeState, viewState.optionalPrompt]);

  return (
    <div className={styles.root}>
      <Header logo="assets/logo-filled.png" title={title} message="Welcome" />
      <TextInsertion
        optionalPrompt={viewState.optionalPrompt}
        onOptionalPromptChange={handleOptionalPromptChange}
        isOptionalPromptVisible={viewState.isOptionalPromptVisible}
        onOptionalPromptVisibilityChange={handleOptionalPromptVisibilityChange}
        statusMessage={viewState.statusMessage}
        pipelineResponse={viewState.pipelineResponse}
        onSend={handleSend}
      />
    </div>
  );
};

export default App;
