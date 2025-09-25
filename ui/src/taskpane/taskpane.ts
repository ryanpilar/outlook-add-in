/* global console, Office, fetch */

export async function sendText(): Promise<void> {
  // The Outlook item that is currently being viewed is available via Office.js.
  // We wrap the callback-based body.getAsync API in a Promise so it plays nicely with async/await.
  const getBodyText = (): Promise<string> =>
    new Promise((resolve, reject) => {
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

      currentItem.body.getAsync(
        Office.CoercionType.Text,
        (asyncResult: Office.AsyncResult<string>) => {
          if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
            resolve(asyncResult.value ?? "");
          } else {
            reject(asyncResult.error);
          }
        }
      );
    });

  try {
    // Retrieve the body of the current email as plain text.
    const bodyText = await getBodyText();

    // Post the email content to the local development server for logging.
    await fetch(`http://localhost:4000/log-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: bodyText }),
    });
    // await fetch(`https://outlook-add-in-kdr8.onrender.com/log-text`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ text: bodyText }),
    // });
  } catch (error) {
    console.log("Error: " + error);
    throw error;
  }
}
