import { sanitizeString } from "./sanitization";
import {
  getMailboxUserIdentity,
  isSenderCurrentUser,
  loadEmailAddressDetails,
  loadRecipientList,
  normalizeEmailAddressDetails,
} from "./emailAddress";

// Helpers responsible for composing the metadata payload that accompanies
// outbound requests. These functions intentionally avoid any UI-specific
// dependencies so they can be reused from tests or other command surfaces.

type AsyncSubjectAccessor = {
  getAsync: (callback: (asyncResult: Office.AsyncResult<string>) => void) => void;
};

const isAsyncSubjectAccessor = (value: unknown): value is AsyncSubjectAccessor =>
  !!value &&
  typeof value === "object" &&
  typeof (value as AsyncSubjectAccessor).getAsync === "function";

export type BasicEmailMetadata = {
  subject?: string | null;
  sender?: {
    displayName?: string | null;
    emailAddress?: string | null;
  } | null;
  conversationId?: string | null;
  internetMessageId?: string | null;
};

// Collect a minimal metadata envelope (subject, sender, threading identifiers) that
// is useful both for retrieval ranking and for threading responses later on.
export const getSubjectLine = async (currentItem: any): Promise<string | null> => {
  const rawSubject = currentItem?.subject;

  if (typeof rawSubject === "string") {
    return sanitizeString(rawSubject);
  }

  if (isAsyncSubjectAccessor(rawSubject)) {
    return new Promise((resolve) => {
      const subjectField = rawSubject as AsyncSubjectAccessor;

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

// Walk through potential sender fields and fall back to recipients to identify the
// most likely external sender (excluding the signed-in mailbox owner).
const findSenderMetadata = async (currentItem: any): Promise<BasicEmailMetadata["sender"]> => {
  const mailboxItem = Office.context.mailbox?.item as any;

  const candidates: unknown[] = [
    mailboxItem?.from,
    currentItem?.from,
    mailboxItem?.organizer,
    currentItem?.organizer,
    mailboxItem?.sender,
    currentItem?.sender,
  ];
  const seen = new Set<unknown>();
  const currentUser = getMailboxUserIdentity();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);

    const details = await loadEmailAddressDetails(candidate);
    const sanitized = normalizeEmailAddressDetails(details);

    if (sanitized && !isSenderCurrentUser(sanitized, currentUser)) {
      return sanitized;
    }
  }

  const recipientGroups = await Promise.all([
    loadRecipientList(mailboxItem?.to),
    loadRecipientList(currentItem?.to),
  ]);

  const seenRecipients = new Set<string>();

  for (const group of recipientGroups) {
    for (const recipient of group) {
      const sanitized = normalizeEmailAddressDetails(recipient);

      if (!sanitized) {
        continue;
      }

      const identifier =
        sanitized.emailAddress?.toLowerCase() ?? sanitized.displayName?.toLowerCase();

      if (!identifier || seenRecipients.has(identifier)) {
        continue;
      }

      seenRecipients.add(identifier);

      if (!isSenderCurrentUser(sanitized, currentUser)) {
        return sanitized;
      }
    }
  }

  return null;
};

// Build a lightweight envelope of metadata that accompanies the email body when
// sending data to the backend. The envelope includes basic threading identifiers
// and sender information so the server can correlate messages.
export const buildEmailMetadata = async (): Promise<BasicEmailMetadata> => {
  const mailbox = Office.context.mailbox;
  const currentItem = mailbox?.item as any;

  if (!currentItem) {
    // Returning an empty object allows the server to safely merge defaults without
    // special-casing undefined metadata.
    return {};
  }

  const subject = await getSubjectLine(currentItem);
  const conversationId = sanitizeString(currentItem.conversationId);
  const internetMessageId = sanitizeString(currentItem.internetMessageId);

  const sender = await findSenderMetadata(currentItem);

  return {
    subject,
    sender,
    conversationId,
    internetMessageId,
  };
};

export type { MailboxUserIdentity, SenderDetailsLike } from "./emailAddress";
