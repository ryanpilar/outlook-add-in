/* global document, navigator */

export const copyTextToClipboard = async (text: string): Promise<void> => {
  if (!text) {
    return;
  }

  let clipboardError: unknown = null;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  if (typeof document === "undefined") {
    if (clipboardError) {
      throw clipboardError;
    }

    throw new Error("Clipboard APIs are not available in this environment.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);

  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    const successful = document.execCommand("copy");

    if (!successful) {
      throw new Error("Copy command was rejected by the browser.");
    }
  } catch (error) {
    if (clipboardError) {
      throw clipboardError;
    }

    throw error;
  } finally {
    document.body.removeChild(textarea);
  }
};
