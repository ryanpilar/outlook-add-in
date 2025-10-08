/* global Office */

/**
 * Retrieves the body of the current mailbox item as plain text.
 * Wraps the callback-based Office.js API in a promise so callers can use async/await.
 */
export function getPlainTextBody(): Promise<string> {
    return new Promise((resolve, reject) => {
        const mailbox = Office.context.mailbox;
        const currentItem = mailbox?.item;

        if (!currentItem) {
            reject(
                new Error(
                    "Unable to access the current mailbox item. Make sure the add-in is running in an Outlook item context."
                )
            );
            return;
        }

        currentItem.body.getAsync(Office.CoercionType.Text, (asyncResult: Office.AsyncResult<string>) => {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                resolve(asyncResult.value ?? "");
            } else {
                reject(asyncResult.error);
            }
        });
    });
}
