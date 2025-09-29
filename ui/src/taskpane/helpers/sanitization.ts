// Mirrors the server-side sanitizer so that we only send meaningful values across
// the wire. Returning null instead of "" makes it obvious when a field is absent.
export const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
