/**
 * ===========================|| Questions Approved Catalog ||==========================
 *
 * Central list of condo board-approved resident questions the MVP is permitted to answer.
 * `answerGuidance` captures the operational talking points the model should lean on when
 * preparing summaries and next steps. `resourceHints` offers canonical condo-website URLs
 * the model should treat as the first stop for policy language or downloadable forms.
 * `fileSearchContexts` (optional) links an approved question to specific File Search
 * uploads so retrieval can automatically attach them when the question appears.
 * Keep these notes aligned with condo leadership so responses stay consistent as the
 * service scales. Avoid adding speculative details—stick to what is published on
 * peka.ab.ca or documented in linked PDFs.
 */

export const QUESTIONS_APPROVED = [
    {
        id: 'rental-application',
        title: 'How do I submit a rental application for tenancy?',
        canonicalQuestion: 'How do I submit a rental application for tenancy?',
        answerGuidance: [
            'Start by directing residents to the Client Portal – Rental Tenants for current application steps and forms.',
            'Include the three core links together: Client Portal – Rental Tenants, Canmore Long-Term Rentals (current listings), and Online Application for Tenancy.',
            'State plainly that a completed rental application is required before consideration; do not use quotations.',
            'Note that each adult (18+) applying to live together must submit an individual application (limit three adults).',
            'Suggest preparing typical documents (employment/income details, landlord/employer references, government ID, and visa documentation if applicable) and defer specifics to the linked PDF.',
            'Acknowledge that the official application form and PDF contain the exact documentation and signature requirements—do not restate line items.',
            'If approved, explain that PEKA will arrange a viewing and provide the lease; defer deposit/insurance specifics to the official materials.',
            'Do not solicit assistance or offer to confirm availability/receipt; only provide follow-up if explicitly requested and then point to the official channels on the linked pages.',
            'Use PEKA’s published page titles and avoid invented labels or ambiguous parentheticals.',
            'Keep guidance scoped to long-term tenancy unless short-term rentals are explicitly asked about.',
            'Avoid phrasing that implies personal guidance or one-on-one assistance.'
        ],
        resourceHints: [

            {
                label: 'PEKA Home Page',
                url: 'https://peka.ab.ca/',
                usageNote: 'Use this resource to find other PEKA related answers to your queries. You do not need to actually share this resource though.',
            },
            {
                label: 'PEKA Resident Portal – Rental Applications',
                url: 'https://peka.ab.ca/portal-renters',
                usageNote: 'Share this for prospective or current tenants wanting to submit applications, file maintenance requests, edit contact details, apply for pet approval, or access tenant resources in the PEKA portal.',
            },
            {
                label: 'Canmore Long Term Rentals',
                url: 'https://peka.ab.ca/canmore-rentals',
                usageNote: `Share this when applicants need clarity on the standard terms and conditions for PEKA long-term rentals, or when they want to view the current list of available units.`,
            },
            {
                label: 'Learn About The Application Process',
                url: 'https://peka.ab.ca/files/PDF/tenant/process.pdf?11',
                usageNote: 'Share this when applicants want a step-by-step overview of the rental application process and required documentation.',
            },
            {
                label: 'Online Application for Tenancy',
                url: 'https://peka.ab.ca/online-application',
                usageNote: 'Share this in conjunction with, or immediately after, explaining the application process when the applicant is ready to apply online.',
            },
        ],
    },
    {
        id: 'condo-fees-payment',
        title: 'What are my Condo fees and how do I pay my condo fees?',
        canonicalQuestion: 'What are my condo fees and what payment options are available?',
        answerGuidance: [
            'Reference the PEKA Owner Portal for official condo fee amounts and payment instructions.',
            'Remind owners that the portal lists accepted payment methods and any associated timelines.',
            'Suggest contacting PEKA finance through the portal if billing information appears incorrect.',
        ],
        resourceHints: [
            {
                label: 'PEKA Owner Portal',
                url: 'https://peka.ab.ca/client-portal-owner',
                usageNote:
                    'Point owners here for the latest statements, payment guidance, and contact routes.',
            },
            {
                label: 'PEKA Home Page',
                url: 'https://peka.ab.ca/',
                usageNote: 'Offer this link for general switchboard contact details when needed.',
            },
        ],
    },
    {
        id: 'available-rentals',
        title: 'Where can I find available Rentals?',
        canonicalQuestion: 'Where can I find available condo rentals in the community?',
        answerGuidance: [
            'Identify which rental type the resident is asking about—residential long-term, residential short-term (nightly), or commercial space—before selecting resources.',
            'If the request is general or unspecified, reference the Client Portal – PEKA Tenants and the Bow Valley Long Term Rentals page as the starting point.',
            'For monthly or long-term residential rentals, direct residents to Bow Valley Long Term Rentals for current availability and eligibility notes.',
            'For nightly or short-term stays, direct them to the Canmore Short-Term Rentals or Clone Canmore Short-Term Residential Rentals pages as applicable.',
            'For office, retail, or commercial space inquiries, point to the Commercial Rentals page for listings and contact information.',
            'Always refer to the live portal and listings pages as the authoritative sources for current availability and updates.',
            'Do not restate property descriptions, pricing, or availability text—link only to the official listings pages.',
            'Maintain a neutral, informative tone—no marketing, persuasion, or conversational commentary.',
            'End after referencing the appropriate listing titles; do not include URLs in the body (titles only).',
            'Do not invite further questions; if renters need follow-up, the portal pages list the official contact methods.',
            // DO NOTs
            'Keep replies concise.',
            'Only reference the resource Titles, and do not list the links.',
            'Do not describe line items, checkboxes, or field instructions found within the forms.',
            'Avoid reciting or summarizing fees, rent obligations, cleaning clauses, or other details—refer to the form as the authoritative source.',
            'Never generate a “Next steps” or numbered checklist section.',
        ],
        resourceHints: [
            {
                label: 'Client Portal – PEKA Tenants',
                url: 'https://peka.ab.ca/portal-renters',
                usageNote:
                    'Use this as the central entry point for all tenant resources, applications, and links to rental listings.',
            },
            {
                label: 'Bow Valley Long Term Rentals',
                url: 'https://peka.ab.ca/canmore-long-term-rentals',
                usageNote:
                    'Use this page for monthly and long-term residential rental availability and eligibility details.',
            },
            {
                label: 'Canmore Short-Term Rentals',
                url: 'https://peka.ab.ca/canmore-short-term-rentals',
                usageNote:
                    'Use this page for nightly or short-term residential rental listings and policies.',
            },
            {
                label: 'Clone Canmore Short-Term Residential Rentals',
                url: 'https://peka.ab.ca/clone-canmore-short-term-residential-rentals',
                usageNote:
                    'Use this alternate short-term listing page if referenced in inquiry or linked from PEKA site navigation.',
            },
            {
                label: 'Commercial Rentals',
                url: 'https://peka.ab.ca/commercial',
                usageNote:
                    'Use this page when the inquiry involves commercial, retail, or office space leasing.',
            },
        ],
    },
    {
        id: 'lease-termination',
        title: 'How do I terminate my lease?',
        canonicalQuestion: 'How do I terminate my lease with the condo corporation?',
        answerGuidance: [
            'Refer residents to the official lease termination resources in the client-portal before any action is taken.',
            'Explain that notice periods and move-out expectations differ depending on lease type: non-furnished (periodic), furnished/partially furnished, or fixed-term (lease break). Each is outlined in a separate official form.',
            'Direct residents to select and complete the correct form; do not summarize or restate content from the PDFs.',
            'Note that PEKA’s instructions specify termination dates must fall on the last day of a month (not the first).',
            'If the appropriate notice form is unclear, acknowledge that it depends on unit type and lease term, and direct residents to the Client Portal – Rental Tenants page to confirm which form applies.',
            'Do not offer to review, verify, or submit notice on behalf of a tenant. Responses must remain informational and point to the published PEKA resources.',
            'Maintain an institutional, factual tone; avoid self-references (“I reviewed,” “I can confirm,” “let me know”) or closing offers of further help.',
            'End after factual guidance and resource links—do not include conversational sign-offs or solicit follow-up.',
            'Acknowledge that the official lease termination forms and PDF contain the exact documentation, information and signature requirements—do not restate line items that can be found in the referenced document.',
            'Do not solicit assistance or offer to confirm availability/receipt; only provide follow-up if explicitly requested and then point to the official channels on the linked pages.',
            // DO NOTs
            'Keep replies concise.',
            'Only reference the resource Titles, and do not list the links.',
            'Do not restate or quote text from the PEKA PDFs; reference them only by title.',
            'Do not describe line items, checkboxes, or field instructions found within the forms.',
            'Avoid reciting or summarizing fees, rent obligations, cleaning clauses, or other details—refer to the form as the authoritative source.',
            'Never generate a “Next steps” or numbered checklist section.',
        ],
        resourceHints: [
            {
                label: 'PEKA Renter Portal',
                url: 'https://peka.ab.ca/portal-renters',
                usageNote: 'Use this page to locate the correct notice form, move-out steps, and submission instructions.',
            },
            {
                label: 'Notice to Terminate Lease – Non-Furnished Properties',
                url: 'https://peka.ab.ca/files/PDF/tenant/Notice%20to%20Terminate%20Non-Furnished.pdf',
                usageNote: 'Use this form to end an unfurnished/periodic tenancy.',
            },
            {
                label: 'Notice to Terminate Lease – Fully/Partially Furnished Properties',
                url: 'https://peka.ab.ca/files/PDF/tenant/Notice%20to%20Terminate%20FURNISHED.pdf',
                usageNote: 'Use this form to end a furnished/part-furnished tenancy; plus furnished move-out standards.',
            },
            {
                label: 'Notice to Terminate Lease – Lease Break (Fixed Term Tenancy)',
                url: 'https://peka.ab.ca/files/PDF/tenant/NOTICE%20TO%20TERMINATE%20(LB)%20FIXED%20TERM%20TENANCY%20(Jun17).pdf',
                usageNote: 'Use this form to end a fixed-term lease early.',
            },
        ]
    },
    {
        id: 'insurance-coverage',
        title: 'What type of insurance does the Condo Corporation carry and what insurance am I responsible for as an owner.',
        canonicalQuestion: 'What insurance does the condo corporation carry and what coverage must owners maintain?',
        answerGuidance: [
            'Direct owners to the owner portal for the latest insurance summaries provided by PEKA.',
            'Encourage them to download the official documents before discussing coverage with their insurer.',
            'Suggest contacting PEKA through the portal if required insurance documentation is missing.',
        ],
        resourceHints: [
            {
                label: 'PEKA Owner Portal',
                url: 'https://peka.ab.ca/client-portal-owner',
                usageNote:
                    'Reference this page when pointing owners to master policy information or certificates.',
            },
            {
                label: 'PEKA Condo Corp Portal',
                url: 'https://peka.ab.ca/client-portal-condo',
                usageNote: 'Use this resource when noting where condo corporation communications are posted.',
            },
            {
                label: 'PEKA Condo Corp Portal',
                url: 'https://peka.ab.ca/files/PDF/tenant/Insurance%20Notice.pdf?11',
                usageNote: 'Use this resource when noting where condo corporation communications are posted.',
            },
        ],
    },
    {
        id: 'special-assessments',
        title: 'When are special assessments issued and how are they determined.',
        canonicalQuestion: 'When are special assessments issued and how are they determined?',
        answerGuidance: [
            'Reference the condo corporation portal for formal announcements about special assessments.',
            'Encourage owners to review board communications there for background and timelines.',
            'Remind them to contact PEKA if payment logistics posted in the portal need clarification.',
            'Lean on the condo levy guidance mirrored in the vector store as your primary source; only trigger external research if the retrieved passages leave the resident’s request unresolved.',
        ],
        resourceHints: [
            {
                label: 'PEKA Condo Corp Portal',
                url: 'https://peka.ab.ca/client-portal-condo',
                usageNote:
                    'Direct owners here for official notices, board updates, and supporting documentation.',
            },
            {
                label: 'PEKA Home Page',
                url: 'https://peka.ab.ca/',
                usageNote: 'Share this when residents need general PEKA contact details beyond the portals.',
            },
            {
                label: 'Condo Law Alberta – Special Levy Primer',
                url: 'https://www.condolawalberta.ca/finances/special-levy/',
                usageNote: 'Use this article when clarifying how special levies are triggered and approved.',
            },
        ],
        fileSearchContexts: [
            {
                vectorStoreHandle: 'pica-master-library',
                summary:
                    'Vector library materials covering Alberta condo corporation special assessments. Treat the retrieved passages as the authoritative source.',
            },
        ],
    },
];

export default APPROVED_QUESTIONS;
