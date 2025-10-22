/**
 * ====================|| Operator Instruction Message ||====================
 *
 * Converts any operator-provided optional prompt into a developer message so
 * analysts can nudge the assistant for a single request without touching the
 * core prompt definition.
 */

export const buildOptionalOperatorInstructionBody = (optionalPrompt) => {
    if (typeof optionalPrompt !== 'string' || optionalPrompt.trim().length === 0) {
        return null;
    }

    return ['Additional operator instructions for this request:', optionalPrompt].join('\n\n');
};

export default {
    buildOptionalOperatorInstructionBody,
};
