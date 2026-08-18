const {
  ADMIN_SECRET,
  getStorageType,
  getAllHWIDs,
  saveAllHWIDs,
  isExpired,
  formatHWID,
  parseJsonBody,
} = require('./_storage');

function checkAuth(req) {
  const authHeader = req.headers['authorization'];
  const secretHeader = req.headers['x-admin-secret'];
  
  if (secretHeader && secretHeader === ADMIN_SECRET) return true;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret, x-sync-database');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce auth
  if (!checkAuth(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Invalid admin token.' });
  }

  try {
    let records = await getAllHWIDs();

    // Check if client provided full sync database
    const syncHeader = req.headers['x-sync-database'];
    if (syncHeader) {
      try {
        const decodedSync = JSON.parse(Buffer.from(syncHeader, 'base64').toString('utf8'));
        if (Array.isArray(decodedSync) && decodedSync.length > records.length) {
          records = decodedSync;
          await saveAllHWIDs(records);
        }
      } catch (e) {}
    }

    // ------------------------------------------------------------------------
    // GET /api/hwids - List all HWIDs + computed stats & storage status
    // ------------------------------------------------------------------------
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
        storageType: getStorageType(),
        stats: {
          total: records.length,
          active: activeCount,
          expired: expiredCount,
          suspended: suspendedCount,
        },
      });
    }

    // Safely parse JSON body for POST, PUT, DELETE
    const body = await parseJsonBody(req);

    // ------------------------------------------------------------------------
    // POST /api/hwids - Add single, bulk, or full sync
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      // Full Sync / Restore
      if (body.action === 'sync' && Array.isArray(body.records)) {
        records = body.records;
        await saveAllHWIDs(records);
        return res.status(200).json({
          success: true,
          message: `Database synchronized! ${records.length} records active.`,
          count: records.length,
        });
      }

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

    // ------------------------------------------------------------------------
    // PUT /api/hwids - Update record
    // ------------------------------------------------------------------------
    if (req.method === 'PUT') {
      const { id, name, hwid, status, expiresAt, notes } = body;

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

    // ------------------------------------------------------------------------
    // DELETE /api/hwids - Delete record by ID, Username, or HWID
    // ------------------------------------------------------------------------
    if (req.method === 'DELETE') {
      const { id, name, hwid } = body;
      const queryId = req.query && req.query.id;
      const targetId = id || queryId;
      const targetName = name || (req.query && req.query.name);
      const targetHwid = hwid || (req.query && req.query.hwid);

      if (!targetId && !targetName && !targetHwid) {
        return res.status(400).json({ success: false, message: 'Record ID, Username, or HWID is required.' });
      }

      const initialLen = records.length;
      const deletedItems = [];

      records = records.filter((r) => {
        const matchId = targetId && (r.id === targetId || r.hwid === targetId);
        const matchName = targetName && r.name && r.name.trim().toLowerCase() === targetName.trim().toLowerCase();
        const matchHwid = targetHwid && formatHWID(r.hwid) === formatHWID(targetHwid);

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
