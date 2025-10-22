/**
 * ===============================|| Prompt Wrappers ||================================
 *
 * Collects helper functions that prepare reusable system/user messages and the JSON schema
 * used with OpenAI's Responses API. Consolidating the prompt logic here keeps our service
 * layers focused on transport concerns while giving us a single place to evolve the
 * instructions as new condo questions are added.
 */

import { APPROVED_QUESTIONS } from './approvedQuestions.js';

// JSON schema that tells the Responses API how to format the assistant's answer plan.
// Using a schema keeps downstream consumers simple and makes it easy to expand the
// structure later without breaking callers. Comments here should double as onboarding
// guidance for anyone wiring new stages into the Responses workflow. The schema shape
// mirrors the `client.responses.parse` documentation for SDK v5.23.2 so we stay aligned
// with the latest contract (https://platform.openai.com/docs/api-reference/responses).
const QUESTION_RESPONSE_SCHEMA = {
    name: 'approved_question_response_plan',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            match: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    isApprovedQuestion: { type: 'boolean' },
                    questionId: { type: ['string', 'null'] },
                    questionTitle: { type: ['string', 'null'] },
                    matchedQuestions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                questionId: { type: 'string' },
                                questionTitle: { type: 'string' },
                            },
                            required: ['questionId', 'questionTitle'],
                        },
                    },
                    confidence: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                    },
                    reasoning: { type: 'string' },
                },
                required: [
                    'isApprovedQuestion',
                    'questionId',
                    'questionTitle',
                    'matchedQuestions',
                    'confidence',
                    'reasoning',
                ],
            },
            assistantPlan: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    emailReply: { type: 'string' },
                    recommendedActions: {
                        type: 'array',
                        minItems: 2,
                        maxItems: 8,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                title: { type: 'string' },
                                details: { type: 'string' },
                            },
                            required: ['title', 'details'],
                        },
                    },
                    suggestedFollowUps: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 3,
                        items: { type: 'string' },
                    },
                    knowledgeConfidence: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                    },
                    sourceCitations: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                url: { type: 'string' },
                                title: { type: 'string' },
                                excerpt: { type: 'string' },
                            },
                            required: ['url', 'title', 'excerpt'],
                        },
                    },
                },
                required: [
                    'emailReply',
                    'recommendedActions',
                    'suggestedFollowUps',
                    'knowledgeConfidence',
                    'sourceCitations',
                ],
            },
        },
        required: ['match', 'assistantPlan'],
    },
};

export const getQuestionResponseSchema = () => QUESTION_RESPONSE_SCHEMA;

