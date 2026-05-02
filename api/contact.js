// /api/contact — Submit contact messages
const supabase = require('./_lib/supabase');
const { cors } = require('./_lib/auth');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, subject, message } = req.body || {};

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const { error } = await supabase.from('contact_messages').insert({
    name: name.trim().slice(0, 100),
    email: email.trim().toLowerCase().slice(0, 150),
    subject: subject?.trim().slice(0, 255) || 'General Inquiry',
    message: message.trim().slice(0, 5000)
  });

  if (error) return res.status(500).json({ error: 'Failed to save message. Please try again.' });

  return res.status(201).json({ message: 'Message sent successfully!' });
};
