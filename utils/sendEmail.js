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
 * Handlebars helpers
 */
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('upper', str => (str || '').toUpperCase());
handlebars.registerHelper('lower', str => (str || '').toLowerCase());
handlebars.registerHelper('currentYear', () => new Date().getFullYear());

/**
 * Send dynamic email with CC support
 *
 * @param {string} to - Recipient email
 * @param {string} subject - Subject line
 * @param {string} templateName - HTML template name (without extension)
 * @param {object} context - Template variables
 * @param {string|string[]} cc - Optional CC email(s)
 */
exports.sendMail = async (to, subject, templateName, context = {}, cc = null) => {
  try {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`❌ Template not found: ${templateName}.html`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    // Common variables added to template
    const data = {
      ...context,
      year: new Date().getFullYear(),
      appName: 'TaskManagement',
    };

    const html = compiledTemplate(data);

    // Build mail options
    const mailOptions = {
      from: `"${data.companyName || 'TaskManagement'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    // Add CC only if provided
    if (cc) {
      mailOptions.cc = cc;
    }

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} using template "${templateName}"`);
    if (cc) console.log(`📨 CC added: ${cc}`);

  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};
