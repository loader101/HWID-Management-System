const {
  getAllHWIDs,
  isExpired,
  formatHWID,
  normalizeHWID,
  parseJsonBody,
  getQueryParams,
} = require('./_storage');

function formatExpiryDisplay(expiresAt) {
  if (!expiresAt) return 'Lifetime';
  try {
    const expDate = new Date(expiresAt);
    const expTime = expDate.getTime();
    if (isNaN(expTime)) return 'Lifetime';
    const now = Date.now();
    const diffMs = expTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${expDate.getFullYear()}-${pad(expDate.getMonth() + 1)}-${pad(expDate.getDate())}`;

    if (diffMs <= 0) {
      return `${dateStr} (Expired)`;
    } else if (diffDays === 1) {
      return `${dateStr} (1 Day Left)`;
    } else {
      return `${dateStr} (${diffDays} Days Left)`;
    }
  } catch (e) {
    return 'Lifetime';
  }
}

function getDaysRemaining(expiresAt) {
  if (!expiresAt) return -1; // -1 represents Lifetime
  try {
    const expDate = new Date(expiresAt);
    const expTime = expDate.getTime();
    if (isNaN(expTime)) return -1;
    const now = Date.now();
    const diffMs = expTime - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch (e) {
    return -1;
  }
}

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
      return res.status(200).send('AUTH_FAILED:Missing HWID Parameter:N/A:error');
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
          user: 'Unknown User',
          expiresAt: 'N/A',
          expiresDisplay: 'N/A',
          daysRemaining: 0,
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('AUTH_FAILED:Not Registered:N/A:unregistered');
    }

    const cleanUserName = (found.name || 'User').trim();
    const expiryDisplay = formatExpiryDisplay(found.expiresAt);
    const daysLeft = getDaysRemaining(found.expiresAt);

    // 2. Suspended
    if (found.status === 'suspended') {
      if (wantsJson) {
        return res.status(403).json({
          valid: false,
          status: 'suspended',
          message: 'License has been suspended by administrator',
          user: cleanUserName,
          hwid: found.hwid,
          expiresAt: found.expiresAt || 'Lifetime',
          expiresDisplay: expiryDisplay,
          daysRemaining: daysLeft,
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`AUTH_SUSPENDED:${cleanUserName}:${expiryDisplay}:suspended`);
    }

    // 3. Expired
    if (isExpired(found.expiresAt)) {
      if (wantsJson) {
        return res.status(403).json({
          valid: false,
          status: 'expired',
          message: 'License duration has expired',
          user: cleanUserName,
          hwid: found.hwid,
          expiresAt: found.expiresAt,
          expiresDisplay: expiryDisplay,
          daysRemaining: 0,
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`AUTH_EXPIRED:${cleanUserName}:${expiryDisplay}:expired`);
    }

    // 4. Authorized Active User
    if (wantsJson) {
      return res.status(200).json({
        valid: true,
        status: 'active',
        message: 'License is active and authorized',
        user: cleanUserName,
        hwid: found.hwid,
        expiresAt: found.expiresAt || 'Lifetime',
        expiresDisplay: expiryDisplay,
        daysRemaining: daysLeft,
      });
    }

    // Default Plain Text format for HardwareId.cpp
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(`AUTH_OK:${cleanUserName}:${expiryDisplay}:active`);
  } catch (error) {
    console.error('Error in /api/verify handler:', error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('AUTH_FAILED:Internal Server Error:N/A:error');
  }
};
