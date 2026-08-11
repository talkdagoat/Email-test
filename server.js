const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const verificationSessions = {};

app.post('/api/auth/send-link', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const token = crypto.randomBytes(32).toString('hex');
  verificationSessions[email] = { token, verified: false };

  const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  const magicLink = `${hostUrl}/verify?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    // The server handles the email dispatch to completely bypass Safari blocks
    const emailjsResponse = await fetch('https://emailjs.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: "rfbFho74v6R1nSzk5",
            service_id: "talkapp",
            template_id: "template_er3zdx5",
            template_params: {
                to_email: email,
                verification_link: magicLink
            }
        })
    });

    if (emailjsResponse.ok) {
        res.json({ message: 'Email sent successfully!' });
    } else {
        const mailError = await emailjsResponse.text();
        res.status(500).json({ error: 'EmailJS Error: ' + mailError });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server network error: ' + err.message });
  }
});

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
