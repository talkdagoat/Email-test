const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

// Uses the simplified hotmail routing helper for active Outlook accounts
const transporter = nodemailer.createTransport({
  service: 'hotmail', 
  auth: {
    user: process.env.OUTLOOK_USER,     // Your personal Outlook address
    pass: process.env.OUTLOOK_APP_PASS  // Your 16-character Microsoft App Password
  }
});

app.use(express.json());

// Serves index.html directly from your main root directory folder layout
app.use(express.static(__dirname));

const verificationSessions = {};

// Send verification link endpoint
app.post('/api/auth/send-link', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const token = crypto.randomBytes(32).toString('hex');
  verificationSessions[email] = { token, verified: false };

  const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  const magicLink = `${hostUrl}/verify?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    await transporter.sendMail({
      from: process.env.OUTLOOK_USER, 
      to: email, 
      subject: 'Sign In Link Verification',
      html: `<p>Click <a href="${magicLink}">here</a> to verify your account.</p>`
    });
    res.json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error("SMTP Error Details:", error);
    res.status(500).json({ error: 'Failed to complete mail transmission.' });
  }
});

// Link verification processor
app.get('/verify', (req, res) => {
  const { token, email } = req.query;
  const session = verificationSessions[email];

  if (session && session.token === token) {
    session.verified = true;
    res.send('<h1>Verified! Return to your login screen tab.</h1>');
  } else {
    res.status(400).send('<h1>Link expired or token mismatch.</h1>');
  }
});

// Frontend status polling
app.get('/api/auth/status', (req, res) => {
  const { email } = req.query;
  const session = verificationSessions[email];

  if (session && session.verified) {
    delete verificationSessions[email];
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server explicitly running on port ${PORT}`));
