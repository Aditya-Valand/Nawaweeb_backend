const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send a general email (used for welcome, password reset, etc.)
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"Nawaweeb" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html || ''
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

exports.sendEmail = sendEmail;
exports.sendOrderEmails = async (order) => {
  // 1. Email to YOU (Admin)
  await transporter.sendMail({
    from: `"Nawaweeb Admin" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🚨 NEW CLAN ORDER: ${order.productName}`,
    html: `<h3>New Order Details</h3>
           <p>Product: ${order.productName} (${order.orderType})</p>
           <p>Contact: ${order.customerContact}</p>
           <p>Size: ${order.size}</p>`
  });

  // 2. Email to CUSTOMER (Confirmation)
  // Only send customer email when contact looks like an email address
  if (order.customerContact && order.customerContact.includes('@')) {
    await transporter.sendMail({
      from: `"Nawaweeb Clan" <${process.env.EMAIL_USER}>`,
      to: order.customerContact,
      subject: `Your Nawaweeb Request is Received!`,
      html: `<h1>Welcome to the Clan</h1>
             <p>We received your request for the <b>${order.productName}</b>.</p>
             <p>Our artisans are reviewing it. We will contact you shortly to confirm payment.</p>`
    });
  }
};

exports.getResetPasswordTemplate = (resetLink) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #047857; text-align: center;">Reset Your Password</h2>
      <p>You requested a password reset for your Nawaweeb account.</p>
      <p style="text-align: center;">
        <a href="${resetLink}" style="background-color: #047857; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      </p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This link will expire in 10 minutes.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #888; text-align: center;">Nawaweeb Clan</p>
    </div>
  `;
};