import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import TextInsertion from "./TextInsertion";
import { useTaskPaneController } from "../hooks/useTaskPaneController";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    height: "100vh",
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    overflow: "hidden",
  },
});

const App: React.FC<AppProps> = () => {
  const styles = useStyles();
  const { state, actions } = useTaskPaneController();

  return (
    <div className={styles.root}>
      {/*<Header logo="assets/logo-filled.png" title={title} message="Welcome" />*/}
      <div className={styles.content}>
        <TextInsertion
          optionalPrompt={state.optionalPrompt}
          onOptionalPromptChange={actions.updateOptionalPrompt}
          isOptionalPromptVisible={state.isOptionalPromptVisible}
          onOptionalPromptVisibilityChange={actions.setOptionalPromptVisible}
          statusMessage={state.statusMessage}
          pipelineResponse={state.pipelineResponse}
          responseHistory={state.responseHistory}
          activeResponseIndex={state.activeResponseIndex}
          onSend={actions.sendCurrentEmail}
          isSending={state.isSending}
          onCancel={actions.cancelCurrentSend}
          onCopyResponse={actions.copyResponseToClipboard}
          onInjectResponse={actions.injectResponseIntoEmail}
          onShowPreviousResponse={actions.showPreviousResponse}
          onShowNextResponse={actions.showNextResponse}
          onClear={actions.resetTaskPaneState}
        />
      </div>
    </div>
  );
};

export default App;
