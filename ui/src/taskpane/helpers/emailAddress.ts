import {sanitizeString} from "./sanitization";

/**
 * Helpers for working with the inconsistent shapes of email address objects
 * that Outlook’s Office.js API exposes. These helpers normalize the data so metadata builders
 * can treat senders and recipients consistently.
 *
 * - A field may be a direct object, an array, or an async accessor.
 * - Different properties may hold similar data (`displayName`, `smtpAddress`, etc.).
 * - This normalization is helpful so downstream code can treat senders/recipients consistently
 *   without worrying about client/platform quirks.
 */

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

/**
 * Resolve an Office.js email address candidate into a concrete object.
 *
 * A candidate may already be a usable object, or it may expose `getAsync`.
 * This helper hides that distinction and always returns a normalized object.
 */

export const loadEmailAddressDetails = async (
    candidate: unknown
): Promise<SenderDetailsLike | null> => {
    if (!candidate || typeof candidate !== "object") {
        return null;
    }
    // Case 1: async accessor
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
    // Case 2: already an object
    return candidate as SenderDetailsLike;
};

/**
 * Normalize a field that might represent a single recipient, a list of recipients,
 * or an async accessor.
 */

export const loadRecipientList = async (candidate: unknown): Promise<SenderDetailsLike[]> => {
    if (!candidate) {
        return [];
    }
    // Case 1: already an array
    if (Array.isArray(candidate)) {
        return candidate as SenderDetailsLike[];
    }
    // Case 2: async accessor
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
    // Case 3: single object
    if (typeof candidate === "object") {
        return [candidate as SenderDetailsLike];
    }

    return [];
};

/**
 * Convert the loose SenderDetailsLike into a trimmed, lowercase format
 * that we transmit to the backend.
 *
 * - Null return means the address is effectively blank.
 * - Ensures consistent casing and avoids leaking unused fields.
 */

export const normalizeEmailAddressDetails = (
    details: SenderDetailsLike | null
): { displayName: string | null; emailAddress: string | null } | null => {
    if (!details || typeof details !== "object") {
        return null;
    }
    // Prefer displayName → name fallback
    const displayName = sanitizeString(details.displayName ?? details.name ?? null);
    // Prefer emailAddress → smtpAddress → address fallback
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

/**
 * Retrieve the current Outlook user’s identity. Used to avoid tagging the
 * signed-in mailbox owner as the sender when analyzing messages.
 */

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

/**
 * Determine if the supplied sender metadata matches the signed-in user.
 */

export const isSenderCurrentUser = (
    sender: { displayName: string | null; emailAddress: string | null } | null,
    currentUser: MailboxUserIdentity
): boolean => {
    if (!sender) {
        return false;
    }

    const normalizedSenderEmail = sender.emailAddress?.toLowerCase() ?? null;
    const normalizedSenderName = sender.displayName?.toLowerCase() ?? null;

    // Prefer comparing emails
    if (normalizedSenderEmail && currentUser.emailAddress) {
        return normalizedSenderEmail === currentUser.emailAddress;
    }

    // Fallback: compare display names
    if (normalizedSenderName && currentUser.displayName) {
        return normalizedSenderName === currentUser.displayName;
    }

    return false;
};
