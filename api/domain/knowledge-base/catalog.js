/**
 * =============================|| Knowledge Base Catalog ||=============================
 *
 * Curates the File Search libraries we trust. Retrieval pulls from this single source of
 * truth so every request attaches the same PEKA-approved stores, and generation can echo
 * back meaningful labels and descriptions when it briefs the model. Keep each entry
 * self-explanatory—future maintainers should know why a library exists without reading
 * other files first.
 */

import { APPROVED_QUESTIONS } from '../question-response/approvedQuestions.js';

const ALL_APPROVED_QUESTION_IDS = APPROVED_QUESTIONS.map((question) => question.id);

export const KNOWLEDGE_BASES = [
    {
        handle: 'pica-master-library',
        label: 'PEKA Master Policy & Forms Library',
        description:
            'Catch-all repository of PEKA master policy PDFs, tenant forms, and portal guidance maintained by PICA.',
        questionIds: ALL_APPROVED_QUESTION_IDS,
        vectorStoreId: 'vs_68f7ed4a55048191bb7c830babd34d30',
        // File contexts act as breadcrumbs that link answers back to the canonical PEKA pages mirrored in the store.
        fileContexts: [
            {
                title: 'PEKA Tenant Portal – Master Forms',
                url: 'https://peka.ab.ca/portal-renters',
                summary:
                    'Matches the tenant-facing forms mirrored in the vector store so residents can self-serve downloads.',
            },
            {
                title: 'PEKA Owner Portal – Policy Documents',
                url: 'https://peka.ab.ca/client-portal-owner',
                summary:
                    'Owners can retrieve the same policy PDFs referenced in File Search directly from the official portal.',
            },
        ],
        notes: [
            'Used as a fallback when a question-specific library is unavailable.',
        ],
    },
];

export default KNOWLEDGE_BASES;
