/**
 * =============================|| Knowledge Base Catalog ||=============================
 *
 * Curates the File Search libraries we trust. Retrieval pulls from this single source of
 * truth so every request attaches the same PEKA-approved stores, and generation can echo
 * back meaningful labels and descriptions when it briefs the model. Keep each entry
 * self-explanatory—future maintainers should know why a library exists without reading
 * other files first.
 */

import { QUESTIONS_APPROVED } from '../question-response/questionsApproved.js';

const ALL_QUESTIONS_APPROVED_IDS = QUESTIONS_APPROVED.map((question) => question.id);

export const KNOWLEDGE_BASES = [
    {
        handle: 'pica-master-library',
        label: 'PEKA Master Policy & Forms Library',
        description:
            'Catch-all repository of PEKA master policy PDFs, tenant forms, and portal guidance maintained by PICA.',
        questionIds: ALL_QUESTIONS_APPROVED_IDS,
        vectorStoreId: 'vs_68f7ed4a55048191bb7c830babd34d30',
        // File contexts act as breadcrumbs that link answers back to the canonical PEKA pages mirrored in the store.
        fileContexts: [
            {
                summary:
                    'PEKA-managed policy PDFs, tenant forms, and portal instructions are mirrored in this vector library. Cite the documents returned by File Search and rely on this handle as the enduring reference.',
            },
        ],
        notes: [
            'Used as a fallback when a question-specific library is unavailable.',
        ],
    },
];

export default KNOWLEDGE_BASES;
