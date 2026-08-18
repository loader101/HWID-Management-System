const fs = require('fs');
const path = require('path');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_KEY = 'HWID_DATABASE';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'hwids.json');
const TMP_DATA_FILE = path.join('/tmp', 'hwids.json');

// In-memory fallback if no KV and filesystem is read-only
let memoryCache = null;

async function getFromKV() {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.result) {
      return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    }
    return null;
  } catch (err) {
    console.error('Error reading from KV:', err);
    return null;
  }
}

async function saveToKV(records) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(records)),
    });
    return res.ok;
  } catch (err) {
    console.error('Error saving to KV:', err);
    return false;
  }
}

function readFromFile() {
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const content = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    // Ignore, fallback to tmp
  }

  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const content = fs.readFileSync(TMP_DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    // Ignore
  }

  return memoryCache || [];
}

function saveToFile(records) {
  let saved = false;
  try {
    const dataDir = path.dirname(LOCAL_DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
    saved = true;
  } catch (e) {
    // Ignore if read-only
  }

  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
    saved = true;
  } catch (e) {
    // Ignore
  }

  memoryCache = records;
  return saved;
}

async function getAllHWIDs() {
  if (KV_URL && KV_TOKEN) {
    const kvData = await getFromKV();
    if (kvData && Array.isArray(kvData)) {
      return kvData;
    }
    // If KV is empty, initialize it from local file
    const local = readFromFile();
    if (local && local.length > 0) {
      await saveToKV(local);
      return local;
    }
    return [];
  }
  return readFromFile();
}

async function saveAllHWIDs(records) {
  memoryCache = records;
  if (KV_URL && KV_TOKEN) {
    await saveToKV(records);
  }
  saveToFile(records);
  return records;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  return expiry.getTime() < Date.now();
}

function formatHWID(hwid) {
  if (!hwid) return '';
  return hwid.trim().toUpperCase();
}

async function getActiveRawList() {
  const records = await getAllHWIDs();
  const activeLines = [];

  for (const item of records) {
    const status = (item.status || 'active').toLowerCase();
    const expired = isExpired(item.expiresAt);

    if (status === 'active' && !expired && item.name && item.hwid) {
      const cleanName = item.name.trim();
      const cleanHWID = formatHWID(item.hwid);
      activeLines.push(`${cleanName}:${cleanHWID}`);
    }
  }

  return activeLines.join('\n');
}

module.exports = {
  ADMIN_SECRET,
  getAllHWIDs,
  saveAllHWIDs,
  isExpired,
  formatHWID,
  getActiveRawList,
};
