const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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