/* global Office */

import { convertPlainTextToHtml } from "./htmlFormatting";

export const insertResponseIntoBody = async (response: string): Promise<void> => {
  if (!response) {
    return;
  }

  const mailbox = Office?.context?.mailbox;
  const currentItem = mailbox?.item;
  const body = currentItem?.body as Office.Body | undefined;

  if (!body || typeof body.setSelectedDataAsync !== "function") {
    throw new Error(
      "The email body can't be updated from this context. Open a draft or reply and try again."
    );
  }

  const htmlContent = convertPlainTextToHtml(response);

  await new Promise<void>((resolve, reject) => {
    body.setSelectedDataAsync(
      htmlContent,
      { coercionType: Office.CoercionType.Html },
      (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(asyncResult.error);
        }
      }
    );
  });
};
