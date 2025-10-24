// ============================|| Question Planning Fallbacks ||============================ //
// Centralizes the deterministic fallback payload returned when the Responses API is
// unavailable or returns malformed data. Keeping these helpers alongside the other question
// planning utilities ensures the service layer focuses on orchestration rather than constant
// definitions.

import { QUESTIONS_APPROVED } from './questionsApproved.js';

export const DEFAULT_ASSISTANT_PLAN = {
    emailReply:
        'Thanks for reaching out. Our automated assistant is offline right now, so a teammate will review your note and follow up as quickly as possible.',
    recommendedActions: [
        {
            title: 'Route to concierge team',
            details: 'Assign the message to the condo concierge queue for manual follow-up.',
        },
        {
            title: 'Acknowledge resident',
            details: 'Let the resident know that we are reviewing their question and will respond soon.',
        },
    ],
    suggestedFollowUps: [
        'Follow up with the resident once a teammate has reviewed their email so they know what to expect next.',
    ],
    knowledgeConfidence: 'low',
    sourceCitations: [
        {
            url: 'https://peka.ab.ca/',
            title: 'PEKA Property Management',
            excerpt:
                'Manual handling required. A PEKA teammate will review the message and respond directly.',
        },
    ],
};

export const buildFallbackPayload = (error) => ({
    match: {
        isApprovedQuestion: false,
        questionId: null,
        questionTitle: null,
        matchedQuestions: [],
        confidence: 'low',
        reasoning: `Fell back to manual handling: ${error.message}`,
    },
    assistantPlan: DEFAULT_ASSISTANT_PLAN,
    responseMetadata: {
        vectorAnswer: {
            isVectorAnswerSufficient: false,
            reasoning:
                'Automated planning disabled: a teammate must supply additional condo context or perform web research.',
            missingInformationNotes: [
                'No automated vector-store analysis was produced because the Responses API call failed.',
            ],
        },
    },
    questionsApproved: QUESTIONS_APPROVED,
    vectorOnlyDraft: null,
    researchAugmentation: null,
});

export default {
    DEFAULT_ASSISTANT_PLAN,
    buildFallbackPayload,
};
