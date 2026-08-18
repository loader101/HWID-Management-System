const {
  ADMIN_SECRET,
  getAllHWIDs,
  saveAllHWIDs,
  isExpired,
  formatHWID,
} = require('./_storage');

function checkAuth(req) {
  const authHeader = req.headers['authorization'];
  const secretHeader = req.headers['x-admin-secret'];
  
  if (secretHeader && secretHeader === ADMIN_SECRET) return true;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === ADMIN_SECRET) return true;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      if (decoded.startsWith(`${ADMIN_SECRET}:`)) return true;
    } catch (e) {}
  }
  return false;
}

// Generate unique ID
function generateId() {
  return 'hwid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce auth
  if (!checkAuth(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Invalid admin token.' });
  }

  try {
    let records = await getAllHWIDs();

    // GET /api/hwids - List all HWIDs + computed stats
    if (req.method === 'GET') {
      let activeCount = 0;
      let expiredCount = 0;
      let suspendedCount = 0;

      const processed = records.map((item) => {
        const expired = isExpired(item.expiresAt);
        const status = expired ? 'expired' : item.status || 'active';

        if (status === 'active') activeCount++;
        else if (status === 'expired') expiredCount++;
        else if (status === 'suspended') suspendedCount++;

        return {
          ...item,
          isExpired: expired,
          effectiveStatus: status,
        };
      });

      return res.status(200).json({
        success: true,
        data: processed,
        stats: {
          total: records.length,
          active: activeCount,
          expired: expiredCount,
          suspended: suspendedCount,
        },
      });
    }

    // POST /api/hwids - Add single or bulk HWIDs
    if (req.method === 'POST') {
      const body = req.body || {};

      // Handle Bulk Add
      if (Array.isArray(body.bulk)) {
        const added = [];
        const duplicates = [];

        for (const entry of body.bulk) {
          if (!entry.name || !entry.hwid) continue;
          const cleanHwid = formatHWID(entry.hwid);
          const cleanName = entry.name.trim();

          const exists = records.some((r) => formatHWID(r.hwid) === cleanHwid);
          if (exists) {
            duplicates.push({ name: cleanName, hwid: cleanHwid });
            continue;
          }

          const newRecord = {
            id: generateId(),
            name: cleanName,
            hwid: cleanHwid,
            status: entry.status || 'active',
            expiresAt: entry.expiresAt || null,
            createdAt: new Date().toISOString(),
            notes: entry.notes || 'Bulk imported',
          };
          records.unshift(newRecord);
          added.push(newRecord);
        }

        await saveAllHWIDs(records);
        return res.status(200).json({
          success: true,
          message: `Successfully added ${added.length} HWID(s).`,
          addedCount: added.length,
          duplicatesCount: duplicates.length,
          duplicates,
        });
      }

      // Handle Single Add
      const { name, hwid, status = 'active', expiresAt = null, notes = '' } = body;

      if (!name || !hwid) {
        return res.status(400).json({ success: false, message: 'Name and HWID are required.' });
      }

      const cleanHwid = formatHWID(hwid);
      const cleanName = name.trim();

      const existingIndex = records.findIndex((r) => formatHWID(r.hwid) === cleanHwid);
      if (existingIndex !== -1) {
        return res.status(409).json({
          success: false,
          message: `HWID is already registered under username "${records[existingIndex].name}".`,
          existing: records[existingIndex],
        });
      }

      const newRecord = {
        id: generateId(),
        name: cleanName,
        hwid: cleanHwid,
        status: status === 'suspended' ? 'suspended' : 'active',
        expiresAt: expiresAt || null,
        createdAt: new Date().toISOString(),
        notes: notes.trim(),
      };

      records.unshift(newRecord);
      await saveAllHWIDs(records);

      return res.status(201).json({
        success: true,
        message: `HWID activated successfully for ${cleanName}!`,
        data: newRecord,
      });
    }

    // PUT /api/hwids - Update record
    if (req.method === 'PUT') {
      const { id, name, hwid, status, expiresAt, notes } = req.body || {};

      if (!id) {
        return res.status(400).json({ success: false, message: 'Record ID is required for update.' });
      }

      const index = records.findIndex((r) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'HWID record not found.' });
      }

      if (name !== undefined) records[index].name = name.trim();
      if (hwid !== undefined) records[index].hwid = formatHWID(hwid);
      if (status !== undefined) records[index].status = status;
      if (expiresAt !== undefined) records[index].expiresAt = expiresAt;
      if (notes !== undefined) records[index].notes = notes.trim();
      records[index].updatedAt = new Date().toISOString();

      await saveAllHWIDs(records);

      return res.status(200).json({
        success: true,
        message: 'HWID record updated successfully.',
        data: records[index],
      });
    }

    // DELETE /api/hwids - Delete record
    if (req.method === 'DELETE') {
      const { id, name, hwid } = req.body || req.query || {};

      if (!id && !name && !hwid) {
        return res.status(400).json({ success: false, message: 'Record ID, Username, or HWID is required.' });
      }

      const initialLen = records.length;
      const deletedItems = [];

      records = records.filter((r) => {
        const matchId = id && (r.id === id || r.hwid === id);
        const matchName = name && r.name && r.name.trim().toLowerCase() === name.trim().toLowerCase();
        const matchHwid = hwid && formatHWID(r.hwid) === formatHWID(hwid);

        if (matchId || matchName || matchHwid) {
          deletedItems.push(r);
          return false;
        }
        return true;
      });

      if (records.length === initialLen) {
        return res.status(404).json({ success: false, message: 'No matching user or HWID record found.' });
      }

      await saveAllHWIDs(records);

      const deletedNames = deletedItems.map((i) => i.name).join(', ');
      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${deletedNames || 'user'} and removed from raw text list!`,
        deletedCount: deletedItems.length,
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('API Error in /api/hwids:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
};
