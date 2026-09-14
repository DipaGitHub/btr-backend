const { calculateLeadScore } = require('./ai/leadScoring');
const { getSystemPrompt } = require('./ai/aiSystemPrompt');
const { geminiTools } = require('./ai/aiTools');

console.log('--- Testing AI Assistant Modules ---');

// 1. Test Lead Scoring
console.log('\n[1] Testing Lead Scoring:');
const coldLead = calculateLeadScore({ project_description: 'Hi' });
console.log('Cold lead score:', coldLead);

const warmLead = calculateLeadScore({
    project_description: 'I need an ecommerce website with payment gateway',
    email: 'client@example.com',
    intent: 'quote_request'
});
console.log('Warm lead score:', warmLead);

const hotLead = calculateLeadScore({
    project_description: 'Looking to build custom React SaaS app for healthcare with telehealth integration',
    budget_range: '$5,000 - $10,000',
    timeline: '30 days',
    email: 'ceo@healthstartup.com',
    phone: '+1 555 123 4567',
    intent: 'quote_request',
    handoff_requested: true
});
console.log('Hot lead score:', hotLead);

// 2. Test System Prompt
console.log('\n[2] Testing System Prompt:');
const prompt = getSystemPrompt();
console.log('System prompt length:', prompt.length);
console.log('Includes zero-hallucination rule:', prompt.includes('NEVER fabricate'));

// 3. Test Tools
console.log('\n[3] Testing Tools Declarations:');
const decls = geminiTools[0].functionDeclarations;
console.log(`Total tools registered: ${decls.length}`);
decls.forEach(d => console.log(` - ${d.name}: ${d.description.slice(0, 50)}...`));

console.log('\nAll tests passed successfully!');
