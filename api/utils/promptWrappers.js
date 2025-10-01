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
                    confidence: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                    },
                    reasoning: { type: 'string' },
                },
                required: ['isApprovedQuestion', 'questionId', 'questionTitle', 'confidence', 'reasoning'],
            },
            assistantPlan: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    answerSummary: { type: 'string' },
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
                },
                required: ['answerSummary', 'recommendedActions', 'suggestedFollowUps', 'knowledgeConfidence'],
            },
        },
        required: ['match', 'assistantPlan'],
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
        'Use the approved question catalog, condo resource links, and guidance notes to craft reliable, empathetic responses.',
        'Consult the peka.ab.ca resources before relying on memory, and defer to a human whenever the site does not confirm the answer.',
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
        '1. Determine if the resident is effectively asking one of the approved questions (allowing paraphrasing).',
        '2. If matched, visit or reference the linked PEKA resources first. Only restate what those sources confirm or request that a teammate double-check.',
        '3. Produce 2-4 actionable internal follow-up steps with short titles and supporting details.',
        '4. Suggest 1-3 resident-facing follow-up messages that maintain a helpful tone.',
        '5. Always fill the provided JSON schema and do not include extra commentary or markdown.',
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
