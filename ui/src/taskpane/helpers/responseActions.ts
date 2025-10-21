import { copyTextToClipboard } from "./clipboard";
import { insertResponseIntoBody } from "./emailBodyInsertion";
import {describeError} from "./outlook-errorHandling";

export interface StatusResult {
  statusMessage: string;
}

const sanitizeResponse = (response: string): string => response.trim();

export const attemptToCopyResponse = async (response: string): Promise<StatusResult> => {
  const sanitized = sanitizeResponse(response);

  if (!sanitized) {
    return { statusMessage: "There isn't an email response to copy yet." };
  }

  try {
    await copyTextToClipboard(sanitized);
    return { statusMessage: "Email response copied to the clipboard." };
  } catch (error) {
    const description = describeError(error);
    return {
      statusMessage: description
        ? `We couldn't copy the email response automatically. Reason: ${description}`
        : "We couldn't copy the email response automatically. Please copy it manually.",
    };
  }
};

export const attemptToInsertResponse = async (response: string): Promise<StatusResult> => {
  const sanitized = sanitizeResponse(response);

  if (!sanitized) {
    return { statusMessage: "There isn't an email response to insert yet." };
  }

  try {
    await insertResponseIntoBody(sanitized);
    return { statusMessage: "Email response inserted into your draft." };
  } catch (error) {
    const description = describeError(error);
    return {
      statusMessage: description
        ? `We couldn't insert the email response. Reason: ${description}`
        : "We couldn't insert the email response. Please paste it manually.",
    };
  }
};
