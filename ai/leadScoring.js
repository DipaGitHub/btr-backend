/**
 * Deterministic Lead Scoring Calculator for BTR Communication.
 *
 * Scoring Rules:
 * +20 Clear project requirement / description provided
 * +20 Budget identified / mentioned
 * +20 Timeline / deadline identified
 * +15 Valid contact information (email and/or phone)
 * +15 Quote request or commercial intent
 * +10 Human / sales representative request
 *
 * Total Score:
 * 80 - 100 = 'hot'
 * 50 - 79  = 'warm'
 * 0  - 49  = 'cold'
 */

function calculateLeadScore(leadData = {}) {
    let score = 0;
    const {
        project_description,
        project_type,
        budget_range,
        timeline,
        email,
        phone,
        intent,
        handoff_requested
    } = leadData;

    // 1. Clear project requirement (+20)
    if ((project_description && project_description.trim().length > 15) || project_type) {
        score += 20;
    }

    // 2. Budget identified (+20)
    if (budget_range && budget_range.trim().length > 0) {
        score += 20;
    }

    // 3. Timeline identified (+20)
    if (timeline && timeline.trim().length > 0) {
        score += 20;
    }

    // 4. Valid contact info (+15)
    if (email && email.includes('@')) {
        score += 10;
    }
    if (phone && phone.trim().length >= 6) {
        score += 5;
    }

    // 5. Quote request or commercial buying intent (+15)
    if (intent === 'quote_request' || intent === 'consultation' || (leadData.service && leadData.service.length > 0)) {
        score += 15;
    }

    // 6. Human / sales request (+10)
    if (handoff_requested || intent === 'human_agent') {
        score += 10;
    }

    // Cap at 100
    score = Math.min(score, 100);

    let status = 'cold';
    if (score >= 80) {
        status = 'hot';
    } else if (score >= 50) {
        status = 'warm';
    }

    return {
        score,
        status
    };
}

module.exports = {
    calculateLeadScore
};
