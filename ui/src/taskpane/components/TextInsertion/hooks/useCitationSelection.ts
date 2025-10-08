/* global console */
import { useCallback, useEffect, useState } from "react";

import { copyTextToClipboard } from "../../../helpers/clipboard";
import { UseTextInsertionToastsReturn } from "../../../hooks/useTextInsertionToasts";
import { PipelineResponse } from "../../../taskpane";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });

interface UseCitationSelectionOptions {
  pipelineResponse: PipelineResponse | null;
  sourceCitations: PipelineResponse["assistantResponse"]["sourceCitations"];
  showErrorToast: UseTextInsertionToastsReturn["showErrorToast"];
  showSuccessToast: UseTextInsertionToastsReturn["showSuccessToast"];
}

export const useCitationSelection = ({
  pipelineResponse,
  sourceCitations,
  showErrorToast,
  showSuccessToast,
}: UseCitationSelectionOptions) => {
  const [selectedCitationIndexes, setSelectedCitationIndexes] = useState<number[]>([]);

  const selectedLinksCount = selectedCitationIndexes.length;

  useEffect(() => {
    setSelectedCitationIndexes((current) =>
      current.filter((index) => index < sourceCitations.length)
    );
  }, [sourceCitations.length]);

  useEffect(() => {
    setSelectedCitationIndexes([]);
  }, [pipelineResponse]);

  const handleCitationSelectionChange = useCallback((index: number, isSelected: boolean) => {
    setSelectedCitationIndexes((current) => {
      if (isSelected) {
        if (current.includes(index)) {
          return current;
        }

        return [...current, index].sort((a, b) => a - b);
      }

      return current.filter((value) => value !== index);
    });
  }, []);

  const handleCopySelectedLinks = useCallback(async () => {
    if (!selectedLinksCount) {
      return;
    }

    const selectedLinks = selectedCitationIndexes
      .map((citationIndex) => sourceCitations[citationIndex])
      .filter((citation) => Boolean(citation?.url));

    if (!selectedLinks.length) {
      showErrorToast("Nothing to copy", "Select at least one link first.");
      return;
    }

    const textToCopy = selectedLinks
      .map((citation) => {
        const url = citation?.url ?? "";
        const title = citation?.title?.trim();

        if (title && title !== url) {
          return `${title} - ${url}`;
        }

        return url;
      })
      .join("\n");

    const htmlToCopy = selectedLinks
      .map((citation) => {
        const url = citation?.url ?? "";
        const title = citation?.title?.trim() || url;

        if (!url) {
          return escapeHtml(title);
        }

        return `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`;
      })
      .join("<br />");

    try {
      await copyTextToClipboard(textToCopy, htmlToCopy);
      showSuccessToast(
        selectedLinks.length === 1 ? "Link copied to clipboard" : "Links copied to clipboard",
        selectedLinks.length === 1
          ? "The selected link is ready to paste."
          : `${selectedLinks.length} links are ready to paste.`
      );
    } catch (error) {
      console.error(error);
      showErrorToast("Unable to copy links", "Check your clipboard permissions and try again.");
    }
  }, [
    selectedCitationIndexes,
    selectedLinksCount,
    showErrorToast,
    showSuccessToast,
    sourceCitations,
  ]);

  return {
    selectedCitationIndexes,
    selectedLinksCount,
    handleCitationSelectionChange,
    handleCopySelectedLinks,
  };
};

export type UseCitationSelectionReturn = ReturnType<typeof useCitationSelection>;
