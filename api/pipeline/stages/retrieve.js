/**
 * Pipeline Stage: Retrieve
 * ---------------------------------------------------------------------------
 * Assembles the retrieval plan that the generation stage hands to OpenAI. We
 * pick the vector stores that match our approved questions, derive light-touch
 * hints from the email, and capture enough diagnostics to debug File Search
 * runs without dumping resident messages into the logs.
 */
import { selectKnowledgeBasesForEmail } from '../../domain/knowledge-base/service.js';
import { APPROVED_QUESTIONS } from '../../domain/question-response/approvedQuestions.js';

const DEBUG_LOGS_ENABLED = process.env.PIPELINE_DEBUG_LOGS === 'true';

const getSenderDomain = (normalizedEmail) => {
    const senderEmail = normalizedEmail?.metadata?.sender?.emailAddress;

    if (typeof senderEmail !== 'string') {
        return null;
    }

    const atIndex = senderEmail.indexOf('@');

    if (atIndex === -1 || atIndex === senderEmail.length - 1) {
        return null;
    }

    return senderEmail.slice(atIndex + 1);
};

export const retrieveContextForEmail = async (normalizedEmail) => {
    const normalizedBody = typeof normalizedEmail?.body === 'string' ? normalizedEmail.body : '';
    // Capture a short body preview so the prompt can reference the gist without pulling full text into logs.
    const summaryText = normalizedBody
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
    // Capture the sender's domain—handy heuristic for routing to the right condo corp materials.
    const senderDomain = getSenderDomain(normalizedEmail);

    const allowedQuestionIds = APPROVED_QUESTIONS.map((question) => question.id);
    const knowledgeBases = selectKnowledgeBasesForEmail(normalizedEmail, { allowedQuestionIds });

    // Surface retrieval diagnostics when PIPELINE_DEBUG_LOGS=true so manual runs show the chosen hints and stores.
    if (DEBUG_LOGS_ENABLED) {
        console.log('[retrieve] Prepared search hints for email', {
            senderDomain,
            summaryPreview: summaryText,
            knowledgeBaseHandles: knowledgeBases.map((kb) => kb.handle),
        });
        console.log('[retrieve] File contexts attached', knowledgeBases.map((kb) => ({
            handle: kb.handle,
            vectorStoreId: kb.vectorStoreId,
            fileContexts: (kb.fileContexts || []).map((context) => ({
                title: context.title,
                url: context.url,
                questionIds: context.questionIds,
            })),
        })));
    }

    return {
        vectorStoreHandles: knowledgeBases,
        searchHints: {
            senderDomain,
            summary: summaryText.length > 0 ? summaryText : null,
        },
        retrievalNotes: [
            'Select appropriate vector stores / file sets based on metadata.',
            'Inject lexical + semantic hints to guide OpenAI file_search.',
            'Record observability data for downstream generation + verification.',
            'Knowledge bases chosen via domain/knowledge-base service.',
        ],
        sourceEmail: normalizedEmail,
    };
};
