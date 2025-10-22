/**
 * ========================|| User Message Builder ||========================
 *
 * Shapes the normalized resident email into the user-role message presented to
 * the model. Keeping the builder close to the other prompt content utilities
 * keeps promptWrapperHelpers focused on orchestration.
 */

const buildEmailHeaderBlock = (normalizedEmail) => {
    const subject = normalizedEmail?.metadata?.subject;
    const senderName = normalizedEmail?.metadata?.sender?.displayName;
    const senderEmail = normalizedEmail?.metadata?.sender?.emailAddress;

    const headerLines = [];

    if (subject) {
        headerLines.push(`Subject: ${subject}`);
    }

    if (senderName || senderEmail) {
        const senderLabel = [senderName, senderEmail].filter(Boolean).join(' <');
        headerLines.push(`From: ${senderLabel}${senderEmail && senderName ? '>' : ''}`);
    }

    return headerLines.length > 0 ? `${headerLines.join('\n')}\n\n` : '';
};

export const buildUserInstruction = (normalizedEmail) =>
    [
        'Resident email (plain text):',
        '---',
        `${buildEmailHeaderBlock(normalizedEmail)}${normalizedEmail?.body || '(no body provided)'}`,
        '---',
    ].join('\n');

export const buildUserMessageBody = (normalizedEmail) => buildUserInstruction(normalizedEmail);

export default {
    buildUserInstruction,
    buildUserMessageBody,
};
