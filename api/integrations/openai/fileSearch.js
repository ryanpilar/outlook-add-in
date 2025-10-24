/**
 * =============================|| OpenAI File Search Helpers ||=========================
 *
 * Collects the shared plumbing required to let the Responses API call File Search on our
 * behalf. Every request should follow the same flow:
 *   1. Check whether File Search is enabled for the environment.
 *   2. Resolve each vector store handle down to a concrete `vs_...` id (direct id,
 *      env configuration, or on-demand provisioning).
 *   3. Build the `tools` payload that the OpenAI SDK expects.
 * Centralizing these steps keeps the pipeline stages readable while making it obvious
 * which stores were attached when debugging Outlook runs.
 */

// Keep a process-level memo of any auto-provisioned stores to avoid redundant API calls.
const autoProvisionCache = new Map();

// Simple toggle that lets us flip File Search during experiments without redeploying.
export const isFileSearchEnabled = () => process.env.OPENAI_ENABLE_FILE_SEARCH === 'true';

// Normalizes anything that might be a vector store id into the canonical `vs_...` string.
const normalizeVectorStoreId = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
};

// Resolve the vector store id for a given handle so the Responses API knows where to search.
export const resolveVectorStoreId = async (client, handle = {}) => {
    if (!client || typeof client !== 'object') {
        throw new Error('OpenAI client instance is required to resolve vector stores.');
    }

    // First, honor an explicit id already attached to the handle.
    const directId = normalizeVectorStoreId(handle.vectorStoreId);

    if (directId) {
        return directId;
    }

    // Next, let environment configuration override the id so deployments can swap stores without code changes.
    const envKey = typeof handle.vectorStoreIdEnvKey === 'string'
        ? handle.vectorStoreIdEnvKey
        : null;

    if (envKey) {
        const envValue = normalizeVectorStoreId(process.env[envKey]);

        if (envValue) {
            return envValue;
        }
    }

    const provisionConfig = handle.autoProvision;

    if (!provisionConfig) {
        return null;
    }

    // Provisioning should only happen once per runtime; the cache protects us from creating duplicate stores when multiple requests target the same handle back-to-back.
    const cacheKey = handle.handle || provisionConfig.name;

    if (cacheKey && autoProvisionCache.has(cacheKey)) {
        return autoProvisionCache.get(cacheKey);
    }

    const fileIds = Array.isArray(provisionConfig.fileIds)
        ? provisionConfig.fileIds.filter((id) => normalizeVectorStoreId(id))
        : [];

    if (fileIds.length === 0) {
        return null;
    }

    const name = typeof provisionConfig.name === 'string' && provisionConfig.name.trim().length > 0
        ? provisionConfig.name.trim()
        : `peka-auto-store-${Date.now()}`;

    // Create a new vector store seeded with the provided files. Today we rely on manual uploads, but this hook keeps the door open for future automation.
    const createdStore = await client.vectorStores.create({
        name,
        file_ids: fileIds,
    });

    if (cacheKey) {
        autoProvisionCache.set(cacheKey, createdStore.id);
    }

    return createdStore.id;
};

// Translate a list of resolved vector store ids into the exact `tools` payload the Responses API needs. Returning `undefined` keeps calling code clean when no ids exist.
export const buildFileSearchToolsPayload = (vectorStoreIds = []) => {
    const uniqueIds = Array.from(
        new Set(
            vectorStoreIds
                .map((id) => normalizeVectorStoreId(id))
                .filter((id) => id !== null),
        ),
    );

    if (uniqueIds.length === 0) {
        return undefined;
    }

    return [
        {
            type: 'file_search',
            vector_store_ids: uniqueIds,
        },
    ];
};

export default {
    isFileSearchEnabled,
    resolveVectorStoreId,
    buildFileSearchToolsPayload,
};
