const nodemailer = require('nodemailer');
const db = require('../db');

/**
 * Utility to send an email using settings from admin_email_config.
 * Falls back to info@btrcommunication.com if not configured.
 * @param {Object} mailOptions { subject, text, html }
 */
async function sendEmail(mailOptions) {
    try {
        const [rows] = await db.query('SELECT * FROM admin_email_config LIMIT 1');
        const config = rows[0] || {};
        
        const fallbackEmail = 'info@btrcommunication.com';
        const receiveEmailAt = config.receive_emails_at || fallbackEmail;

        if (!config.host || !config.username || !config.password) {
            console.warn('SMTP is not fully configured in admin_email_config. Falling back to simple logging for:', mailOptions.subject);
            // In a real environment with no SMTP, we might just log it.
            // But if there's no SMTP, nodemailer can't send it anyway.
            console.log(`[Email Attempt] To: ${receiveEmailAt}, Subject: ${mailOptions.subject}`);
            return false;
        }

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port || 465,
            secure: config.port == 465, // true for 465, false for other ports
            auth: {
                user: config.username,
                pass: config.password
            }
        });

        const fullMailOptions = {
            from: `"BTR Admin System" <${config.username}>`,
            to: receiveEmailAt,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
        };

        const info = await transporter.sendMail(fullMailOptions);
        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

module.exports = sendEmail;
