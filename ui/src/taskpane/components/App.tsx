/* global Office, console */

import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import Header from "./Header";
import TextInsertion from "./TextInsertion";
import { useTaskPaneController } from "../hooks/useTaskPaneController";

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
  const { state, actions } = useTaskPaneController();

  return (
    <div className={styles.root}>
      <Header logo="assets/logo-filled.png" title={title} message="Welcome" />
      <TextInsertion
        optionalPrompt={state.optionalPrompt}
        onOptionalPromptChange={actions.updateOptionalPrompt}
        isOptionalPromptVisible={state.isOptionalPromptVisible}
        onOptionalPromptVisibilityChange={actions.setOptionalPromptVisible}
        statusMessage={state.statusMessage}
        pipelineResponse={state.pipelineResponse}
        onSend={actions.sendCurrentEmail}
        isSending={state.isSending}
      />
    </div>
  );
};

export default App;
