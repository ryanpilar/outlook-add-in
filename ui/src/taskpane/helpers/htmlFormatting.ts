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
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const convertPlainTextToHtml = (text: string): string => {
  const escaped = encodeHtml(text);
  const withBreaks = escaped.replace(/\r\n|\r|\n/g, "<br />");
  return `<div>${withBreaks}</div>`;
};
