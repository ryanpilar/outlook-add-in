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
    buildVectorPassMessagesDeveloper,
    buildMessageRetrievalContext,
    buildOptionalMessageOperatorInstruction,
    buildMessageUser,
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
        ...buildVectorPassMessagesDeveloper({
            generationMode,
            vectorAnswerMetadata,
            previousAssistantPlan,
        }),
    ];

    const messageRetrievalContext = buildMessageRetrievalContext(retrievalSummary);

    if (messageRetrievalContext) {
        messages.push(messageRetrievalContext);
    }

    const messageOperatorInstruction =
        buildOptionalMessageOperatorInstruction(optionalPrompt);

    if (messageOperatorInstruction) {
        messages.push(messageOperatorInstruction);
    }

    messages.push(buildMessageUser(normalizedEmail));

    return messages;
};

export default {
    getQuestionResponseSchema,
    buildQuestionResponsePrompt,
};
