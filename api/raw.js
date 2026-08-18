const { getActiveRawList, defaultSeedData } = require('./_storage');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let rawText = await getActiveRawList();

    // Fallback if empty
    if (!rawText || !rawText.trim()) {
      if (Array.isArray(defaultSeedData) && defaultSeedData.length > 0) {
        rawText = defaultSeedData
          .filter(d => d.status === 'active')
          .map(d => `${d.name}:${d.hwid}`)
          .join('\n');
      }
    }
    
    // Aggressive anti-caching headers for Vercel Edge & Cloudflare CDN
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    return res.status(200).send(rawText || '');
  } catch (error) {
    console.error('Error fetching raw HWID list:', error);
    // Even in error, return default seed lines
    const fallbackText = defaultSeedData.map(d => `${d.name}:${d.hwid}`).join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(fallbackText);
  }
};
