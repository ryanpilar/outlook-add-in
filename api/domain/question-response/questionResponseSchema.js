/**
 * ======================|| Question Response Schema ||======================
 *
 * Houses the JSON schema shared with the Responses API. Keeping the schema in
 * its own module keeps the prompt wrapper concise while preserving the inline
 * documentation for anyone wiring new consumers into the workflow.
 */

export const QUESTION_RESPONSE_SCHEMA = {
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
            responseMetadata: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    vectorAnswer: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            isVectorAnswerSufficient: { type: 'boolean' },
                            reasoning: { type: 'string' },
                            missingInformationNotes: {
                                type: 'array',
                                minItems: 0,
                                maxItems: 6,
                                items: { type: 'string' },
                            },
                        },
                        required: [
                            'isVectorAnswerSufficient',
                            'reasoning',
                            'missingInformationNotes',
                        ],
                    },
                },
                required: ['vectorAnswer'],
            },
        },
        required: ['match', 'assistantPlan', 'responseMetadata'],
    },
};

export const getQuestionResponseSchema = () => QUESTION_RESPONSE_SCHEMA;

export default {
    QUESTION_RESPONSE_SCHEMA,
    getQuestionResponseSchema,
};
