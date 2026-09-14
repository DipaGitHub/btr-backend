/**
 * Gemini Function / Tool Declarations for BTR Communication AI Assistant.
 */

const geminiTools = [
    {
        functionDeclarations: [
            {
                name: 'get_services',
                description: 'Retrieve the list of all currently active BTR services offered to clients (e.g. Web Development, SEO, App Development, etc.).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        limit: {
                            type: 'NUMBER',
                            description: 'Optional maximum number of services to return (default is 15).'
                        }
                    }
                }
            },
            {
                name: 'get_service_details',
                description: 'Retrieve detailed information about a specific BTR service including description, features, workflow, and deliverables.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        service_id: {
                            type: 'NUMBER',
                            description: 'The numeric ID of the service (optional if service_name or slug is provided).'
                        },
                        service_name: {
                            type: 'STRING',
                            description: 'The name or keyword of the service (e.g. "Web Development", "SEO", "Mobile App").'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'get_pricing',
                description: 'Search official BTR pricing plans and packages for a given service or category.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        category_or_service: {
                            type: 'STRING',
                            description: 'The category or service name to filter pricing plans by (e.g. "Web Development", "SEO", "E-Commerce"). If omitted, all active pricing packages are returned.'
                        }
                    }
                }
            },
            {
                name: 'search_faq',
                description: 'Search BTR frequently asked questions (FAQs) for answers to client questions regarding process, maintenance, support, technologies, etc.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: {
                            type: 'STRING',
                            description: 'The question or keywords to search FAQs for (e.g. "support", "hosting", "payment", "time to build").'
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'get_portfolio',
                description: 'Retrieve past projects and case studies completed by BTR Communication to showcase to the client.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        search_term: {
                            type: 'STRING',
                            description: 'Keyword or service type to filter portfolio items (e.g. "ecommerce", "clinic", "education", "corporate").'
                        },
                        limit: {
                            type: 'NUMBER',
                            description: 'Maximum number of portfolio items to return (default 6).'
                        }
                    }
                }
            },
            {
                name: 'get_latest_updates',
                description: 'Retrieve recent company news, announcements, service launches, or updates from BTR Communication.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        limit: {
                            type: 'NUMBER',
                            description: 'Maximum number of updates to return (default 5).'
                        }
                    }
                }
            },
            {
                name: 'create_lead',
                description: 'Save or update a qualified sales lead in BTR database when the visitor provides contact details and project requirements.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        name: {
                            type: 'STRING',
                            description: 'Visitor full name'
                        },
                        email: {
                            type: 'STRING',
                            description: 'Visitor email address'
                        },
                        phone: {
                            type: 'STRING',
                            description: 'Visitor phone number or WhatsApp number'
                        },
                        service: {
                            type: 'STRING',
                            description: 'The primary service the visitor is interested in (e.g. "Web Development", "Digital Marketing")'
                        },
                        company_name: {
                            type: 'STRING',
                            description: 'Visitor company or organization name if mentioned'
                        },
                        business_type: {
                            type: 'STRING',
                            description: 'Industry or business type (e.g. "Retail", "Healthcare", "Startup")'
                        },
                        project_description: {
                            type: 'STRING',
                            description: 'Summary of the requirements, features, and scope discussed'
                        },
                        budget_range: {
                            type: 'STRING',
                            description: 'Estimated budget mentioned by the user (e.g. "$1000 - $3000", "2 Lakh INR")'
                        },
                        timeline: {
                            type: 'STRING',
                            description: 'Desired project timeline or deadline (e.g. "30 days", "Q3 2026")'
                        },
                        preferred_contact_method: {
                            type: 'STRING',
                            description: 'Preferred contact method: "email", "phone", "whatsapp"'
                        },
                        intent: {
                            type: 'STRING',
                            description: 'Lead intent: "quote_request", "consultation", "general_inquiry", "support"'
                        }
                    },
                    required: ['email']
                }
            },
            {
                name: 'update_conversation',
                description: 'Update structured intelligence fields on the ongoing conversation record (e.g. detected service, budget, timeline, intent summary).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        detected_service: { type: 'STRING' },
                        business_type: { type: 'STRING' },
                        project_type: { type: 'STRING' },
                        budget_range: { type: 'STRING' },
                        timeline: { type: 'STRING' },
                        intent: { type: 'STRING' },
                        ai_summary: { type: 'STRING', description: 'Concise 1-2 sentence summary of user conversation so far.' }
                    }
                }
            },
            {
                name: 'request_human_agent',
                description: 'Initiate a human handoff request when the user wants to speak to a human representative or schedule an in-person call.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        reason: {
                            type: 'STRING',
                            description: 'Reason for human handoff request'
                        },
                        contact_preference: {
                            type: 'STRING',
                            description: 'How they prefer to be contacted (phone, email, whatsapp, meeting)'
                        }
                    },
                    required: ['reason']
                }
            }
        ]
    }
];

module.exports = {
    geminiTools
};
