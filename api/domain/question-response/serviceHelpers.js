/**
 * Helper utilities for the Question Response service so the orchestration layer can
 * read top-down while these functions handle the gnarly wiring details.
 */

import {
    buildFileSearchToolsPayload,
    isFileSearchEnabled,
    resolveVectorStoreId,
} from '../../integrations/openai/fileSearch.js';
import { buildQuestionResponsePrompt, getQuestionResponseSchema } from './promptWrappers.js';

const WEB_SEARCH_ENV_FLAG = 'true';

export const DEFAULT_RESPONSE_VERBOSITY = 'medium';
export const DEFAULT_REASONING_EFFORT = 'medium';

export const WEB_SEARCH_MODES = {
    DISABLED: 'disabled',
    ENABLED: 'enabled',
    INHERIT: 'inherit',
};

// Opt-in support for OpenAI's web_search tool so the model can fetch fresh context when tests
// explicitly enable it. Keeping this isolated makes it obvious how to extend tool wiring later.
const buildWebSearchTools = (mode = WEB_SEARCH_MODES.INHERIT) => {
    const normalizedMode = Object.values(WEB_SEARCH_MODES).includes(mode)
        ? mode
        : WEB_SEARCH_MODES.INHERIT;

    if (normalizedMode === WEB_SEARCH_MODES.DISABLED) {
        return undefined;
    }

    if (normalizedMode === WEB_SEARCH_MODES.INHERIT) {
        if (process.env.OPENAI_ENABLE_WEB_SEARCH !== WEB_SEARCH_ENV_FLAG) {
            return undefined;
        }
    }

    return [
        {
            type: 'web_search',
        },
    ];
};

// Trim search hints so the prompt only carries the deliberate domain + summary context we
// explicitly approved upstream.
const sanitizeSearchHints = (searchHints) => {
    if (!searchHints || typeof searchHints !== 'object') {
        return null;
    }

    const senderDomain = typeof searchHints.senderDomain === 'string'
        ? searchHints.senderDomain.trim()
        : '';

    const summary = typeof searchHints.summary === 'string' ? searchHints.summary.trim() : '';

    if (!senderDomain && !summary) {
        return null;
    }

    return {
        senderDomain: senderDomain || null,
        summary: summary || null,
    };
};

// Scrub file metadata before it hits the prompt so each entry mirrors the catalog shape
// without leaking undefined placeholders.
const sanitizeFileContexts = (fileContexts = []) =>
    fileContexts
        .filter((context) => context && typeof context === 'object')
        .map((context) => {
            const title = typeof context.title === 'string' ? context.title.trim() : '';
            const url = typeof context.url === 'string' ? context.url.trim() : '';
            const summary = typeof context.summary === 'string' ? context.summary.trim() : '';
            const fileId = typeof context.fileId === 'string' ? context.fileId.trim() : '';
            const questionIds = Array.isArray(context.questionIds)
                ? context.questionIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
                : [];

            if (!title && !url && !summary && !fileId) {
                return null;
            }

            return {
                title: title || null,
                url: url || null,
                summary: summary || null,
                fileId: fileId || null,
                questionIds,
            };
        })
        .filter(Boolean);

// Strip the handle descriptors down to the prompt-friendly fields we want the model to see.
const sanitizeKnowledgeBasesForPrompt = (handles = []) =>
    handles.map((handle) => ({
        handle: typeof handle?.handle === 'string' ? handle.handle : null,
        label: typeof handle?.label === 'string' ? handle.label : null,
        description: typeof handle?.description === 'string' ? handle.description : null,
        questionIds: Array.isArray(handle?.questionIds)
            ? handle.questionIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
            : [],
        fileContexts: sanitizeFileContexts(handle?.fileContexts),
    }));

// Lightweight logger so helpers can surface retrieval choices without bloating the service.
const logDebug = (debugEnabled, message, payload) => {
    if (!debugEnabled) {
        return;
    }

    console.log(message, payload);
};

