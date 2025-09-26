/**
 * Ingest Controller
 * ---------------------------------------------------------------------------
 * In this architecture, "ingest" is the preparation layer that happens before
 * any live OpenAI calls. It accepts raw submissions from the Outlook add-in,
 * reshapes them into a canonical envelope, and persists whatever background
 * assets the runtime pipeline will depend on. Concretely, the stage will:
 *
 * 1. Normalize the email body + metadata so every downstream controller receives
 *    predictable shapes regardless of quirks in the Office.js object model.
 * 2. Catalog referenced knowledge sources by uploading files to OpenAI's vector
 *    store APIs (purpose=`assistants`) and maintaining a map of returned file
 *    IDs to human-friendly metadata for later citation rendering.
 * 3. Record trace data (timestamps, request IDs, sender context) and persist the
 *    sanitized payload so that retrieval/generation can replay the submission
 *    reliably, even if subsequent stages are retried asynchronously.
 *
 * The current scaffold focuses on normalization while leaving TODO markers for
 * vector-store upkeep and persistence. Future revisions will wire in the
 * OpenAI uploads, durable storage, and any pre-processing heuristics (entity
 * extraction, quick summaries) that can guide the Responses API.
 */
import normalizeEmailPayload from '../utils/normalizeEmailPayload.js';

export const ingestEmailSubmission = async (requestBody) => {
    const normalizedEmail = normalizeEmailPayload(requestBody);

    return {
        normalizedEmail,
        vectorStoreIndex: [],
        ingestTelemetry: {
            receivedAt: new Date().toISOString(),
            notes: 'Persist payload + sync vector store file mappings.',
        },
    };
};
