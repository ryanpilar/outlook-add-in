/**
 * ===========================|| Approved Question Catalog ||===========================
 *
 * Central list of condo board-approved resident questions the MVP is permitted to answer.
 * `answerGuidance` captures the operational talking points the model should lean on when
 * preparing summaries and next steps. `resourceHints` offers canonical condo-website URLs
 * the model should treat as the first stop for policy language or downloadable forms.
 * Keep these notes aligned with condo leadership so responses stay consistent as the
 * service scales. Avoid adding speculative details—stick to what is published on
 * peka.ab.ca or documented in linked PDFs.
 */

export const APPROVED_QUESTIONS = [
    {
        id: 'rental-application',
        title: 'How do I submit a rental application for tenancy?',
        canonicalQuestion: 'How do I submit a rental application for tenancy?',
        answerGuidance: [
            // Keep guidance grounded in official, publicly visible resources.
            'Direct residents to sign in to the PEKA Resident Portal for the most current rental application steps.',
            'Encourage them to review the portal checklist so they gather every document the page requests before submission.',
            'Remind them that the linked form itself sets out the specific documentation and signature requirements — your reply should acknowledge this without paraphrasing line-items.',
            'Always include links to the PEKA Renter Portal for applications and for general information for inquiries.',
            'Do not offer to personally check availability, follow up, or confirm receipt unless the resident directly requests it.',
        ],
        resourceHints: [
            {
                label: 'PEKA Resident Portal – Rental Applications',
                url: 'https://peka.ab.ca/portal-renters',
                usageNote:
                    'Use this official portal page when referencing how to submit or track rental applications.',
            },
            {
                label: 'PEKA Home Page',
                url: 'https://peka.ab.ca/',
                usageNote: 'Share this for general PEKA contact information when portal support is unavailable.',
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
            'Point the renter to the PEKA renter portal for live availability and eligibility information.',
            'Encourage them to follow the inquiry steps listed on the site for tours or additional questions.',
            'Remind them that the official portal is the source of truth for schedule changes or new listings.',
        ],
        resourceHints: [
            {
                label: 'PEKA Renter Portal',
                url: 'https://peka.ab.ca/portal-renters',
                usageNote:
                    'Share this when directing prospects to browse listings or submit rental availability inquiries.',
            },
            {
                label: 'Bow Valley Long Term Rentals',
                url: 'https://peka.ab.ca/canmore-long-term-rentals',
                usageNote:
                    'Include this when renters want to see the full list of managed Bow Valley residential rentals.',
            },
            {
                label: 'Vue Canmore Online Application',
                url: 'https://peka.ab.ca/client-portal-vue/online-application',
                usageNote:
                    'Reference this link when the renter is specifically interested in Vue Canmore applications.',
            },
            {
                label: 'PEKA Home Page',
                url: 'https://peka.ab.ca/',
                usageNote: 'Provide this link for main office contact information if urgent follow-up is required.',
            },
        ],
    },
    {
        id: 'lease-termination',
        title: 'How do I terminate my lease?',
        canonicalQuestion: 'How do I terminate my lease with the condo corporation?',
        answerGuidance: [
            'Ask the resident to review the lease termination guidance posted in the renter portal before taking action.',
            'Mention that move-out steps and notice expectations are documented in the same official resources.',
            'Offer to connect them with PEKA support through the portal if they need assistance submitting notice.',
        ],
        resourceHints: [
            {
                label: 'PEKA Renter Portal',
                url: 'https://peka.ab.ca/portal-renters',
                usageNote:
                    'Use this link when discussing official notice-to-vacate instructions or move-out steps.',
            },
            {
                label: 'PEKA Home Page',
                url: 'https://peka.ab.ca/',
                usageNote: 'Offer this page for primary office contact methods if further help is required.',
            },
        ],
    },
    {
        id: 'insurance-coverage',
        title:
            'What type of insurance does the Condo Corporation carry and what insurance am I responsible for as an owner.',
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
        ],
    },
];

export default APPROVED_QUESTIONS;
