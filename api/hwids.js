const {
  ADMIN_SECRET,
  getStorageType,
  hasCloudPersistence,
  getAllHWIDs,
  saveAllHWIDs,
  isExpired,
  formatHWID,
  parseJsonBody,
  getQueryParams,
} = require('./_storage');

function checkAuth(req) {
  // Direct Access Enabled (No PIN restriction)
  return true;
}

// Generate unique ID
function generateId() {
  return 'hwid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret, x-sync-database');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce auth
  if (!checkAuth(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Invalid admin token.' });
  }

  try {
    let records = await getAllHWIDs();
    const query = getQueryParams(req);

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
        hasCloudPersistence: hasCloudPersistence(),
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
    // POST /api/hwids - Add single, bulk, sync, or action: 'delete'
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      // Fallback action: 'delete'
      if (body.action === 'delete') {
        const targetId = body.id || query.id;
        const targetName = body.name || query.name;
        const targetHwid = body.hwid || query.hwid;

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

        await saveAllHWIDs(records);
        const deletedNames = deletedItems.map((i) => i.name).join(', ') || 'User';

        return res.status(200).json({
          success: true,
          message: `Successfully deleted ${deletedNames} and removed from raw text!`,
          deletedCount: deletedItems.length,
          data: records,
        });
      }

      // Full Sync / Restore
      if (body.action === 'sync' && Array.isArray(body.records)) {
        records = body.records;
        await saveAllHWIDs(records);
        return res.status(200).json({
          success: true,
          message: `Database synchronized! ${records.length} records active.`,
          count: records.length,
          data: records,
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
          data: records,
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
      const targetId = (body && body.id) || query.id;
      const targetName = (body && body.name) || query.name;
      const targetHwid = (body && body.hwid) || query.hwid;

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
        // If not found in memory, still return 200 with message so UI doesn't get stuck
        return res.status(200).json({
          success: true,
          message: 'User already removed or not found.',
        });
      }

      await saveAllHWIDs(records);

      const deletedNames = deletedItems.map((i) => i.name).join(', ') || 'User';
      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${deletedNames} and removed from raw text list!`,
        deletedCount: deletedItems.length,
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('API Error in /api/hwids:', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
};
