/**
 * ===============================|| Prompt Wrappers ||================================
 *
 * Collects helper functions that prepare reusable system/user messages while
 * delegating detailed text construction to the promptContent folder. This keeps
 * our service layers focused on transport concerns and gives us a single place
 * to evolve the instructions as new condo questions are added.
 */

import {
    createSystemMessage,
    createDeveloperMessage,
    buildBaseSystemInstruction,
    buildDeveloperInstruction,
    buildVectorPassDeveloperMessages,
    buildRetrievalContextMessage,
    buildOptionalOperatorInstructionMessage,
    buildUserMessage,
} from './promptWrapperHelpers.js';
import { getQuestionResponseSchema } from './questionResponseSchema.js';

export { getQuestionResponseSchema };

export const buildQuestionResponsePrompt = (normalizedEmail, options = {}) => {
    const generationMode =
        typeof options?.generationMode === 'string' ? options.generationMode : 'vector-only';
    const retrievalSummary = options?.retrievalSummary || null;
    const vectorAnswerMetadata = options?.vectorAnswerMetadata || null;
    const previousAssistantPlan = options?.previousAssistantPlan || null;
    const optionalPrompt =
        typeof normalizedEmail?.optionalPrompt === 'string'
            ? normalizedEmail.optionalPrompt
            : null;

    const messages = [
        createSystemMessage(buildBaseSystemInstruction()),
        createDeveloperMessage(buildDeveloperInstruction(generationMode)),
        ...buildVectorPassDeveloperMessages({
            generationMode,
            vectorAnswerMetadata,
            previousAssistantPlan,
        }),
    ];

    const retrievalContextMessage = buildRetrievalContextMessage(retrievalSummary);

    if (retrievalContextMessage) {
        messages.push(retrievalContextMessage);
    }

    const optionalInstructionMessage =
        buildOptionalOperatorInstructionMessage(optionalPrompt);

    if (optionalInstructionMessage) {
        messages.push(optionalInstructionMessage);
    }

    messages.push(buildUserMessage(normalizedEmail));

    return messages;
};

export default {
    getQuestionResponseSchema,
    buildQuestionResponsePrompt,
};
