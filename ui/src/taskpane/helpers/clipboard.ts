
export const copyTextToClipboard = async (text: string, html?: string): Promise<void> => {
  if (!text) {
    return;
  }

  let clipboardError: unknown = null;

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
        return;
      } catch (error) {
        clipboardError = error;
      }
    }

    if (navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        clipboardError = error;
      }
    }
  }

  if (typeof document === "undefined") {
    if (clipboardError) {
      throw clipboardError;
    }

    throw new Error("Clipboard APIs are not available in this environment.");
  }

  const selection = document.getSelection();
  const originalRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;

  if (html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.setAttribute("contenteditable", "true");
    container.style.position = "fixed";
    container.style.pointerEvents = "none";
    container.style.opacity = "0";
    container.style.userSelect = "text";
    container.style.top = "0";
    container.style.left = "0";
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);

    selection?.removeAllRanges();
    selection?.addRange(range);

    try {
      const successful = document.execCommand("copy");

      if (!successful) {
        throw new Error("Copy command was rejected by the browser.");
      }

      return;
    } catch (error) {
      clipboardError = clipboardError ?? error;
    } finally {
      selection?.removeAllRanges();

      if (originalRange) {
        selection?.addRange(originalRange);
      }

      document.body.removeChild(container);
    }
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
    selection?.removeAllRanges();

    if (originalRange) {
      selection?.addRange(originalRange);
    }

    document.body.removeChild(textarea);
  }
};
