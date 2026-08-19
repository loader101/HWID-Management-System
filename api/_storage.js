const fs = require('fs');
const path = require('path');
const url = require('url');

// Statically bundle default seed data so Vercel never misses data/hwids.json
let defaultSeedData = [];

try {
  const loaded = require('../data/hwids.json');
  if (Array.isArray(loaded)) {
    defaultSeedData = loaded;
  }
} catch (e) {
  defaultSeedData = [];
}

// Environment Variables for Cloud Persistence
function getKVUrl() {
  let url = process.env.KV_REST_API_URL || 
            process.env.UPSTASH_REDIS_REST_URL || 
            process.env.STORAGE_REDIS_REST_URL || 
            process.env.VERCEL_KV_REST_API_URL || 
            '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/+$/, '');
}

function getKVToken() {
  return process.env.KV_REST_API_TOKEN || 
         process.env.UPSTASH_REDIS_REST_TOKEN || 
         process.env.STORAGE_REDIS_REST_TOKEN || 
         process.env.VERCEL_KV_REST_API_TOKEN || 
         '';
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

const KV_KEY = 'HWID_DATABASE';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '0909';

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'hwids.json');
const TMP_DATA_FILE = path.join('/tmp', 'hwids.json');

let memoryCache = null;

// Determine storage type
function getStorageType() {
  const url = getKVUrl();
  const token = getKVToken();
  if (url && token) return 'Upstash Redis / Vercel KV';
  if (GITHUB_TOKEN && GIST_ID) return 'GitHub Gist';
  return 'Local / Ephemeral (Vercel Serverless)';
}

function hasCloudPersistence() {
  const url = getKVUrl();
  const token = getKVToken();
  return !!((url && token) || (GITHUB_TOKEN && GIST_ID));
}

// --------------------------------------------------------------------------
// 1. Upstash Redis / Vercel KV REST
// --------------------------------------------------------------------------
async function getFromKV() {
  const kvUrl = getKVUrl();
  const kvToken = getKVToken();
  if (!kvUrl || !kvToken) return null;

  try {
    // 1. Try Official Command Array POST / (["GET", "HWID_DATABASE"])
    let res = await fetch(kvUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', KV_KEY]),
    });

    // 2. Fallback to GET /get/KEY
    if (!res.ok) {
      res = await fetch(`${kvUrl}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
    }

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && data.result) {
      let val = data.result;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
          // Handle potential double stringification
          if (typeof val === 'string') {
            val = JSON.parse(val);
          }
        } catch (e) {}
      }
      if (Array.isArray(val)) return val;
    }
    return null;
  } catch (err) {
    console.error('Error reading from KV:', err);
    return null;
  }
}

async function saveToKV(records) {
  const kvUrl = getKVUrl();
  const kvToken = getKVToken();
  if (!kvUrl || !kvToken) return false;

  try {
    const jsonStr = JSON.stringify(records);

    // 1. Official Upstash REST Command: POST / with body ["SET", "HWID_DATABASE", "<value>"]
    let res = await fetch(kvUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', KV_KEY, jsonStr]),
    });

    // 2. Fallback to path-based: POST /set/KEY
    if (!res.ok) {
      res = await fetch(`${kvUrl}/set/${KV_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonStr),
      });
    }

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
  // DO NOT check memoryCache here — it causes stale reads across Vercel container instances.
  // Always read from disk so we get the freshest data available to this container.

  // Check /tmp first (holds latest changes written by this container)
  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const content = fs.readFileSync(TMP_DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  // Check local data directory
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const content = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  return defaultSeedData;
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
  const kvUrl = getKVUrl();
  const kvToken = getKVToken();

  // 1. Check Upstash / Vercel KV (source of truth when configured)
  if (kvUrl && kvToken) {
    const kvData = await getFromKV();
    if (kvData && Array.isArray(kvData) && kvData.length > 0) {
      saveToFile(kvData);
      return kvData;
    }
    // If KV returned empty/null, read from local / default
    const local = readFromFile();
    if (local && local.length > 0) {
      await saveToKV(local);
      return local;
    }
    return local || [];
  }

  // 2. Check GitHub Gist (source of truth when configured)
  if (GITHUB_TOKEN && GIST_ID) {
    const gistData = await getFromGist();
    if (gistData && Array.isArray(gistData) && gistData.length > 0) {
      saveToFile(gistData);
      return gistData;
    }
  }

  // 3. Fallback to /tmp / local file / defaultSeedData (ephemeral — no cloud persistence)
  return readFromFile();
}

async function saveAllHWIDs(records) {
  const kvUrl = getKVUrl();
  const kvToken = getKVToken();

  // Save to all configured cloud stores in parallel for speed
  const saves = [];
  if (kvUrl && kvToken) {
    saves.push(saveToKV(records));
  }
  if (GITHUB_TOKEN && GIST_ID) {
    saves.push(saveToGist(records));
  }
  // Write local file in parallel too
  saves.push(Promise.resolve(saveToFile(records)));
  await Promise.all(saves);
  return records;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  try {
    const expiry = new Date(expiresAt);
    const expTime = expiry.getTime();
    if (isNaN(expTime)) return false;
    return expTime < Date.now();
  } catch (e) {
    return false;
  }
}

function formatHWID(hwid) {
  if (!hwid) return '';
  return String(hwid).trim().toUpperCase();
}

function normalizeHWID(hwid) {
  if (!hwid) return '';
  return String(hwid).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

async function getActiveRawList() {
  const records = await getAllHWIDs();
  const activeLines = [];

  if (Array.isArray(records)) {
    for (const item of records) {
      if (!item) continue;
      const status = (item.status || 'active').toLowerCase();
      const expired = isExpired(item.expiresAt);

      if (status === 'active' && !expired && item.name && item.hwid) {
        const cleanName = String(item.name).trim();
        const cleanHWID = formatHWID(item.hwid);
        if (cleanName && cleanHWID) {
          activeLines.push(`${cleanName}:${cleanHWID}`);
        }
      }
    }
  }

  return activeLines.join('\n');
}

// Robust Body Parser for Vercel Serverless Functions
async function parseJsonBody(req) {
  if (!req) return {};
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

  if (typeof req.on !== 'function') {
    return {};
  }

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data || !data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Safely extract query parameters across Node and Vercel environments
function getQueryParams(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    return req.query;
  }
  try {
    const parsed = url.parse(req.url, true);
    return parsed.query || {};
  } catch (e) {
    return {};
  }
}

module.exports = {
  ADMIN_SECRET,
  defaultSeedData,
  getStorageType,
  hasCloudPersistence,
  getAllHWIDs,
  saveAllHWIDs,
  isExpired,
  formatHWID,
  normalizeHWID,
  getActiveRawList,
  parseJsonBody,
  getQueryParams,
};
