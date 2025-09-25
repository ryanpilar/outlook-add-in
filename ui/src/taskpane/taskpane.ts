/* global console, Office, fetch */

type BasicEmailMetadata = {
  subject?: string | null;
  sender?: {
    displayName?: string | null;
    emailAddress?: string | null;
  } | null;
  conversationId?: string | null;
  internetMessageId?: string | null;
};

// Mirrors the server-side sanitizer so that we only send meaningful values across
// the wire. Returning null instead of "" makes it obvious when a field is absent.
const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Collect a minimal metadata envelope (subject, sender, threading identifiers) that
// is useful both for retrieval ranking and for threading responses later on.
const collectEmailMetadata = (): BasicEmailMetadata => {
  const mailbox = Office.context.mailbox;
  const currentItem = mailbox?.item as any;

  if (!currentItem) {
    // Returning an empty object allows the server to safely merge defaults without
    // special-casing undefined metadata.
    return {};
  }

  const subject = sanitizeString(currentItem.subject);
  const conversationId = sanitizeString(currentItem.conversationId);
  const internetMessageId = sanitizeString(currentItem.internetMessageId);

  // Depending on the Outlook surface, sender info may live on either `from` or `sender`.
  const potentialSender = currentItem.from ?? currentItem.sender ?? null;
  let sender: BasicEmailMetadata["sender"] = null;

  if (potentialSender && typeof potentialSender === "object") {
    const displayName = sanitizeString((potentialSender as any).displayName);
    const emailAddressRaw = sanitizeString((potentialSender as any).emailAddress);
    const emailAddress = emailAddressRaw ? emailAddressRaw.toLowerCase() : null;

    if (displayName || emailAddress) {
      // Only include the sender object when we have at least one useful attribute.
      sender = {
        displayName,
        emailAddress,
      };
    }
  }

  return {
    subject,
    sender,
    conversationId,
    internetMessageId,
  };
};

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
    const metadata = collectEmailMetadata();

    // Post the email content to the local development server for logging.
    await fetch(`http://localhost:4000/log-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: bodyText, metadata }),
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