const resolveFileSearchHandles = async ({ client, vectorStoreHandles, debugLogsEnabled }) => {
    const resolvedHandles = [];
    const vectorStoreIds = [];

    // Resolve each handle sequentially so we can log granular failures while still collecting
    // every successful vector store ID.
    for (const handle of vectorStoreHandles) {
        try {
            const resolvedId = await resolveVectorStoreId(client, handle);

            if (!resolvedId) {
                continue;
            }

            // Prevent duplicate IDs so the File Search tool payload stays compact.
            if (!vectorStoreIds.includes(resolvedId)) {
                vectorStoreIds.push(resolvedId);
            }

            const { autoProvision: _autoProvision, ...restHandle } = handle || {};

            resolvedHandles.push({
                ...restHandle,
                vectorStoreId: resolvedId,
            });

            logDebug(debugLogsEnabled, '[question-response] Resolved vector store handle', {
                handle: restHandle?.handle || restHandle?.label || 'unknown-handle',
                vectorStoreId: resolvedId,
            });
        } catch (resolutionError) {
            const handleLabel = handle?.handle || handle?.label || 'unknown-handle';
            console.warn(
                `Failed to resolve vector store for handle "${handleLabel}"`,
                resolutionError?.message || resolutionError,
            );
        }
    }

    // Skip tool prep when we failed to resolve any vector stores.
    if (vectorStoreIds.length === 0) {
        return null;
    }

    return {
        handles: resolvedHandles,
        vectorStoreIds,
    };
};

export const prepareRetrievalToolkit = async ({
    client,
    retrievalPlan,
    debugLogsEnabled,
    webSearchMode = WEB_SEARCH_MODES.INHERIT,
}) => {
    const toolDefinitions = [];
    const toolDiagnostics = {
        webSearchEnabled: false,
        fileSearch: null,
        knowledgeBasesForPrompt: [],
    };

    const webSearchTools = buildWebSearchTools(webSearchMode);

    // Attach web search tooling when the feature flag is active.
    if (webSearchTools) {
        toolDefinitions.push(...webSearchTools);
        toolDiagnostics.webSearchEnabled = true;
    }

    const vectorStoreHandles = Array.isArray(retrievalPlan?.vectorStoreHandles)
        ? retrievalPlan.vectorStoreHandles
        : [];

    const fileSearchActive = isFileSearchEnabled();
    let resolvedFileSearch = null;

    // Only resolve File Search handles when the feature is on and we actually have handles to chase.
    if (fileSearchActive && vectorStoreHandles.length > 0) {
        resolvedFileSearch = await resolveFileSearchHandles({
            client,
            vectorStoreHandles,
            debugLogsEnabled,
        });

        // Attach the File Search tool definition once we have concrete vector store IDs.
        if (resolvedFileSearch?.vectorStoreIds?.length) {
            const fileSearchTools = buildFileSearchToolsPayload(resolvedFileSearch.vectorStoreIds);

            if (fileSearchTools) {
                toolDefinitions.push(...fileSearchTools);
            }
        }
    }

    const knowledgeBasesForPrompt = fileSearchActive && (resolvedFileSearch || vectorStoreHandles.length > 0)
        ? sanitizeKnowledgeBasesForPrompt(
              resolvedFileSearch?.handles?.length ? resolvedFileSearch.handles : vectorStoreHandles,
          )
        : [];

    toolDiagnostics.fileSearch = resolvedFileSearch;
    toolDiagnostics.knowledgeBasesForPrompt = knowledgeBasesForPrompt;

    // Announce which retrieval assets we attached so manual Outlook tests can trace File Search usage.
    logDebug(debugLogsEnabled, '[question-response] File search preparation', {
        enabled: fileSearchActive,
        vectorStoreIds: resolvedFileSearch?.vectorStoreIds || [],
        handles: (resolvedFileSearch?.handles || vectorStoreHandles).map((handle) => ({
            handle: handle?.handle,
            vectorStoreId: handle?.vectorStoreId || null,
            fileContextCount: Array.isArray(handle?.fileContexts) ? handle.fileContexts.length : 0,
        })),
    });

    const sanitizedSearchHints = sanitizeSearchHints(retrievalPlan?.searchHints);

    const hasKnowledgeBases = knowledgeBasesForPrompt.length > 0;

    // Forward the highlights of our retrieval prep into the prompt wrapper so the model and humans
    // share the same recap of attached context.
    const retrievalSummary = sanitizedSearchHints || hasKnowledgeBases
        ? {
              searchHints: sanitizedSearchHints,
              knowledgeBases: hasKnowledgeBases ? knowledgeBasesForPrompt : [],
          }
        : null;

    logDebug(debugLogsEnabled, '[question-response] Retrieval summary prepared', {
        hasSearchHints: Boolean(sanitizedSearchHints),
        searchHints: sanitizedSearchHints,
        knowledgeBaseCount: hasKnowledgeBases ? knowledgeBasesForPrompt.length : 0,
    });

    return {
        toolDefinitions,
        retrievalSummary,
        toolDiagnostics,
    };
};

