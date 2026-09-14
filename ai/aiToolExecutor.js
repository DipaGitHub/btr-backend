const db = require('../db');
const { calculateLeadScore } = require('./leadScoring');
const sendEmail = require('../utils/sendEmail');

/**
 * Safe backend tool executor for Gemini function calls.
 * All queries are strictly parameterized.
 */

async function executeTool(toolName, args = {}, context = {}) {
    const { sessionId, conversationId } = context;

    try {
        switch (toolName) {
            case 'get_services': {
                const limit = Math.min(Number(args.limit) || 15, 30);
                const [services] = await db.query(
                    'SELECT id, name, display_order FROM admin_services WHERE is_active = 1 ORDER BY display_order ASC LIMIT ?',
                    [limit]
                );
                return {
                    success: true,
                    count: services.length,
                    services: services.map(s => ({ id: s.id, name: s.name }))
                };
            }

            case 'get_service_details': {
                const { service_id, service_name } = args;
                let query = 'SELECT id, name, is_active FROM admin_services WHERE is_active = 1';
                let params = [];

                if (service_id) {
                    query += ' AND id = ?';
                    params.push(service_id);
                } else if (service_name) {
                    query += ' AND name LIKE ?';
                    params.push(`%${service_name}%`);
                }
                query += ' LIMIT 1';

                const [rows] = await db.query(query, params);
                if (rows.length === 0) {
                    return { success: false, message: 'Service not found in active database.' };
                }

                return { success: true, service: rows[0] };
            }

            case 'get_pricing': {
                const { category_or_service } = args;
                let query = `
                    SELECT p.id, p.category, p.plan_name, p.price, p.features, p.is_featured
                    FROM admin_pricing p
                `;
                let params = [];

                if (category_or_service && category_or_service.trim()) {
                    query += ' WHERE p.category LIKE ? OR p.plan_name LIKE ?';
                    params.push(`%${category_or_service}%`, `%${category_or_service}%`);
                }
                query += ' ORDER BY p.price ASC LIMIT 10';

                const [plans] = await db.query(query, params);
                const formattedPlans = plans.map(p => {
                    let parsedFeatures = [];
                    try {
                        parsedFeatures = typeof p.features === 'string' ? JSON.parse(p.features) : p.features;
                    } catch {
                        parsedFeatures = [p.features];
                    }
                    return {
                        id: p.id,
                        category: p.category,
                        plan_name: p.plan_name,
                        price: p.price,
                        features: parsedFeatures,
                        is_featured: !!p.is_featured
                    };
                });

                return {
                    success: true,
                    count: formattedPlans.length,
                    pricing_plans: formattedPlans
                };
            }

            case 'search_faq': {
                const queryStr = (args.query || '').trim();
                if (!queryStr) {
                    const [faqs] = await db.query('SELECT id, qus, answers FROM admin_faq LIMIT 5');
                    return { success: true, faqs };
                }

                const searchTerm = `%${queryStr}%`;
                const [faqs] = await db.query(
                    'SELECT id, qus, answers FROM admin_faq WHERE qus LIKE ? OR answers LIKE ? LIMIT 5',
                    [searchTerm, searchTerm]
                );

                return {
                    success: true,
                    count: faqs.length,
                    faqs: faqs.map(f => ({ question: f.qus, answer: f.answers }))
                };
            }

            case 'get_portfolio': {
                const limit = Math.min(Number(args.limit) || 6, 12);
                let query = 'SELECT id, title, description, project_url FROM admin_portfolio';
                let params = [];

                if (args.search_term && args.search_term.trim()) {
                    const term = `%${args.search_term.trim()}%`;
                    query += ' WHERE title LIKE ? OR description LIKE ?';
                    params.push(term, term);
                }
                query += ' ORDER BY id DESC LIMIT ?';
                params.push(limit);

                const [projects] = await db.query(query, params);
                return {
                    success: true,
                    count: projects.length,
                    portfolio: projects
                };
            }

            case 'get_latest_updates': {
                const limit = Math.min(Number(args.limit) || 5, 10);
                const [updates] = await db.query(
                    'SELECT id, update_date, title, description FROM admin_latest_updates ORDER BY update_date DESC LIMIT ?',
                    [limit]
                );
                return {
                    success: true,
                    count: updates.length,
                    updates
                };
            }

            case 'create_lead': {
                const {
                    name,
                    email,
                    phone,
                    service,
                    company_name,
                    business_type,
                    project_type,
                    project_description,
                    budget_range,
                    timeline,
                    preferred_contact_method,
                    intent
                } = args;

                if (!email && !phone) {
                    return { success: false, message: 'Email or phone is required to create a lead.' };
                }

                const leadScoreResult = calculateLeadScore({
                    project_description,
                    project_type,
                    budget_range,
                    timeline,
                    email,
                    phone,
                    intent: intent || 'quote_request',
                    service: service || 'General Inquiry'
                });

                // Update ai_conversations table if conversationId exists
                if (conversationId || sessionId) {
                    await db.query(
                        `UPDATE ai_conversations SET
                            user_name = COALESCE(?, user_name),
                            user_email = COALESCE(?, user_email),
                            user_phone = COALESCE(?, user_phone),
                            company_name = COALESCE(?, company_name),
                            business_type = COALESCE(?, business_type),
                            project_type = COALESCE(?, project_type),
                            project_description = COALESCE(?, project_description),
                            budget_range = COALESCE(?, budget_range),
                            timeline = COALESCE(?, timeline),
                            preferred_contact_method = COALESCE(?, preferred_contact_method),
                            detected_service = COALESCE(?, detected_service),
                            intent = COALESCE(?, intent),
                            lead_score = ?,
                            lead_status = ?
                        WHERE id = ? OR session_id = ?`,
                        [
                            name || null, email || null, phone || null, company_name || null,
                            business_type || null, project_type || null, project_description || null,
                            budget_range || null, timeline || null, preferred_contact_method || null,
                            service || null, intent || 'quote_request',
                            leadScoreResult.score, leadScoreResult.status,
                            conversationId || 0, sessionId || ''
                        ]
                    );
                }

                // Check if lead already exists by email/phone or create new
                let existingLead = [];
                if (email) {
                    [existingLead] = await db.query('SELECT id FROM admin_leads WHERE email = ? LIMIT 1', [email]);
                }

                let leadId;
                if (existingLead.length > 0) {
                    leadId = existingLead[0].id;
                    await db.query(
                        `UPDATE admin_leads SET
                            name = COALESCE(?, name),
                            phone = COALESCE(?, phone),
                            service = COALESCE(?, service),
                            company_name = COALESCE(?, company_name),
                            business_type = COALESCE(?, business_type),
                            project_type = COALESCE(?, project_type),
                            project_description = COALESCE(?, project_description),
                            budget_range = COALESCE(?, budget_range),
                            timeline = COALESCE(?, timeline),
                            lead_score = ?,
                            lead_status = ?,
                            conversation_id = COALESCE(?, conversation_id)
                        WHERE id = ?`,
                        [
                            name || null, phone || null, service || null, company_name || null,
                            business_type || null, project_type || null, project_description || null,
                            budget_range || null, timeline || null, leadScoreResult.score,
                            leadScoreResult.status, conversationId || null, leadId
                        ]
                    );
                } else {
                    const [insertResult] = await db.query(
                        `INSERT INTO admin_leads (
                            name, email, phone, service, source,
                            company_name, business_type, project_type, project_description,
                            budget_range, timeline, lead_score, lead_status, preferred_contact_method, conversation_id
                        ) VALUES (?, ?, ?, ?, 'AI Assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            name || 'Anonymous Visitor',
                            email || 'N/A',
                            phone || 'N/A',
                            service || 'General Inquiry',
                            company_name || null,
                            business_type || null,
                            project_type || null,
                            project_description || null,
                            budget_range || null,
                            timeline || null,
                            leadScoreResult.score,
                            leadScoreResult.status,
                            preferred_contact_method || 'email',
                            conversationId || null
                        ]
                    );
                    leadId = insertResult.insertId;
                }

                // Trigger email notification asynchronously
                sendEmail({
                    subject: `🎯 New AI Lead (${leadScoreResult.status.toUpperCase()} - Score: ${leadScoreResult.score}): ${name || email}`,
                    html: `
                        <h2>New AI Assistant Lead Captured</h2>
                        <p><strong>Name:</strong> ${name || 'N/A'}</p>
                        <p><strong>Email:</strong> ${email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
                        <p><strong>Service:</strong> ${service || 'General'}</p>
                        <p><strong>Company:</strong> ${company_name || 'N/A'}</p>
                        <p><strong>Budget:</strong> ${budget_range || 'N/A'}</p>
                        <p><strong>Timeline:</strong> ${timeline || 'N/A'}</p>
                        <p><strong>Requirements:</strong> ${project_description || 'N/A'}</p>
                        <p><strong>Lead Score:</strong> ${leadScoreResult.score} (${leadScoreResult.status.toUpperCase()})</p>
                    `
                }).catch(err => console.error('Error sending lead notification email:', err));

                return {
                    success: true,
                    lead_id: leadId,
                    score: leadScoreResult.score,
                    status: leadScoreResult.status,
                    message: 'Lead saved successfully in BTR system.'
                };
            }

            case 'update_conversation': {
                if (!sessionId && !conversationId) return { success: false, message: 'No active session' };

                const { detected_service, business_type, project_type, budget_range, timeline, intent, ai_summary } = args;

                await db.query(
                    `UPDATE ai_conversations SET
                        detected_service = COALESCE(?, detected_service),
                        business_type = COALESCE(?, business_type),
                        project_type = COALESCE(?, project_type),
                        budget_range = COALESCE(?, budget_range),
                        timeline = COALESCE(?, timeline),
                        intent = COALESCE(?, intent),
                        ai_summary = COALESCE(?, ai_summary)
                    WHERE id = ? OR session_id = ?`,
                    [
                        detected_service || null, business_type || null, project_type || null,
                        budget_range || null, timeline || null, intent || null, ai_summary || null,
                        conversationId || 0, sessionId || ''
                    ]
                );

                return { success: true, message: 'Conversation updated' };
            }

            case 'request_human_agent': {
                const { reason, contact_preference } = args;

                if (conversationId || sessionId) {
                    await db.query(
                        `UPDATE ai_conversations SET
                            status = 'handoff_requested',
                            preferred_contact_method = COALESCE(?, preferred_contact_method)
                        WHERE id = ? OR session_id = ?`,
                        [contact_preference || null, conversationId || 0, sessionId || '']
                    );
                }

                sendEmail({
                    subject: `🚨 BTR Chatbot: Human Assistance Requested`,
                    html: `
                        <h3>Visitor Requested Human Agent Assistance</h3>
                        <p><strong>Session:</strong> ${sessionId || 'N/A'}</p>
                        <p><strong>Reason:</strong> ${reason || 'Customer inquiry'}</p>
                        <p><strong>Contact Preference:</strong> ${contact_preference || 'Not specified'}</p>
                    `
                }).catch(err => console.error('Error sending handoff email:', err));

                return {
                    success: true,
                    message: 'Human handoff request logged and notified.'
                };
            }

            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        console.error(`Tool Execution Error for '${toolName}':`, error);
        return { success: false, error: error.message || 'Database execution error' };
    }
}

module.exports = {
    executeTool
};
