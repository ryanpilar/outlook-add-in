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
                    reasoning: { type: 'string' },
                    questions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                questionId: { type: 'string' },
                                questionTitle: { type: 'string' },
                                confidence: {
                                    type: 'string',
                                    enum: ['high', 'medium', 'low'],
                                },
                                reasoning: { type: 'string' },
                            },
                            required: ['questionId', 'questionTitle', 'confidence', 'reasoning'],
                        },
                    },
                },
                required: ['isApprovedQuestion', 'reasoning', 'questions'],
            },
            agentPlan: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    emailReply: { type: 'string' },
                    recommendedActions: {
                        type: 'array',
                        minItems: 2,
                        maxItems: 4,
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
                        maxItems: 4,
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
        required: ['match', 'agentPlan'],
    },
};

export const getQuestionResponseSchema = () => QUESTION_RESPONSE_SCHEMA;

export const buildQuestionResponsePrompt = (normalizedEmail) => {
    const subject = normalizedEmail?.metadata?.subject;
    const senderName = normalizedEmail?.metadata?.sender?.displayName;
    const senderEmail = normalizedEmail?.metadata?.sender?.emailAddress;

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
        'When residents ask multiple approved questions in one email, you must treat each question independently—gather the supporting policy language for every match and address each one in the final plan.',
        'Consult the peka.ab.ca resources before relying on memory, and defer to a human whenever the site does not confirm the answer.',
        'When you match an approved question, visit the highest-priority PEKA resource provided, capture the exact resident-facing language that addresses the request, and cite that portal in your plan.',
        'When a resident question falls outside the approved catalog, you must still provide a good-faith answer: search reputable public sources, clearly state within your reply that you are stepping outside PEKA resources, and base every statement on verifiable context.',
        'Never guess or hallucinate. If information cannot be verified, surface the uncertainty, explain any gaps plainly, and recommend a human follow-up instead of inventing policy.',
    ].join(' ');

    const userInstruction = [
        'Resident email (plain text):',
        '---',
        `${headerBlock}${normalizedEmail?.body || '(no body provided)'}`,
        '---',
        '',
        'Approved condo management questions you may answer:',
        approvedQuestionText,
        '',
        'Tasks:',
        '1. Determine if the resident is effectively asking one or more of the approved questions (allowing paraphrasing).',
        '2. For every approved question that appears, populate match.questions with an entry capturing the exact catalog question, your confidence, and a short explanation of how the email wording maps to the catalog language. Leave match.questions empty when no approved questions apply.',
        '3. If any approved question is matched, open and read the first linked PEKA resource (and any other relevant condo resources) for each question before answering. Capture the exact language that resolves every question and plan to echo it back to the resident.',
        '4. When the email maps to approved questions, provide direct answers for all of them using that verified PEKA context—do not defer unless a resource leaves that specific request unresolved.',
        '5. If parts of the email do not map to approved questions, clearly explain that you are stepping outside PEKA internal resources, use the web_search tool to gather guidance from reputable public sources, and keep searching until you find trustworthy material or exhaust reasonable options.',
        '6. When external research yields usable guidance, base your answer entirely on that material and describe any limitations or uncertainties you observed.',
        '7. If no credible information can be found for a question, explicitly state that outcome, highlight the open questions, and recommend a human follow-up instead of speculating.',
        '8. Draft agentPlan.emailReply as a complete, empathetic email response addressed to the resident. Open with a friendly greeting, address each approved question in separate, clearly labeled paragraphs or bullet points, reference the verified language you just reviewed, include the exact URL, and close with a supportive sign-off that invites further questions.',
        '9. When relying on external research because no catalog question applied, explicitly note in agentPlan.emailReply that the guidance comes from public sources and mention any limitations or uncertainty.',
        '10. Produce 2-4 actionable internal follow-up steps in agentPlan.recommendedActions with short titles and supporting details that reflect the certainty level, making sure they cover every matched question or outstanding concern.',
        '11. Suggest 1-3 resident-facing follow-up messages in agentPlan.suggestedFollowUps that maintain a helpful tone and communicate any uncertainty honestly.',
        '12. Populate agentPlan.sourceCitations with at least one entry containing the exact URL you visited, a short title, and the excerpt or policy detail that supports your summary. If no reliable source exists, include a single placeholder citation that clearly states no trustworthy reference was found and recommend human follow-up.',
        '13. Always fill the provided JSON schema and do not include extra commentary or markdown.',
    ].join('\n');

    return [
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
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: userInstruction,
                },
            ],
        },
    ];
};

export default {
    getQuestionResponseSchema,
    buildQuestionResponsePrompt,
};
