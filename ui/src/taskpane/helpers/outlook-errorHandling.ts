import { MAX_SEND_OPERATION_RETRIES } from "./outlook-runtimeLogic";

export const describeError = (error: unknown): string => {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message || error.name || "";
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (serializationError) {
    console.debug("[Taskpane] Failed to serialize error payload.", serializationError);
    return String(error);
  }
};

export const isRetryableNetworkError = (error: unknown): boolean => {
  const candidateName = (error as { name?: string } | null)?.name?.toLowerCase() ?? "";

  if (candidateName.includes("network") || candidateName.includes("abort")) {
    return true;
  }

  const message = describeError(error).toLowerCase();

  if (!message) {
    return false;
  }

  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("connection was aborted")
  );
};

export const isAbortError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const candidateName = (error as { name?: string } | null)?.name?.toLowerCase() ?? "";

  if (candidateName.includes("abort")) {
    return true;
  }

  const description = describeError(error).toLowerCase();

  if (!description) {
    return false;
  }

  return description.includes("abort") || description.includes("cancel");
};

export const formatRetryStatusMessage = (attempt: number, delayMs: number): string => {
  const seconds = Math.ceil(delayMs / 1000);
  const pluralSuffix = seconds === 1 ? "" : "s";

  return `Connection interrupted. Retrying (attempt ${attempt} of ${MAX_SEND_OPERATION_RETRIES}) in ${seconds} second${pluralSuffix}...`;
};
