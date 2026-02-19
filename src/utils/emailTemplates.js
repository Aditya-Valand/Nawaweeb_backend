/**
 * Email Templates for Nawaweeb
 */

const getResetPasswordTemplate = (resetLink) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #1a1a1a;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #000000;
      color: #ffffff;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #333333;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 15px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #dee2e6;
    }
    .link-text {
      font-size: 12px;
      color: #6c757d;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nawaweeb Clan</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your Nawaweeb account. If you didn't make this request, you can safely ignore this email.</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>
      
      <p>This link will expire in 10 minutes for your security.</p>
      
      <p>Best regards,<br>The Nawaweeb Team</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      
      <div class="link-text">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><a href="${resetLink}" style="color: #6c757d;">${resetLink}</a></p>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Nawaweeb. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = {
    getResetPasswordTemplate
};
