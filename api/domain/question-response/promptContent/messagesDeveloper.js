/**
 * ======================|| Messages Developer Builders ||=====================
 *
 * Captures the developer-role message variants that accompany the prompt based
 * on data returned from the vector-only pass. Keeping this in the promptContent
 * folder ensures the logic sits next to the textual guidance it references,
 * which keeps the higher-level wrapper lean and easy to read.
 */

import {
    buildVectorAssessmentText,
    buildVectorAssistantPlanText,
} from './instructions.js';

export const buildVectorPassMessagesDeveloperBodies = ({
    generationMode,
    vectorAnswerMetadata,
    previousAssistantPlan,
}) => {
    if (generationMode !== 'research-augmented') {
        return [];
    }

    const bodies = [buildVectorAssessmentText(vectorAnswerMetadata)];

    if (previousAssistantPlan && typeof previousAssistantPlan === 'object') {
        bodies.push(buildVectorAssistantPlanText(previousAssistantPlan));
    }

    return bodies;
};

export default {
    buildVectorPassMessagesDeveloperBodies,
};
