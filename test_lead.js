const db = require('./db');
db.query(
  'INSERT INTO admin_leads (name, email, phone, service, pricing_plan, source, chat_transcript) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ['Test', 'test@test.com', '1234567890', 'Web Development', null, 'Chat Assistant', '[{"from":"bot","text":"hi"}]']
).then(([r]) => { console.log('OK:', r.insertId); process.exit(0); })
.catch(e => { console.error('ERROR:', e.message, e.code); process.exit(1); });
