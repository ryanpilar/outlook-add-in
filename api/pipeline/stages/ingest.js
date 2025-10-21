/**
 * Pipeline Stage: Ingest
 * ---------------------------------------------------------------------------
 * "Ingest" is the preparation layer that happens before any live OpenAI calls.
 * It accepts raw submissions from the Outlook add-in, reshapes them into a
 * canonical envelope, and persists whatever background assets the runtime
 * pipeline will depend on. Concretely, the stage will:
 *
 * 1. Normalize the email body + metadata so every downstream controller receives
 *    predictable shapes regardless of quirks in the Office.js object model.
 *
 * 2. Catalog referenced knowledge sources by uploading files to OpenAI Vector Stores
 *    and maintaining a map of returned file IDs to human-friendly metadata for later
 *    citation rendering. This lets File Search retrieve from pre-indexed content
 *    without re-uploading per request.
 *          Vector Stores API: https://platform.openai.com/docs/api-reference/vector-stores
 *          File Search: https://platform.openai.com/docs/guides/tools-file-search
 *
 * 3. Record trace data (timestamps, request IDs, sender context) and persist the
 *    sanitized payload so that retrieval/generation can replay the submission
 *    reliably, even if subsequent stages are retried asynchronously. This also
 *    supports auditing of which documents and tool calls produced a given reply.
 *          Rate limits / ops: https://platform.openai.com/docs/guides/rate-limits
 */
import normalizeEmailPayload from '../../utils/normalizeEmailPayload.js';

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
