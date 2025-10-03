import * as React from "react";
import Header from "./Header";
import HeroList, {HeroListItem} from "./HeroList";
import TextInsertion from "./TextInsertion";
import {makeStyles} from "@fluentui/react-components";
import {Ribbon24Regular, LockOpen24Regular, DesignIdeas24Regular} from "@fluentui/react-icons";
import {sendText} from "../taskpane";

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

const App: React.FC<AppProps> = (props: AppProps) => {
    const styles = useStyles();


    return (
        <div className={styles.root}>
            <Header logo="assets/logo-filled.png" title={props.title} message="Welcome"/>
            <TextInsertion sendText={sendText}/>
        </div>
    );
};

export default App;
