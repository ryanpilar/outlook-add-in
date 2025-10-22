/**
 * ==========================|| Prompt Wrapper Helpers ||==========================
 *
 * Acts as a slim façade that re-exports the detailed prompt content builders.
 * The heavy lifting now lives in the promptContent folder so this module reads
 * like a menu of available building blocks, keeping the higher-level wrappers
 * focused on orchestration instead of text plumbing.
 */

export {
    buildBaseSystemInstruction,
    buildDeveloperInstruction,
    buildVectorAssessmentText,
    buildVectorAssistantPlanText,
} from './promptContent/instructions.js';
export { buildUserInstruction } from './promptContent/userMessage.js';

import { buildVectorPassDeveloperMessageBodies } from './promptContent/developerMessages.js';
import { buildRetrievalContextBody } from './promptContent/retrievalContextMessage.js';
import { buildOptionalOperatorInstructionBody } from './promptContent/operatorInstructionMessage.js';
import { buildUserMessageBody } from './promptContent/userMessage.js';

/**
 * Wrap plain strings in the Responses API message format. Keeping these small
 * helpers inline makes the module read top-to-bottom without hopping across
 * additional files for the simplest plumbing.
 */
const createInputTextMessage = (role, text) => ({
    role,
    content: [
        {
            type: 'input_text',
            text,
        },
    ],
});

export const createSystemMessage = (text) => createInputTextMessage('system', text);

export const createDeveloperMessage = (text) => createInputTextMessage('developer', text);

export const createUserMessage = (text) => createInputTextMessage('user', text);

export const buildVectorPassDeveloperMessages = (options) =>
    buildVectorPassDeveloperMessageBodies(options).map((body) =>
        createDeveloperMessage(body)
    );

export const buildRetrievalContextMessage = (retrievalSummary) => {
    const body = buildRetrievalContextBody(retrievalSummary);
    return body ? createDeveloperMessage(body) : null;
};

export const buildOptionalOperatorInstructionMessage = (optionalPrompt) => {
    const body = buildOptionalOperatorInstructionBody(optionalPrompt);
    return body ? createDeveloperMessage(body) : null;
};

export const buildUserMessage = (normalizedEmail) =>
    createUserMessage(buildUserMessageBody(normalizedEmail));