export const buildResponsesRequestPayload = ({
    normalizedEmail,
    retrievalSummary,
    toolDefinitions = [],
    model,
    promptOptions,
    responseTuning = {},
}) => {
    const promptOptionsWithSummary = {
        ...(promptOptions || {}),
        ...(retrievalSummary ? { retrievalSummary } : {}),
    };

    const inputMessages = buildQuestionResponsePrompt(
        normalizedEmail,
        promptOptionsWithSummary,
    );

    const textFormat = {
        type: 'json_schema',
        ...getQuestionResponseSchema(),
    };

    const verbosity = String(responseTuning?.verbosity || DEFAULT_RESPONSE_VERBOSITY).toLowerCase();

    const reasoningEffort = String(
        responseTuning?.reasoningEffort || DEFAULT_REASONING_EFFORT
    ).toLowerCase();

    const payload = {
        model: typeof model === 'string' && model.trim().length > 0 ? model.trim() : 'gpt-5-mini',
        input: inputMessages,
        text: {
            format: textFormat,
            verbosity,
        },
        reasoning: {
            effort: reasoningEffort,
        },
    };

    if (toolDefinitions.length > 0) {
        payload.tools = toolDefinitions;
        payload.tool_choice = 'auto';
    }

    return payload;
};

export const parseResponsesOutput = (response) => {
    // Prefer the convenience helper, but defensively read the content array if needed. Some SDK
    // versions populate `output` with granular blocks (future tool outputs, multiple text segments, etc.).
    const fallbackSegments = Array.isArray(response?.output)
        ? response.output.flatMap((item) =>
              Array.isArray(item?.content)
                  ? item.content
                        .filter((contentItem) => contentItem?.type === 'output_text')
                        .map((contentItem) => contentItem?.text || '')
                  : [],
          )
        : [];

    const outputText = response?.output_text ?? fallbackSegments.join('');

    if (!outputText.trim()) {
        throw new Error('OpenAI response missing output_text.');
    }

    const parsed = JSON.parse(outputText);

    const responseMetadata = parsed?.responseMetadata && typeof parsed.responseMetadata === 'object'
        ? parsed.responseMetadata
        : {};

    const vectorAnswerMetadata = responseMetadata?.vectorAnswer;

    const normalizedResponseMetadata = {
        ...responseMetadata,
        vectorAnswer: vectorAnswerMetadata
            ? {
                  isVectorAnswerSufficient: Boolean(
                      vectorAnswerMetadata.isVectorAnswerSufficient,
                  ),
                  reasoning:
                      typeof vectorAnswerMetadata.reasoning === 'string'
                          ? vectorAnswerMetadata.reasoning
                          : '',
                  missingInformationNotes: Array.isArray(
                      vectorAnswerMetadata.missingInformationNotes,
                  )
                      ? vectorAnswerMetadata.missingInformationNotes.filter(
                            (note) =>
                                typeof note === 'string' && note.trim().length > 0,
                        )
                      : [],
              }
            : {
                  isVectorAnswerSufficient: false,
                  reasoning: '',
                  missingInformationNotes: [],
              },
    };

    const normalizedMatch = {
        ...parsed.match,
        matchedQuestions: Array.isArray(parsed?.match?.matchedQuestions)
            ? parsed.match.matchedQuestions
            : [],
    };

    return {
        parsed: {
            ...parsed,
            responseMetadata: normalizedResponseMetadata,
        },
        normalizedMatch,
    };
};
