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
const getSubject = async (currentItem: any): Promise<string | null> => {
  const rawSubject = currentItem?.subject;

  if (typeof rawSubject === "string") {
    return sanitizeString(rawSubject);
  }

  if (
    rawSubject &&
    typeof rawSubject === "object" &&
    typeof (rawSubject as { getAsync?: unknown }).getAsync === "function"
  ) {
    return new Promise((resolve) => {
      const subjectField = rawSubject as {
        getAsync: (callback: (asyncResult: Office.AsyncResult<string>) => void) => void;
      };

      subjectField.getAsync((asyncResult: Office.AsyncResult<string>) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
          resolve(sanitizeString(asyncResult.value ?? null));
        } else {
          resolve(null);
        }
      });
    });
  }

  const normalizedSubject = sanitizeString((currentItem as any)?.normalizedSubject);

  if (normalizedSubject) {
    return normalizedSubject;
  }

  return null;
};

type SenderDetailsLike = {
  displayName?: string | null;
  emailAddress?: string | null;
  name?: string | null;
  smtpAddress?: string | null;
  address?: string | null;
};

type AsyncEmailAccessor = {
  getAsync: (
    callback: (asyncResult: Office.AsyncResult<Office.EmailAddressDetails>) => void
  ) => void;
};

const isAsyncEmailAccessor = (value: unknown): value is AsyncEmailAccessor =>
  !!value &&
  typeof value === "object" &&
  typeof (value as AsyncEmailAccessor).getAsync === "function";

const resolveSenderDetails = async (candidate: unknown): Promise<SenderDetailsLike | null> => {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  if (isAsyncEmailAccessor(candidate)) {
    return new Promise((resolve) => {
      candidate.getAsync((asyncResult: Office.AsyncResult<Office.EmailAddressDetails>) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded && asyncResult.value) {
          resolve(asyncResult.value as SenderDetailsLike);
        } else {
          resolve(null);
        }
      });
    });
  }

  return candidate as SenderDetailsLike;
};

const sanitizeSenderDetails = (details: SenderDetailsLike | null): BasicEmailMetadata["sender"] => {
  if (!details || typeof details !== "object") {
    return null;
  }

  const displayName = sanitizeString(details.displayName ?? details.name ?? null);
  const rawEmail =
    sanitizeString(details.emailAddress ?? null) ??
    sanitizeString(details.smtpAddress ?? null) ??
    sanitizeString(details.address ?? null);
  const emailAddress = rawEmail ? rawEmail.toLowerCase() : null;

  if (!displayName && !emailAddress) {
    return null;
  }

  return {
    displayName,
    emailAddress,
  };
};

const collectSender = async (currentItem: any): Promise<BasicEmailMetadata["sender"]> => {
  const candidates = [currentItem?.from, currentItem?.sender, currentItem?.organizer];

  for (const candidate of candidates) {
    const details = await resolveSenderDetails(candidate);
    const sanitized = sanitizeSenderDetails(details);

    if (sanitized) {
      return sanitized;
    }
  }

  return null;
};

const collectEmailMetadata = async (): Promise<BasicEmailMetadata> => {
  const mailbox = Office.context.mailbox;
  const currentItem = mailbox?.item as any;

  if (!currentItem) {
    // Returning an empty object allows the server to safely merge defaults without
    // special-casing undefined metadata.
    return {};
  }

  const subject = await getSubject(currentItem);
  const conversationId = sanitizeString(currentItem.conversationId);
  const internetMessageId = sanitizeString(currentItem.internetMessageId);

  const sender = await collectSender(currentItem);

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
    const metadata = await collectEmailMetadata();

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
