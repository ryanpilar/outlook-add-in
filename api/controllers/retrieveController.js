/**
 * Retrieve Controller
 * ---------------------------------------------------------------------------
 * Because OpenAI's Responses API can invoke File Search on our behalf, the
 * runtime "retrieve" stage is chiefly about assembling the inputs that make
 * that tool call effective. This controller will:
 *
 * 1. Select which vector stores (and therefore which uploaded files) should be
 *    exposed to the Responses API by consulting the mappings created during
 *    ingestion. Pre-selecting stores bounds File Search to the right tenant/time
 *    window, improves precision, and keeps latency/cost predictable.
 *          Tools: https://platform.openai.com/docs/guides/tools
 *
 * 2. Derive search hints from the normalized email—sender domain and a
 *    lightweight summary—so they can be injected into prompts and/or used as
 *    metadata filters to steer retrieval toward the right files. Prefer
 *    deterministic filters when possible; keep hints concise.
 *          Retrieval guide: https://platform.openai.com/docs/guides/retrieval
 *          File Search: https://platform.openai.com/docs/guides/tools-file-search
 *
 * 3. Capture an execution plan (chosen stores, filters/hints, observability hooks)
 *    that the generation stage can pass directly to the Responses client.
 */
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
    const summaryText = normalizedBody
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);

    return {
        vectorStoreHandles: [],
        searchHints: {
            senderDomain: getSenderDomain(normalizedEmail),
            summary: summaryText.length > 0 ? summaryText : null,
        },
        retrievalNotes: [
            'Select appropriate vector stores / file sets based on metadata.',
            'Inject lexical + semantic hints to guide OpenAI file_search.',
            'Record observability data for downstream generation + verification.',
        ],
        sourceEmail: normalizedEmail,
    };
};
