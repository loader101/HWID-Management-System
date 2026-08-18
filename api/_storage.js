const fs = require('fs');
const path = require('path');

// Environment Variables for Cloud Persistence
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const JSONBIN_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_ID = process.env.JSONBIN_BIN_ID;

const KV_KEY = 'HWID_DATABASE';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'hwids.json');
const TMP_DATA_FILE = path.join('/tmp', 'hwids.json');

// In-memory fallback across warm serverless invocations
let memoryCache = null;

// Determine storage type
function getStorageType() {
  if (KV_URL && KV_TOKEN) return 'Upstash Redis / Vercel KV';
  if (GITHUB_TOKEN && GIST_ID) return 'GitHub Gist';
  if (JSONBIN_KEY && JSONBIN_ID) return 'JSONBin.io';
  return 'Local / Ephemeral (Vercel Serverless)';
}

// --------------------------------------------------------------------------
// 1. Upstash Redis / Vercel KV REST
// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// 2. GitHub Gist REST (Alternative)
// --------------------------------------------------------------------------
async function getFromGist() {
  if (!GITHUB_TOKEN || !GIST_ID) return null;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'HWID-Manager',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const file = json.files && json.files['hwids.json'];
    if (file && file.content) {
      return JSON.parse(file.content);
    }
    return null;
  } catch (err) {
    console.error('Error reading from Gist:', err);
    return null;
  }
}

async function saveToGist(records) {
  if (!GITHUB_TOKEN || !GIST_ID) return false;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'HWID-Manager',
      },
      body: JSON.stringify({
        files: {
          'hwids.json': {
            content: JSON.stringify(records, null, 2),
          },
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Error saving to Gist:', err);
    return false;
  }
}

// --------------------------------------------------------------------------
// 3. Local File / /tmp Fallback
// --------------------------------------------------------------------------
function readFromFile() {
  // Check /tmp first (since it holds the latest changes in current serverless container)
  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const content = fs.readFileSync(TMP_DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // Check memory cache
  if (memoryCache && Array.isArray(memoryCache) && memoryCache.length > 0) {
    return memoryCache;
  }

  // Check local data directory
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const content = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {}

  return [
    {
      id: "hwid_init_1",
      name: "Admin_Jaymian",
      hwid: "4944-4444-4444-4444",
      status: "active",
      expiresAt: null,
      createdAt: "2026-08-19T00:00:00.000Z",
      notes: "Owner / Administrator Access"
    },
    {
      id: "hwid_init_2",
      name: "VipUser_Juan",
      hwid: "61A3-8B54-96B2-7777",
      status: "active",
      expiresAt: null,
      createdAt: "2026-08-19T00:00:00.000Z",
      notes: "VIP Access"
    }
  ];
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
  } catch (e) {}

  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
    saved = true;
  } catch (e) {}

  memoryCache = records;
  return saved;
}

// --------------------------------------------------------------------------
// Unified Storage API
// --------------------------------------------------------------------------
async function getAllHWIDs() {
  // 1. Check Upstash / Vercel KV
  if (KV_URL && KV_TOKEN) {
    const kvData = await getFromKV();
    if (kvData && Array.isArray(kvData)) {
      memoryCache = kvData;
      return kvData;
    }
    // If KV is newly linked and empty, initialize it with current data
    const local = readFromFile();
    if (local && local.length > 0) {
      await saveToKV(local);
      memoryCache = local;
      return local;
    }
  }

  // 2. Check GitHub Gist
  if (GITHUB_TOKEN && GIST_ID) {
    const gistData = await getFromGist();
    if (gistData && Array.isArray(gistData)) {
      memoryCache = gistData;
      return gistData;
    }
  }

  // 3. Fallback to /tmp / local file / memory cache
  const data = readFromFile();
  memoryCache = data;
  return data;
}

async function saveAllHWIDs(records) {
  memoryCache = records;
  if (KV_URL && KV_TOKEN) {
    await saveToKV(records);
  }
  if (GITHUB_TOKEN && GIST_ID) {
    await saveToGist(records);
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

// Robust Body Parser for Vercel Serverless Functions
async function parseJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
  }

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = {
  ADMIN_SECRET,
  getStorageType,
  getAllHWIDs,
  saveAllHWIDs,
  isExpired,
  formatHWID,
  getActiveRawList,
  parseJsonBody,
};
