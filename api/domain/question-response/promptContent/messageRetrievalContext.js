/**
 * =====================|| Message Retrieval Context ||=====================
 *
 * Formats the retrieval summary prepared by the pipeline into textual content
 * that eventually becomes a developer-role message. Surfacing this context
 * helps the assistant understand which file search handles, sender hints, and
 * question IDs the orchestrator selected without bloating the wrapper code.
 */

export const buildMessageRetrievalContextBody = (retrievalSummary) => {
    if (!retrievalSummary) {
        return null;
    }

    const { searchHints, knowledgeBases } = retrievalSummary;
    const retrievalLines = [];

    if (searchHints?.senderDomain) {
        retrievalLines.push(`Sender domain hint: ${searchHints.senderDomain}`);
    }

    if (searchHints?.summary) {
        retrievalLines.push(`Email summary hint: ${searchHints.summary}`);
    }

    if (Array.isArray(knowledgeBases) && knowledgeBases.length > 0) {
        retrievalLines.push('File Search knowledge bases prepared for this request:');

        knowledgeBases.forEach((base, index) => {
            const label =
                typeof base?.label === 'string' && base.label.trim().length > 0
                    ? base.label.trim()
                    : `Knowledge base ${index + 1}`;
            const handleTag =
                typeof base?.handle === 'string' && base.handle.trim().length > 0
                    ? ` [${base.handle.trim()}]`
                    : '';
            const questionIds = Array.isArray(base?.questionIds)
                ? base.questionIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
                : [];
            const questionText =
                questionIds.length > 0
                    ? questionIds.join(', ')
                    : 'Catch-all (applies to all questions approved)';
            const description =
                typeof base?.description === 'string' && base.description.trim().length > 0
                    ? base.description.trim()
                    : null;

            retrievalLines.push(`   ${index + 1}. ${label}${handleTag} → Questions: ${questionText}`);

            if (description) {
                retrievalLines.push(`      Notes: ${description}`);
            }

            const fileContexts = Array.isArray(base?.fileContexts) ? base.fileContexts : [];

            if (fileContexts.length > 0) {
                retrievalLines.push('      File context sources:');

                fileContexts.forEach((context, contextIndex) => {
                    const contextTitle =
                        typeof context?.title === 'string' && context.title.trim().length > 0
                            ? context.title.trim()
                            : `Source ${contextIndex + 1}`;
                    const contextUrl =
                        typeof context?.url === 'string' && context.url.trim().length > 0
                            ? context.url.trim()
                            : null;
                    const contextSummary =
                        typeof context?.summary === 'string' && context.summary.trim().length > 0
                            ? context.summary.trim()
                            : null;
                    const relatedQuestionIds = Array.isArray(context?.questionIds)
                        ? context.questionIds.filter(
                              (id) => typeof id === 'string' && id.trim().length > 0
                          )
                        : [];

                    retrievalLines.push(
                        `         • ${contextTitle}${contextUrl ? ` → ${contextUrl}` : ''}${
                            relatedQuestionIds.length > 0
                                ? ` (answers: ${relatedQuestionIds.join(', ')})`
                                : ''
                        }`
                    );

                    if (contextSummary) {
                        retrievalLines.push(`           Note: ${contextSummary}`);
                    }
                });
            }
        });
    }

    if (retrievalLines.length === 0) {
        return null;
    }

    return ['Retrieval context prepared by pipeline:', ...retrievalLines].join('\n');
};

export default {
    buildMessageRetrievalContextBody,
};
