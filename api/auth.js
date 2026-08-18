const { ADMIN_SECRET } = require('./_storage');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ success: false, message: 'Admin password is required' });
    }

    if (password === ADMIN_SECRET) {
      return res.status(200).json({
        success: true,
        message: 'Authentication successful',
        token: Buffer.from(`${ADMIN_SECRET}:${Date.now()}`).toString('base64'),
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server authentication error' });
  }
};
