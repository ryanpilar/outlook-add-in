/**
 * ====================|| Message Operator Instruction ||====================
 *
 * Converts any operator-provided optional prompt into a developer message so
 * analysts can nudge the assistant for a single request without touching the
 * core prompt definition.
 */

export const buildOptionalMessageOperatorInstructionBody = (optionalPrompt) => {
    if (typeof optionalPrompt !== 'string') {
        return null;
    }

    const trimmedPrompt = optionalPrompt.trim();

    if (trimmedPrompt.length === 0) {
        return null;
    }

    return [
        'Additional operator instructions for this request (mandatory – treat each item as a hard requirement):',
        trimmedPrompt,
        'If any portion of these operator instructions cannot be satisfied with the available condo knowledge, you must set responseMetadata.vectorAnswer.isVectorAnswerSufficient to false and clearly describe the missing operator requirement in responseMetadata.vectorAnswer.missingInformationNotes so a follow-up pass can address it.',
    ].join('\n\n');
};

export default {
    buildOptionalMessageOperatorInstructionBody,
};
