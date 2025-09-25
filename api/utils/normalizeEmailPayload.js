// Utility regular expressions for cleaning up Outlook- / Microsoft-generated noise.
// Zero-width characters such as U+200B (zero-width space) and U+FEFF (BOM) routinely
// slip into copied email bodies, so we strip them before handing content off to
// downstream services.
const INVISIBLE_MICROSOFT_CHARS = /[\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2060\uFEFF]/g;
// Outlook often relies on non-breaking spaces for layout; replacing them with normal
// spaces makes it easier for LLM prompts to treat them as word separators.
const NBSP_REGEX = /\u00A0/g;
// Collapse consecutive spaces and tabs so the prompt is easier to read. We leave two
// newlines intact because they communicate paragraph breaks.
const MULTI_SPACE_REGEX = /[ \t]{2,}/g;

// Generic string sanitizer that trims leading/trailing whitespace and normalizes
// empty strings to null so callers can easily test the presence of a value.
const sanitizeString = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
};

// Helper specifically for the sender object: we sanitize both the display name and
// the email address, lower-casing the latter so it can be matched reliably in search.
const sanitizeSender = (sender) => {
    if (!sender || typeof sender !== 'object') {
        return null;
    }

    const displayName = sanitizeString(sender.displayName);
    const emailAddressRaw = sanitizeString(sender.emailAddress);
    const emailAddress = emailAddressRaw ? emailAddressRaw.toLowerCase() : null;

    if (!displayName && !emailAddress) {
        return null;
    }

    return {
        displayName,
        emailAddress,
    };
};

// Microsoft properties frequently contain control characters or exotic whitespace.
// This helper strips those artifacts while preserving deliberate formatting such as
// paragraph breaks so we can hand OpenAI a clean, human-readable prompt.
const normalizeBodyText = (text) => {
    const sanitized = sanitizeString(text) ?? '';

    if (!sanitized) {
        return '';
    }

    return sanitized
        // First remove invisible control characters that contribute noise.
        .replace(INVISIBLE_MICROSOFT_CHARS, '')
        // Then replace non-breaking spaces with standard spaces.
        .replace(NBSP_REGEX, ' ')
        // Normalise Windows line endings to plain \n so downstream diffs are stable.
        .replace(/\r\n?/g, '\n')
        // Collapse sequences of spaces/tabs while leaving single spaces untouched.
        .replace(MULTI_SPACE_REGEX, ' ')
        // Finally, trim again in case the replacements introduced leading/trailing spaces.
        .trim();
};

const normalizeEmailPayload = (payload = {}) => {
    const { text, metadata } = payload;

    // Clean up the body so that downstream retrieval / generation services see a
    // consistent shape regardless of the odd characters Outlook occasionally emits.
    const normalizedBody = normalizeBodyText(text);

    // Pre-initialize the metadata structure so consumers can rely on the shape even
    // when the Outlook item does not expose particular fields (e.g., conversationId
    // for drafts).
    const normalizedMetadata = {
        subject: null,
        sender: null,
        conversationId: null,
        internetMessageId: null,
    };

    if (metadata && typeof metadata === 'object') {
        normalizedMetadata.subject = sanitizeString(metadata.subject);
        normalizedMetadata.sender = sanitizeSender(metadata.sender);
        normalizedMetadata.conversationId = sanitizeString(metadata.conversationId);
        normalizedMetadata.internetMessageId = sanitizeString(metadata.internetMessageId);
    }

    return {
        body: normalizedBody,
        metadata: normalizedMetadata,
    };
};

export default normalizeEmailPayload;

