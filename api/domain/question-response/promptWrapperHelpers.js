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
export { buildMessageUserInstruction } from './promptContent/messageUser.js';

import { buildVectorPassMessagesDeveloperBodies } from './promptContent/messagesDeveloper.js';
import { buildMessageRetrievalContextBody } from './promptContent/messageRetrievalContext.js';
import { buildOptionalMessageOperatorInstructionBody } from './promptContent/messageOperatorInstruction.js';
import { buildMessageUserBody } from './promptContent/messageUser.js';

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

export const buildVectorPassMessagesDeveloper = (options) =>
    buildVectorPassMessagesDeveloperBodies(options).map((body) =>
        createDeveloperMessage(body)
    );

export const buildMessageRetrievalContext = (retrievalSummary) => {
    const body = buildMessageRetrievalContextBody(retrievalSummary);
    return body ? createDeveloperMessage(body) : null;
};

export const buildOptionalMessageOperatorInstruction = (optionalPrompt) => {
    const body = buildOptionalMessageOperatorInstructionBody(optionalPrompt);
    return body ? createDeveloperMessage(body) : null;
};

export const buildMessageUser = (normalizedEmail) =>
    createUserMessage(buildMessageUserBody(normalizedEmail));

