import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Configure Nodemailer to route traffic via Microsoft Outlook
const transporter = nodemailer.createTransport({
  host: "://office365.com",
  port: 587,
  secure: false, // Required TLS configuration sequence
  auth: {
    user: process.env.OUTLOOK_USER,     // Your personal Outlook email address
    pass: process.env.OUTLOOK_APP_PASS  // Your 16-character Microsoft App Password
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());

// FIXED: Serves your index.html file straight from the main root directory folder layout
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
    // Send email using your personal Outlook account
    await transporter.sendMail({
      from: process.env.OUTLOOK_USER, 
      to: email, 
      subject: 'Sign In Link Verification',
      html: `<p>Click <a href="${magicLink}">here</a> to verify your account.</p>`
    });
    
    res.json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error("Outlook Transmission Failure:", error);
    res.status(500).json({ error: 'Failed to send mail via Outlook setup' });
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
app.listen(PORT, () => console.log(`Server executing successfully on port ${PORT}`));
