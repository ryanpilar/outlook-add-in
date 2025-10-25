import {ReactNode, useCallback, useEffect, useMemo, useState} from "react";
import {Badge, TabListProps, TabValue} from "@fluentui/react-components";

export interface UseTabsOptions {
    hasResponse: boolean;
    isOptionalPromptVisible: boolean;
    onOptionalPromptVisibilityChange: (visible: boolean) => void;
    responseBadgeClassName?: string;
    responseBadgeLabel?: string | null;
}

export interface UseTabsResult {
    selectedTab: TabValue;
    handleTabSelect: NonNullable<TabListProps["onTabSelect"]>;
    responseBadge: ReactNode;
}

export const useTabs = ({
    hasResponse,
    isOptionalPromptVisible,
    onOptionalPromptVisibilityChange,
    responseBadgeClassName,
    responseBadgeLabel,
}: UseTabsOptions): UseTabsResult => {
    const [selectedTab, setSelectedTab] = useState<TabValue>(() =>
        hasResponse ? "response" : "instruct"
    );

    useEffect(() => {
        setSelectedTab((current) => {
            if (hasResponse) {
                return "response";
            }

            if (current === "response") {
                return "instruct";
            }

            return current;
        });
    }, [hasResponse]);

    useEffect(() => {
        const shouldShowOptionalPrompt = selectedTab === "instruct";

        if (isOptionalPromptVisible !== shouldShowOptionalPrompt) {
            onOptionalPromptVisibilityChange(shouldShowOptionalPrompt);
        }
    }, [isOptionalPromptVisible, onOptionalPromptVisibilityChange, selectedTab]);

    const handleTabSelect = useCallback<NonNullable<TabListProps["onTabSelect"]>>(
        (_event, data) => {
            setSelectedTab(data.value);
        },
        []
    );

    const responseBadge = useMemo(() => {
        if (!responseBadgeLabel) {
            return null;
        }

        return (
            <Badge
                appearance="tint"
                shape="circular"
                color="success"
                className={responseBadgeClassName}
            >
                {responseBadgeLabel}
            </Badge>
        );
    }, [responseBadgeClassName, responseBadgeLabel]);

    return {
        selectedTab,
        handleTabSelect,
        responseBadge,
    };
};

export default useTabs;
