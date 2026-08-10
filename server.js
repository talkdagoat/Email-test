import express from 'express';
import { Resend } from 'resend';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Initialize Resend directly with your provided API key
const resend = new Resend('re_WMHLAo3u_4LktAv3M7bcvVuACDZLTVeSt');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Memory storage to track login states
const verificationSessions = {};

// Secure email dispatch routing
app.post('/api/auth/send-link', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const token = crypto.randomBytes(32).toString('hex');
  verificationSessions[email] = { token, verified: false };

  const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  const magicLink = `${hostUrl}/verify?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    // Send the verification link dynamically to the email entered by the user
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email, 
      subject: 'Hello World - Sign In Link',
      html: `<p>Congrats on sending your <strong>first email</strong>! Click <a href="${magicLink}">here</a> to verify your account.</p>`
    });
    
    res.json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error("Resend error:", error);
    res.status(500).json({ error: 'Failed to dispatch email' });
  }
});

// Verification tracking router link
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

// Front-end polling status checker
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
