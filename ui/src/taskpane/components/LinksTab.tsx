import * as React from "react";
import {memo} from "react";
import {Button, Checkbox, Field} from "@fluentui/react-components";
import {Copy16Regular} from "@fluentui/react-icons";

import type {PipelineResponse} from "../taskpane";

export interface LinksTabProps {
    sourceCitations: PipelineResponse["assistantResponse"]["sourceCitations"];
    selectedCitationIndexes: number[];
    selectedLinksCount: number;
    onCitationSelectionChange: (index: number, isSelected: boolean) => void;
    onCopySelectedLinks: () => void;
    containerClassName: string;
    sectionClassName: string;
    fieldClassName: string;
    toolbarClassName: string;
    copyButtonClassName: string;
    listClassName: string;
    listItemClassName: string;
    anchorClassName: string;
    emptyMessageClassName: string;
}

const LinksTabComponent: React.FC<LinksTabProps> = ({
    sourceCitations,
    selectedCitationIndexes,
    selectedLinksCount,
    onCitationSelectionChange,
    onCopySelectedLinks,
    containerClassName,
    sectionClassName,
    fieldClassName,
    toolbarClassName,
    copyButtonClassName,
    listClassName,
    listItemClassName,
    anchorClassName,
    emptyMessageClassName,
}) => (
    <div className={containerClassName}>
        <div className={sectionClassName}>
            <Field className={fieldClassName}>
                {sourceCitations.length ? (
                    <div className={sectionClassName}>
                        <div className={toolbarClassName}>
                            <Button
                                appearance="secondary"
                                icon={<Copy16Regular/>}
                                size="medium"
                                onClick={() => {
                                    if (!selectedLinksCount) return;
                                    onCopySelectedLinks();
                                }}
                                className={copyButtonClassName}
                            >
                                {`Copy (${selectedLinksCount})`}
                            </Button>
                        </div>
                        <ul className={listClassName}>
                            {sourceCitations.map((citation, index) => {
                                const anchorId = `citation-link-${index}`;
                                const isSelected = selectedCitationIndexes.includes(index);

                                return (
                                    <li
                                        className={listItemClassName}
                                        key={`${citation?.url ?? "missing-url"}-${index}`}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={(_event, data) =>
                                                onCitationSelectionChange(index, Boolean(data?.checked))
                                            }
                                            aria-labelledby={anchorId}
                                        />
                                        <a
                                            id={anchorId}
                                            className={anchorClassName}
                                            href={citation?.url ?? undefined}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {citation?.title || citation?.url}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : (
                    <span className={emptyMessageClassName}>
                        No links available for this response yet.
                    </span>
                )}
            </Field>
        </div>
    </div>
);

export const LinksTab = memo(LinksTabComponent);

export default LinksTab;
