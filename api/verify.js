const {
  getAllHWIDs,
  isExpired,
  formatHWID,
  normalizeHWID,
  parseJsonBody,
  getQueryParams,
} = require('./_storage');

module.exports = async function handler(req, res) {
  // CORS & Anti-Cache Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = getQueryParams(req);
    const body = await parseJsonBody(req);
    const queryHWID = query.hwid || (body && body.hwid);
    const wantsJson = (query.format === 'json') || (req.headers['accept'] && req.headers['accept'].includes('application/json'));

    if (!queryHWID) {
      if (wantsJson) {
        return res.status(400).json({
          valid: false,
          status: 'error',
          message: 'Parameter "hwid" is required (e.g. /api/verify?hwid=XXXX-XXXX-XXXX-XXXX)',
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('AUTH_FAILED:Missing HWID Parameter');
    }

    const cleanTarget = formatHWID(queryHWID);
    const normTarget = normalizeHWID(queryHWID);
    const records = await getAllHWIDs();
    const found = records.find((r) => formatHWID(r.hwid) === cleanTarget || normalizeHWID(r.hwid) === normTarget);

    // 1. Not Found
    if (!found) {
      if (wantsJson) {
        return res.status(404).json({
          valid: false,
          status: 'not_found',
          message: 'HWID is not registered in system',
          hwid: cleanTarget,
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('AUTH_FAILED:Not Registered');
    }

    // 2. Suspended
    if (found.status === 'suspended') {
      if (wantsJson) {
        return res.status(403).json({
          valid: false,
          status: 'suspended',
          message: 'License has been suspended by administrator',
          user: found.name,
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('AUTH_DENIED:Suspended');
    }

    // 3. Expired
    if (isExpired(found.expiresAt)) {
      if (wantsJson) {
        return res.status(403).json({
          valid: false,
          status: 'expired',
          message: 'License duration has expired',
          user: found.name,
          expiredAt: found.expiresAt,
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('AUTH_DENIED:Expired');
    }

    // 4. Authorized Active User
    const cleanUserName = (found.name || 'User').trim();

    if (wantsJson) {
      return res.status(200).json({
        valid: true,
        status: 'active',
        user: cleanUserName,
        hwid: found.hwid,
        expiresAt: found.expiresAt || 'Lifetime',
      });
    }

    // Default Plain Text format for HardwareId.cpp
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(`AUTH_OK:${cleanUserName}`);
  } catch (error) {
    console.error('Error in /api/verify handler:', error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('AUTH_FAILED:Internal Server Error');
  }
};
