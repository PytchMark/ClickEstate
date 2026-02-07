const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    console.log('[Email] SMTP not configured, skipping email:', subject);
    return { ok: false, reason: 'SMTP not configured' };
  }
  
  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || 'ClickEstate <noreply@clickestate.com>',
      to,
      subject,
      html,
      text
    });
    console.log('[Email] Sent:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Error:', error.message);
    return { ok: false, error: error.message };
  }
}

async function sendViewingRequestNotification(request, realtorEmail) {
  const subject = `New Viewing Request: ${request.customer_name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ff3b30; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">ClickEstate</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">New Viewing Request</h2>
        <p style="color: #666;">You have received a new viewing request:</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Customer:</strong> ${request.customer_name}</p>
          <p><strong>Phone:</strong> ${request.customer_phone}</p>
          <p><strong>Email:</strong> ${request.customer_email || 'Not provided'}</p>
          <p><strong>Type:</strong> ${request.request_type}</p>
          <p><strong>Listing:</strong> ${request.listing_id || 'General inquiry'}</p>
          ${request.preferred_date ? `<p><strong>Preferred Date:</strong> ${request.preferred_date}</p>` : ''}
          ${request.preferred_time ? `<p><strong>Preferred Time:</strong> ${request.preferred_time}</p>` : ''}
          ${request.notes ? `<p><strong>Notes:</strong> ${request.notes}</p>` : ''}
        </div>
        <p style="color: #666;">Log in to your ClickEstate portal to respond to this request.</p>
      </div>
      <div style="background: #333; padding: 15px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">Powered by Pytch Marketing LLC</p>
      </div>
    </div>
  `;
  
  return sendEmail({ to: realtorEmail, subject, html });
}

async function sendStatusUpdateNotification(request, customerEmail) {
  if (!customerEmail) return { ok: false, reason: 'No customer email' };
  
  const statusMessages = {
    contacted: 'A realtor has reviewed your request and will contact you shortly.',
    booked: 'Your viewing has been booked! The realtor will confirm the details.',
    closed: 'Thank you for using ClickEstate. We hope you found your perfect property!'
  };
  
  const subject = `Viewing Request Update - ${request.request_id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ff3b30; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">ClickEstate</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">Request Update</h2>
        <p style="color: #666;">Your viewing request status has been updated to: <strong>${request.status}</strong></p>
        <p style="color: #666;">${statusMessages[request.status] || 'Your request is being processed.'}</p>
      </div>
    </div>
  `;
  
  return sendEmail({ to: customerEmail, subject, html });
}

module.exports = { sendEmail, sendViewingRequestNotification, sendStatusUpdateNotification };
