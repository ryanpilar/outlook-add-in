import { sanitizeString } from "./sanitization";

// Utility helpers for working with the varying shapes of email address objects
// that Office.js exposes. These helpers normalize the data so metadata builders
// can treat senders and recipients consistently.

export type SenderDetailsLike = {
  displayName?: string | null;
  emailAddress?: string | null;
  name?: string | null;
  smtpAddress?: string | null;
  address?: string | null;
};

export type AsyncEmailAccessor = {
  getAsync: (
    callback: (asyncResult: Office.AsyncResult<Office.EmailAddressDetails>) => void
  ) => void;
};

const isAsyncEmailAccessor = (value: unknown): value is AsyncEmailAccessor =>
  !!value &&
  typeof value === "object" &&
  typeof (value as AsyncEmailAccessor).getAsync === "function";

export type AsyncRecipientAccessor = {
  getAsync: (
    callback: (asyncResult: Office.AsyncResult<Office.EmailAddressDetails[]>) => void
  ) => void;
};

const isAsyncRecipientAccessor = (value: unknown): value is AsyncRecipientAccessor =>
  !!value &&
  typeof value === "object" &&
  typeof (value as AsyncRecipientAccessor).getAsync === "function";

// Attempt to resolve an Office.js email address accessor into a concrete object.
// Some fields expose a direct object while others expose an async getAsync API.
export const loadEmailAddressDetails = async (
  candidate: unknown
): Promise<SenderDetailsLike | null> => {
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

// Normalize a field that might represent a single recipient, a list, or an async accessor.
export const loadRecipientList = async (candidate: unknown): Promise<SenderDetailsLike[]> => {
  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate)) {
    return candidate as SenderDetailsLike[];
  }

  if (isAsyncRecipientAccessor(candidate)) {
    return new Promise((resolve) => {
      candidate.getAsync((asyncResult: Office.AsyncResult<Office.EmailAddressDetails[]>) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded && Array.isArray(asyncResult.value)) {
          resolve(asyncResult.value as SenderDetailsLike[]);
        } else {
          resolve([]);
        }
      });
    });
  }

  if (typeof candidate === "object") {
    return [candidate as SenderDetailsLike];
  }

  return [];
};

// Convert the relaxed SenderDetailsLike shape into the trimmed, lowercase values
// we transmit to the server. Returning null indicates the address is effectively blank.
export const normalizeEmailAddressDetails = (
  details: SenderDetailsLike | null
): { displayName: string | null; emailAddress: string | null } | null => {
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

export type MailboxUserIdentity = { displayName: string | null; emailAddress: string | null };

// Retrieve the current Outlook user's identity so we can avoid tagging them as the sender.
export const getMailboxUserIdentity = (): MailboxUserIdentity => {
  const mailbox = Office.context.mailbox;
  const profile = mailbox?.userProfile;

  const displayName = sanitizeString(profile?.displayName ?? null);
  const emailAddress = sanitizeString(profile?.emailAddress ?? null);

  return {
    displayName: displayName ? displayName.toLowerCase() : null,
    emailAddress: emailAddress ? emailAddress.toLowerCase() : null,
  };
};

// Determine if the supplied sender metadata matches the signed-in user.
export const isSenderCurrentUser = (
  sender: { displayName: string | null; emailAddress: string | null } | null,
  currentUser: MailboxUserIdentity
): boolean => {
  if (!sender) {
    return false;
  }

  const normalizedSenderEmail = sender.emailAddress?.toLowerCase() ?? null;
  const normalizedSenderName = sender.displayName?.toLowerCase() ?? null;

  if (normalizedSenderEmail && currentUser.emailAddress) {
    return normalizedSenderEmail === currentUser.emailAddress;
  }

  if (normalizedSenderName && currentUser.displayName) {
    return normalizedSenderName === currentUser.displayName;
  }

  return false;
};
