const { getAllHWIDs, isExpired, formatHWID } = require('./_storage');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryHWID = req.query.hwid || (req.body && req.body.hwid);

  if (!queryHWID) {
    return res.status(400).json({
      valid: false,
      message: 'Parameter "hwid" is required (e.g. ?hwid=XXXX-XXXX-XXXX-XXXX)',
    });
  }

  const cleanTarget = formatHWID(queryHWID);
  const records = await getAllHWIDs();
  const found = records.find((r) => formatHWID(r.hwid) === cleanTarget);

  if (!found) {
    return res.status(404).json({
      valid: false,
      message: 'HWID not found / unauthorized',
      hwid: cleanTarget,
    });
  }

  if (found.status === 'suspended') {
    return res.status(403).json({
      valid: false,
      status: 'suspended',
      message: 'Account license has been suspended',
      user: found.name,
    });
  }

  if (isExpired(found.expiresAt)) {
    return res.status(403).json({
      valid: false,
      status: 'expired',
      message: 'Account license has expired',
      user: found.name,
      expiredAt: found.expiresAt,
    });
  }

  return res.status(200).json({
    valid: true,
    status: 'active',
    user: found.name,
    hwid: found.hwid,
    expiresAt: found.expiresAt || 'Lifetime',
  });
};
