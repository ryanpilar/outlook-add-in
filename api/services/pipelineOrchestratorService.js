/**
 * ==============================|| Pipeline Orchestrator Service ||==============================
 *
 * Centralizes the staged Ingest ➜ Retrieve ➜ Generate ➜ Verify pipeline so the controller layer
 * simply delegates orchestration to a single helper. This keeps the HTTP surface focused on
 * request/response handling while the heavy sequencing and logging logic can evolve in
 * isolation.
 */

import { ingestEmailSubmission } from '../http/controllers/ingestController.js';
import { retrieveContextForEmail } from '../http/controllers/retrieveController.js';
import { generateCandidateResponses } from '../http/controllers/generateController.js';
import { verifyCandidateResponses } from '../http/controllers/verifyController.js';

// NOTE: Implementation lifted verbatim from `logController.logText` prior to
// extraction. The only behavior change is returning the response payload to the
// caller instead of writing to the Express response object directly.
export const runPipelineForEmailSubmission = async (requestBody) => {
    console.info('🚦  Pipeline stage: Ingest ➜ queued');
    console.time('⏱️  Ingest stage duration');
    console.info('⏳  Waiting for ingest service to normalize payload…');
    const ingestResult = await ingestEmailSubmission(requestBody);
    console.timeEnd('⏱️  Ingest stage duration');
    console.info('✅  Ingest stage complete. Transitioning to retrieval…');

    const {
        body: normalizedBody,
        metadata: { subject, sender },
    } = ingestResult.normalizedEmail;

    const senderLabel = sender?.displayName || sender?.emailAddress || 'Unknown sender';
    const preview = normalizedBody.replace(/\s+/g, ' ').trim().slice(0, 200);

    console.info('📬  Email submission received from Outlook add-in');
    console.info(`     From   : ${senderLabel}`);
    console.info(`     Subject: ${subject || '(no subject)'}`);
    console.info(
        `     Preview: ${preview}${normalizedBody.length > 200 ? '…' : ''}`
    );

    if (ingestResult?.ingestTelemetry) {
        console.info('🧾  Ingest telemetry snapshot:');
        console.dir(ingestResult.ingestTelemetry, { depth: null });
    }

    if (Array.isArray(ingestResult?.vectorStoreIndex)) {
        console.info(
            `📚  Indexed vector store handles: ${ingestResult.vectorStoreIndex.length}`
        );
    }

    console.info('🚦  Pipeline stage: Retrieve ➜ queued');
    console.time('⏱️  Retrieval stage duration');
    console.info('⏳   Waiting on retrieval service to assemble context hints…');
    const retrievalPlan = await retrieveContextForEmail(ingestResult.normalizedEmail);
    console.timeEnd('⏱️  Retrieval stage duration');
    console.info('✅   Retrieval stage complete. Now waiting on, generation…');

    console.info('🧠  Retrieval plan hints:');
    console.dir(
        {
            vectorStoreHandles: retrievalPlan?.vectorStoreHandles || [],
            searchHints: retrievalPlan?.searchHints || {},
        },
        { depth: null }
    );

    console.info('🚦  Pipeline stage: Generate ➜ queued');
    console.time('⏱️  Generation stage duration');
    console.info('⏳  Waiting for generation service to draft assistant plan…');
    const generationPlan = await generateCandidateResponses(retrievalPlan);
    console.timeEnd('⏱️  Generation stage duration');
    console.info('✅  Generation stage complete. Transitioning to verification…');

    if (generationPlan?.questionPlan) {
        const { match, assistantPlan } = generationPlan.questionPlan;
        console.info('🤖  Question classification result:');
        console.dir(
            {
                isApprovedQuestion: match?.isApprovedQuestion || false,
                questionId: match?.questionId || null,
                matchedQuestions: match?.matchedQuestions || [],
                confidence: match?.confidence || null,
                reasoning: match?.reasoning || null,
                emailReply: assistantPlan?.emailReply || null,
                sourceCitations: assistantPlan?.sourceCitations || [],
            },
            { depth: null }
        );
    } else {
        console.info('🤖  Question classification result: unavailable');
    }

    console.info('🚦  Pipeline stage: Verify ➜ queued');
    console.time('⏱️  Verification stage duration');
    console.info('⏳  Waiting for verification service to review candidate plan…');
    const verificationPlan = await verifyCandidateResponses(generationPlan);
    console.timeEnd('⏱️  Verification stage duration');
    console.info('✅  Verification stage complete. Preparing Outlook response payload…');

    const questionPlan = verificationPlan?.questionPlan || null;
    const assistantPlan = questionPlan?.assistantPlan || null;

    const emailResponse = typeof assistantPlan?.emailReply === 'string'
        ? assistantPlan.emailReply
        : null;

    const sourceCitations = Array.isArray(assistantPlan?.sourceCitations)
        ? assistantPlan.sourceCitations.map((citation = {}) => ({
              url: typeof citation.url === 'string' ? citation.url : null,
              title: typeof citation.title === 'string' ? citation.title : null,
          }))
        : [];

    const responsePayload = {
        message: 'Pipeline scaffold executed',
        questionMatch: questionPlan?.match || null,
        assistantResponse: {
            emailResponse,
            sourceCitations,
        },
    };

    return responsePayload;
};

export default {
    runPipelineForEmailSubmission,
};
