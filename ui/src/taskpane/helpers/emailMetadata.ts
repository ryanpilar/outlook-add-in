import {sanitizeString} from "./sanitization";
import {
    getMailboxUserIdentity,
    isSenderCurrentUser,
    loadEmailAddressDetails,
    loadRecipientList,
    normalizeEmailAddressDetails,
} from "./emailAddress";

/**
 * Helpers for composing the metadata payload that accompanies outbound requests.
 *
 * Outlook’s object model is not always consistent: different fields may represent
 * the sender depending on the client (desktop vs web vs mobile), and in compose
 * mode some properties are asynchronous. These helpers normalize those differences
 * into a clean metadata envelope we can send to the server.
 */

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

/**
 * Outlook exposes subject in several ways and this helper checks each possibility
 * and normalizes the result:
 * - Direct string (`item.subject`)
 * - Async accessor in compose scenarios (`item.subject.getAsync`)
 * - Normalized subject field
 */

export const getSubjectLine = async (currentItem: any): Promise<string | null> => {
    const rawSubject = currentItem?.subject;

    // Case 1: direct string
    if (typeof rawSubject === "string") {
        return sanitizeString(rawSubject);
    }

    // Case 2: async accessor
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

    // Case 3: normalized subject field
    const normalizedSubject = sanitizeString((currentItem as any)?.normalizedSubject);

    if (normalizedSubject) {
        return normalizedSubject;
    }

    // Case 4: Nothing usable found
    return null;
};

/**
 * Identify the most likely external sender of the message.
 *
 * - Outlook may populate different fields (`from`, `sender`, `organizer`)
 *   depending on message type (received mail, meeting invite, etc).
 * - In some cases the "sender" could actually be the signed-in mailbox user
 *   (e.g. when replying, or in delegated mailboxes).
 * - For robustness, we walk through all possible candidates and fall back
 *   to recipients if Outlook doesn’t expose a clear sender.
 *
 * The goal is to always return the "real external sender" when possible,
 * excluding the signed-in mailbox owner.
 */
const findSenderMetadata = async (currentItem: any): Promise<BasicEmailMetadata["sender"]> => {
    const mailboxItem = Office.context.mailbox?.item as any;

    // Potential fields where Outlook may surface sender info
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

    // Try each candidate until we find a valid external sender
    for (const candidate of candidates) {
        if (!candidate || seen.has(candidate)) {
            continue; // skip duplicates and nulls
        }

        seen.add(candidate);

        const details = await loadEmailAddressDetails(candidate);
        const sanitized = normalizeEmailAddressDetails(details);

        // Accept the first valid sender that is not the signed-in user
        if (sanitized && !isSenderCurrentUser(sanitized, currentUser)) {
            return sanitized;
        }
    }

    // If no sender fields worked, inspect the "to" recipients instead.
    // In forwarded or system-generated emails, sometimes the recipient list is the only reliable way to infer the sender.
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
            // Create a deduplication key (email or displayName)
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
    // No suitable sender found
    return null;
};

/**
 * Includes subject, sender, and threading identifiers so the backend can correlate
 * without parsing the raw email body.
 */
export const buildEmailMetadata = async (): Promise<BasicEmailMetadata> => {
    const mailbox = Office.context.mailbox;
    const currentItem = mailbox?.item as any;

    // If nothing is selected, return an empty object so backend can merge defaults without errors
    if (!currentItem) {
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

export type {MailboxUserIdentity, SenderDetailsLike} from "./emailAddress";