export const buildQuestionResponsePrompt = (normalizedEmail, options = {}) => {
    const subject = normalizedEmail?.metadata?.subject;
    const senderName = normalizedEmail?.metadata?.sender?.displayName;
    const senderEmail = normalizedEmail?.metadata?.sender?.emailAddress;
    const optionalPrompt =
        typeof normalizedEmail?.optionalPrompt === 'string'
            ? normalizedEmail.optionalPrompt
            : null;
    const retrievalSummary = options?.retrievalSummary || null;

    // ============================|| Email Header Stitching ||============================ //
    // The model performs better when it sees the same headers a human agent would use to
    // triage the message. Package the optional subject + sender data exactly once so every
    // downstream caller gets the same formatting for free.
    const headerLines = [];

    if (subject) {
        headerLines.push(`Subject: ${subject}`);
    }

    if (senderName || senderEmail) {
        const senderLabel = [senderName, senderEmail].filter(Boolean).join(' <');
        headerLines.push(`From: ${senderLabel}${senderEmail && senderName ? '>' : ''}`);
    }

    const headerBlock = headerLines.length > 0 ? `${headerLines.join('\n')}\n\n` : '';

    // ==============================|| Catalog Formatting ||============================= //
    // For each approved question include the short operational guidance and any condo-site
    // resources the model should consult. The numbered structure keeps the prompt stable
    // even as we add new questions or resource links.
    const approvedQuestionText = APPROVED_QUESTIONS.map((question, index) => {
        const guidanceLines = question.answerGuidance
            .map((line, lineIndex) => `       ${lineIndex + 1}. ${line}`)
            .join('\n');

        const resourceLines = (question.resourceHints || [])
            .map(
                (resource, resourceIndex) =>
                    `       ${resourceIndex + 1}. ${resource.label} → ${resource.url}${
                        resource.usageNote ? ` (${resource.usageNote})` : ''
                    }`
            )
            .join('\n');

        const formattedResourceBlock = resourceLines
            ? ['   Preferred condo resources:', resourceLines].join('\n')
            : '   Preferred condo resources:\n       (none provided)';

        return [
            `${index + 1}. [${question.id}] ${question.title}`,
            '   Suggested coverage:',
            guidanceLines,
            formattedResourceBlock,
        ].join('\n');
    }).join('\n\n');

    // Keep system instructions short but explicit so the model always favors PEKA sources.
    // The comment below reiterates that we should not invent policies—only surface what the
    // portals state or escalate to humans when unsure. The user requested we stay factual
    // unless we have personally confirmed details on the site, so we codify that here.
    const baseSystemInstruction = [
        'You are a meticulous condo management operations assistant for PEKA Property Management.',
        'Use the approved question catalog, condo resource links, and guidance notes to craft reliable, empathetic responses that read like direct emails from the PEKA support team.',
        'Consult the peka.ab.ca resources before relying on memory, and defer to a human whenever the site does not confirm the answer.',
        'When you match an approved question, visit the highest-priority PEKA resource provided, capture the exact resident-facing language that addresses the request, and cite that portal in your plan.',
        'When a resident question falls outside the approved catalog, you must still provide a good-faith answer: search reputable public sources, clearly state within your reply that you are stepping outside PEKA resources, and base every statement on verifiable context.',
        'Never guess or hallucinate. If information cannot be verified, surface the uncertainty, explain any gaps plainly, and recommend a human follow-up instead of inventing policy.',
        'When providing an emailReply, answer as though you are the human, not as an agent.',
    ].join(' ');

    const userInstruction = [
        'Resident email (plain text):',
        '---',
        `${headerBlock}${normalizedEmail?.body || '(no body provided)'}`,
        '---',
    ].join('\n');

    const developerInstruction = [
        'Follow these directives when drafting response plans for PEKA residents.',
        '',
        'Approved condo management questions you may answer:',
        approvedQuestionText,
        '',
        'Tasks:',
        '1. Determine if the resident is effectively asking one of the approved questions (allowing paraphrasing).',
        '2. If matched, list every approved question that applies in match.matchedQuestions (the first entry should be the primary focus) and mirror the leading entry in match.questionId and match.questionTitle.',
        '3. If matched, open and read the first linked PEKA resource (and any other relevant condo resources) before answering. Capture the exact language that resolves the question and plan to echo it back to the resident.',
        '4. When the email maps to an approved question, you must provide a direct answer using that verified PEKA context—do not defer unless the resource leaves the core request unresolved.',
        '5. Exhaust File Search context before considering external tools. When an approved question ships with File Search passages (for example, special-assessments), treat those excerpts as authoritative and only contemplate web_search if File Search yields no relevant material.',
        '6. If not matched, clearly explain that you are stepping outside PEKA internal resources, use the web_search tool to gather guidance from reputable public sources, and keep searching until you find trustworthy material or exhaust reasonable options.',
        '7. When external research yields usable guidance, base your answer entirely on that material and describe any limitations or uncertainties you observed.',
        '8. If no credible information can be found, explicitly state that outcome, highlight the open questions, and recommend a human follow-up instead of speculating.',
        '9. Draft emailReply as a complete, empathetic email response addressed to the resident. Open with a friendly greeting, reference the verified language you just reviewed, quote or paraphrase the key instructions, include the exact URL, and close with a supportive sign-off that invites further questions. Please refrain from including final signatures, in general, or including PEKA contact information as a signature',
        '10. When relying on external research because no catalog question applied, explicitly note in emailReply that the guidance comes from public sources and mention any limitations or uncertainty.',
        '11. Produce 2-8 actionable internal follow-up steps with short titles and supporting details that reflect the certainty level.',
        '12. Only when applicable, suggest 1-3 resident-facing follow-up messages that maintain a helpful tone and communicate any uncertainty honestly.',
        '13. Populate sourceCitations with every supporting link you used; do not impose an artificial cap. Each citation must contain the exact URL visited, a short title, and the excerpt or policy detail that supports your summary. If no reliable source exists, include a single placeholder citation that clearly states no trustworthy reference was found and recommend human follow-up.',
        '14. Always fill the provided JSON schema and do not include extra commentary or markdown.',
    ].join('\n');

    const messages = [
        {
            role: 'system',
            content: [
                {
                    type: 'input_text',
                    text: baseSystemInstruction,
                },
            ],
        },
        {
            role: 'developer',
            content: [
                {
                    type: 'input_text',
                    text: developerInstruction,
                },
            ],
        },
    ];

    if (retrievalSummary) {
        const { searchHints, knowledgeBases } = retrievalSummary;
        // Mirror the retrieval plan inside the prompt so the Responses call and Node logs stay in sync for debugging.
        const retrievalLines = [];

        if (searchHints?.senderDomain) {
            // Domain hints nudge the model toward the right property manager docs.
            retrievalLines.push(`Sender domain hint: ${searchHints.senderDomain}`);
        }

        if (searchHints?.summary) {
            // Email summary primes the model with our deterministic read before tools fire.
            retrievalLines.push(`Email summary hint: ${searchHints.summary}`);
        }

        if (Array.isArray(knowledgeBases) && knowledgeBases.length > 0) {
            // List the File Search libraries so the model understands which uploads it can reach.
            retrievalLines.push('File Search knowledge bases prepared for this request:');

            knowledgeBases.forEach((base, index) => {
                const label = typeof base?.label === 'string' && base.label.trim().length > 0
                    ? base.label.trim()
                    : `Knowledge base ${index + 1}`;
                const handleTag = typeof base?.handle === 'string' && base.handle.trim().length > 0
                    ? ` [${base.handle.trim()}]`
                    : '';
                const questionIds = Array.isArray(base?.questionIds)
                    ? base.questionIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
                    : [];
                const questionText = questionIds.length > 0
                    ? questionIds.join(', ')
                    : 'Catch-all (applies to all approved questions)';
                const description = typeof base?.description === 'string' && base.description.trim().length > 0
                    ? base.description.trim()
                    : null;

                retrievalLines.push(
                    `   ${index + 1}. ${label}${handleTag} → Questions: ${questionText}`,
                );

                if (description) {
                    retrievalLines.push(`      Notes: ${description}`);
                }

                const fileContexts = Array.isArray(base?.fileContexts) ? base.fileContexts : [];

                if (fileContexts.length > 0) {
                    retrievalLines.push('      File context sources:');

                    fileContexts.forEach((context, contextIndex) => {
                        const contextTitle = typeof context?.title === 'string' && context.title.trim().length > 0
                            ? context.title.trim()
                            : `Source ${contextIndex + 1}`;
                        const contextUrl = typeof context?.url === 'string' && context.url.trim().length > 0
                            ? context.url.trim()
                            : null;
                        const contextSummary = typeof context?.summary === 'string' && context.summary.trim().length > 0
                            ? context.summary.trim()
                            : null;
                        const contextFileId = typeof context?.fileId === 'string' && context.fileId.trim().length > 0
                            ? context.fileId.trim()
                            : null;
                        const relatedQuestionIds = Array.isArray(context?.questionIds)
                            ? context.questionIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
                            : [];

                        retrievalLines.push(
                            `         • ${contextTitle}${contextUrl ? ` → ${contextUrl}` : ''}${
                                relatedQuestionIds.length > 0
                                    ? ` (answers: ${relatedQuestionIds.join(', ')})`
                                    : ''
                            }${contextFileId ? ` [OpenAI file: ${contextFileId}]` : ''}`,
                        );

                        if (contextSummary) {
                            retrievalLines.push(`           Note: ${contextSummary}`);
                        }
                    });
                }
            });
        }

        if (retrievalLines.length > 0) {
            // Skip the extra developer message when retrieval contributed nothing; keeps prompts tight.
            messages.push({
                role: 'developer',
                content: [
                    {
                        type: 'input_text',
                        text: [
                            'Retrieval context prepared by pipeline:',
                            ...retrievalLines,
                        ].join('\n'),
                    },
                ],
            });
        }
    }

    if (optionalPrompt) {
        messages.push({
            role: 'developer',
            content: [
                {
                    type: 'input_text',
                    text: [
                        'Additional operator instructions for this request:',
                        optionalPrompt,
                    ].join('\n\n'),
                },
            ],
        });
    }

    messages.push({
        role: 'user',
        content: [
            {
                type: 'input_text',
                text: userInstruction,
            },
        ],
    });

    return messages;
};

export default {
    getQuestionResponseSchema,
    buildQuestionResponsePrompt,
};
