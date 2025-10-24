export const escapeHtml = (value: string): string =>
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

export const encodeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const normalizeLineEndings = (value: string): string => value.replace(/\r\n|\r/g, "\n");

const applyInlineFormatting = (value: string): string => {
    if (!value) {
        return "";
    }

    let formatted = encodeHtml(value);

    formatted = formatted.replace(/`([^`]+)`/g, (_match, code) => `<code>${code}</code>`);
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, (_match, text) => `<strong>${text}</strong>`);
    formatted = formatted.replace(/__(.+?)__/g, (_match, text) => `<strong>${text}</strong>`);
    formatted = formatted.replace(/\*(.+?)\*/g, (_match, text) => `<em>${text}</em>`);

    formatted = formatted.replace(/\[([^\]]+)]\(([^)]+)\)/g, (match, linkText, rawUrl) => {
        const trimmedUrl = rawUrl.trim();

        if (!/^https?:\/\//i.test(trimmedUrl)) {
            return linkText;
        }

        const safeUrl = encodeHtml(trimmedUrl);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    return formatted;
};

const wrapParagraph = (content: string): string => {
    if (!content) {
        return "";
    }

    const formatted = applyInlineFormatting(content).replace(/\n/g, "<br />");
    return `<p>${formatted}</p>`;
};

const flushList = (
    buffer: string[],
    type: "ul" | "ol"
): string => {
    if (buffer.length === 0) {
        return "";
    }

    const items = buffer
        .map((item) => `<li>${applyInlineFormatting(item)}</li>`)
        .join("");

    return `<${type}>${items}</${type}>`;
};

const convertMarkdownBlocks = (text: string): string => {
    const normalized = normalizeLineEndings(text);
    const lines = normalized.split("\n");

    const blocks: string[] = [];
    let paragraphLines: string[] = [];
    let listBuffer: string[] = [];
    let currentListType: "ul" | "ol" | null = null;

    const commitParagraph = () => {
        if (paragraphLines.length === 0) {
            return;
        }

        const paragraphText = paragraphLines.join("\n");
        const paragraphHtml = wrapParagraph(paragraphText);

        if (paragraphHtml) {
            blocks.push(paragraphHtml);
        }

        paragraphLines = [];
    };

    const commitList = () => {
        if (!currentListType) {
            return;
        }

        const listHtml = flushList(listBuffer, currentListType);

        if (listHtml) {
            blocks.push(listHtml);
        }

        listBuffer = [];
        currentListType = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            commitParagraph();
            commitList();
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

        if (headingMatch) {
            commitParagraph();
            commitList();

            const level = Math.min(headingMatch[1].length, 6);
            const headingContent = applyInlineFormatting(headingMatch[2]);
            blocks.push(`<h${level}>${headingContent}</h${level}>`);
            continue;
        }

        const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);

        if (unorderedMatch) {
            commitParagraph();

            if (currentListType !== "ul") {
                commitList();
                currentListType = "ul";
            }

            listBuffer.push(unorderedMatch[1]);
            continue;
        }

        const orderedMatch = line.match(/^(\d+)[.)]\s+(.*)$/);

        if (orderedMatch) {
            commitParagraph();

            if (currentListType !== "ol") {
                commitList();
                currentListType = "ol";
            }

            listBuffer.push(orderedMatch[2]);
            continue;
        }

        commitList();
        paragraphLines.push(line);
    }

    commitParagraph();
    commitList();

    return blocks.join("");
};

export const convertMarkdownToHtml = (text: string): string => {
    const trimmed = text.trim();

    if (!trimmed) {
        return "";
    }

    return convertMarkdownBlocks(trimmed);
};

export const convertMarkdownToHtmlDocument = (text: string): string => {
    const content = convertMarkdownToHtml(text);

    if (!content) {
        return "<div></div>";
    }

    return `<div>${content}</div>`;
};
