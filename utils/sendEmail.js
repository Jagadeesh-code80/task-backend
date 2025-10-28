const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

/**
 * Setup reusable transporter using environment variables
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Register common Handlebars helpers (like eq, upper, date formatting)
 */
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('upper', str => (str || '').toUpperCase());
handlebars.registerHelper('lower', str => (str || '').toLowerCase());
handlebars.registerHelper('currentYear', () => new Date().getFullYear());

/**
 * Send dynamic email using a specified HTML template
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Subject line
 * @param {string} templateName - HTML filename (without .html)
 * @param {object} context - Variables to inject into template
 */
exports.sendMail = async (to, subject, templateName, context = {}) => {
  try {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`❌ Template not found: ${templateName}.html`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    // Add universal variables automatically
    const data = {
      ...context,
      year: new Date().getFullYear(),
      appName: 'TaskManagement',
    };

    const html = compiledTemplate(data);

    const mailOptions = {
      from: `"${data.companyName || 'TaskManagement'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} using template "${templateName}"`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};
