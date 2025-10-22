/**
 * Pipeline Orchestrator
 * ---------------------------------------------------------------------------
 * Coordinates the staged Ingest ➜ Retrieve ➜ Generate ➜ Verify flow. Consolidating
 * the runtime logic here keeps HTTP controllers lightweight while making the
 * core hand-offs trivial to trace during development or debugging sessions.
 */

import { ingestEmailSubmission } from './stages/ingest.js';
import { retrieveContextForEmail } from './stages/retrieve.js';
import { generateCandidateResponses } from './stages/generate.js';
import { verifyCandidateResponses } from './stages/verify.js';
import {
    runStageWithLogging,
    logEmailIntakeDetails,
    logRetrievalPlanSummary,
    logGenerationInsights,
} from './logging.js';

export const runPipeline = async (submission) => {
    // -------------------- Stage: Ingest ---------------------- //
    const ingestResult = await runStageWithLogging('ingest', () =>
        ingestEmailSubmission(submission)
    );

    logEmailIntakeDetails(ingestResult.normalizedEmail, ingestResult);

    // -------------------- Stage: Retrieve -------------------- //
    const retrievalPlan = await runStageWithLogging('retrieve', () =>
        retrieveContextForEmail(ingestResult.normalizedEmail)
    );

    logRetrievalPlanSummary(retrievalPlan);

    // -------------------- Stage: Generate -------------------- //
    const generationPlan = await runStageWithLogging('generate', () =>
        generateCandidateResponses(retrievalPlan)
    );

    logGenerationInsights(generationPlan?.questionPlan);

    // -------------------- Stage: Verify ---------------------- //
    const verificationPlan = await runStageWithLogging('verify', () =>
        verifyCandidateResponses(generationPlan)
    );

    // -------------------- Response Assembly ------------------ //
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

    return {
        responsePayload,
        stageResults: {
            ingest: ingestResult,
            retrieve: retrievalPlan,
            generate: generationPlan,
            verify: verificationPlan,
        },
    };
};

export default {
    runPipeline,
};
