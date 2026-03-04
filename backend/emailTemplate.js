module.exports = function generateEmailHTML(inviteeName, inviterName, role, acceptUrl, rejectUrl) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You have been invited to Byteforgenet</title>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        background-color: #f7f9fc;
        margin: 0;
        padding: 0;
        line-height: 1.6;
      }
      .wrapper {
        width: 100%;
        background-color: #f7f9fc;
        padding: 40px 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #080c16 0%, #1a1f33 100%);
        padding: 40px 30px;
        text-align: center;
        border-bottom: 4px solid #4f8cff;
      }
      .header h1 {
        margin: 0;
        color: #ffffff;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 1px;
      }
      .content {
        padding: 40px 40px;
        color: #4a5568;
      }
      .content h2 {
        color: #2d3748;
        font-size: 22px;
        margin-top: 0;
        margin-bottom: 24px;
        font-weight: 600;
      }
      .content p {
        font-size: 16px;
        margin-bottom: 20px;
      }
      .highlight {
        color: #2b6cb0;
        font-weight: 600;
      }
      .role-badge {
        display: inline-block;
        background-color: #ebf4ff;
        color: #4f8cff;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-top: 10px;
      }
      .action-buttons {
        text-align: center;
        margin: 40px 0;
      }
      .btn {
        display: inline-block;
        padding: 14px 32px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s ease;
      }
      .btn-accept {
        background-color: #4f8cff;
        color: #ffffff !important;
        box-shadow: 0 4px 6px rgba(79, 140, 255, 0.25);
        margin-right: 15px;
      }
      .btn-reject {
        background-color: #f7fafc;
        color: #718096 !important;
        border: 1px solid #e2e8f0;
      }
      .signature {
        margin-top: 40px;
        border-top: 1px solid #edf2f7;
        padding-top: 25px;
      }
      .signature p {
        margin: 0;
        font-size: 16px;
      }
      .footer {
        background-color: #f8fafc;
        padding: 24px;
        text-align: center;
        font-size: 13px;
        color: #a0aec0;
        border-top: 1px solid #edf2f7;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        
        <div class="header">
          <h1>Byteforgenet</h1>
        </div>
        
        <div class="content">
          <h2>Official Invitation</h2>
          <p>Dear <strong>${inviteeName}</strong>,</p>
          
          <p>You have been officially invited by <strong>${inviterName}</strong> to join the <strong>Byteforgenet Team</strong> workspace.</p>
          
          <p>We are excited to welcome you to our collaborative environment. Upon accepting this invitation, you will be granted access to the project dashboard, centralized notes, and task management channels.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #718096; text-transform: uppercase; letter-spacing: 1px;">Assigned Role</p>
            <span class="role-badge">${role}</span>
          </div>

          <div class="action-buttons">
            <a href="${acceptUrl}" class="btn btn-accept">Accept Invitation</a>
            <a href="${rejectUrl}" class="btn btn-reject">Decline</a>
          </div>

          <div class="signature">
            <p>Sincerely,</p>
            <p style="font-weight: 700; color: #2d3748; margin-top: 8px;">The Byteforgenet Team</p>
          </div>
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} Byteforgenet Enterprise Web. All rights reserved.<br>
          If you received this email in error, please disregard it or click decline.
        </div>
        
      </div>
    </div>
  </body>
  </html>
  `;
};
