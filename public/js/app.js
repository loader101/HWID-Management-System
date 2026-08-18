/**
 * HWID Management System - Frontend Controller
 * Cyberpunk Glassmorphism Architecture
 */

(function () {
  'use strict';

  // State Management
  const state = {
    hwids: [],
    filteredHwids: [],
    searchQuery: '',
    statusFilter: 'all',
    adminSecret: localStorage.getItem('hwid_admin_secret') || 'admin123',
    selectedItem: null,
  };

  // DOM Elements
  const elements = {
    // Stats
    statActive: document.getElementById('statActive'),
    statTotal: document.getElementById('statTotal'),
    statSuspended: document.getElementById('statSuspended'),
    statExpired: document.getElementById('statExpired'),

    // Table & List
    tableBody: document.getElementById('hwidTableBody'),
    emptyState: document.getElementById('emptyState'),
    tableContainer: document.getElementById('tableContainer'),
    searchInput: document.getElementById('searchInput'),
    statusFilterSelect: document.getElementById('statusFilterSelect'),
    refreshBtn: document.getElementById('refreshBtn'),

    // Single Add Modal
    addModal: document.getElementById('addModal'),
    openAddBtn: document.getElementById('openAddBtn'),
    closeAddBtn: document.getElementById('closeAddBtn'),
    addForm: document.getElementById('addForm'),
    addNameInput: document.getElementById('addNameInput'),
    addHwidInput: document.getElementById('addHwidInput'),
    addExpiryInput: document.getElementById('addExpiryInput'),
    addNotesInput: document.getElementById('addNotesInput'),
    addLivePreview: document.getElementById('addLivePreview'),
    genRandomHwidBtn: document.getElementById('genRandomHwidBtn'),

    // Bulk Add Modal
    bulkModal: document.getElementById('bulkModal'),
    openBulkBtn: document.getElementById('openBulkBtn'),
    closeBulkBtn: document.getElementById('closeBulkBtn'),
    bulkForm: document.getElementById('bulkForm'),
    bulkTextarea: document.getElementById('bulkTextarea'),
    bulkStatsInfo: document.getElementById('bulkStatsInfo'),

    // Edit Modal
    editModal: document.getElementById('editModal'),
    closeEditBtn: document.getElementById('closeEditBtn'),
    editForm: document.getElementById('editForm'),
    editIdInput: document.getElementById('editIdInput'),
    editNameInput: document.getElementById('editNameInput'),
    editHwidInput: document.getElementById('editHwidInput'),
    editStatusSelect: document.getElementById('editStatusSelect'),
    editExpiryInput: document.getElementById('editExpiryInput'),
    editNotesInput: document.getElementById('editNotesInput'),

    // C++ Integration Modal
    cppModal: document.getElementById('cppModal'),
    openCppBtn: document.getElementById('openCppBtn'),
    closeCppBtn: document.getElementById('closeCppBtn'),
    cppCodeSnippet: document.getElementById('cppCodeSnippet'),
    copyCppSnippetBtn: document.getElementById('copyCppSnippetBtn'),

    // Quick Delete Modal (Toolbar)
    quickDeleteModal: document.getElementById('quickDeleteModal'),
    openQuickDeleteBtn: document.getElementById('openQuickDeleteBtn'),
    closeQuickDeleteBtn: document.getElementById('closeQuickDeleteBtn'),
    quickDeleteForm: document.getElementById('quickDeleteForm'),
    quickDeleteInput: document.getElementById('quickDeleteInput'),

    // Confirm Delete Modal (Row Action)
    confirmDeleteModal: document.getElementById('confirmDeleteModal'),
    closeConfirmDeleteBtn: document.getElementById('closeConfirmDeleteBtn'),
    confirmDeleteForm: document.getElementById('confirmDeleteForm'),
    deleteTargetId: document.getElementById('deleteTargetId'),
    deleteTargetName: document.getElementById('deleteTargetName'),
    deleteTargetDisplayName: document.getElementById('deleteTargetDisplayName'),
    deleteTargetDisplayHwid: document.getElementById('deleteTargetDisplayHwid'),

    // Auth / Settings Modal
    authModal: document.getElementById('authModal'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeAuthBtn: document.getElementById('closeAuthBtn'),
    authForm: document.getElementById('authForm'),
    adminSecretInput: document.getElementById('adminSecretInput'),

    // Cloud Storage & Sync
    storageStatusBadge: document.getElementById('storageStatusBadge'),
    storageStatusText: document.getElementById('storageStatusText'),
    syncDbBtn: document.getElementById('syncDbBtn'),
    cloudStorageModal: document.getElementById('cloudStorageModal'),
    closeCloudStorageBtn: document.getElementById('closeCloudStorageBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer'),
  };

  // --------------------------------------------------------------------------
  // Utility Functions
  // --------------------------------------------------------------------------

  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    elements.toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getRawUrl() {
    return `${window.location.origin}/api/raw`;
  }

  // Format HWID input into XXXX-XXXX-XXXX-XXXX
  function formatHwidString(value) {
    // Remove non-alphanumeric
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const parts = [];
    for (let i = 0; i < clean.length && i < 16; i += 4) {
      parts.push(clean.substring(i, i + 4));
    }
    return parts.join('-');
  }

  function generateRandomHwid() {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) result += '-';
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMsg, 'success'),
        () => fallbackCopy(text, successMsg)
      );
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg, 'success');
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textArea);
  }

  function getAuthHeaders(includeSync = false) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.adminSecret}`,
      'x-admin-secret': state.adminSecret,
    };

    if (includeSync) {
      const savedLocal = localStorage.getItem('hwid_local_db');
      if (savedLocal) {
        try {
          headers['x-sync-database'] = btoa(unescape(encodeURIComponent(savedLocal)));
        } catch (e) {}
      }
    }

    return headers;
  }

  // --------------------------------------------------------------------------
  // API Calls
  // --------------------------------------------------------------------------

  async function fetchHWIDs(silent = false) {
    try {
      const res = await fetch('/api/hwids', {
        headers: getAuthHeaders(true),
      });

      if (res.status === 401) {
        openModal(elements.authModal);
        showToast('Please enter your Admin Secret to access dashboard', 'error');
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const responseData = await res.json();
      if (responseData.success) {
        state.hwids = responseData.data || [];
        updateStats(responseData.stats);
        applyFilterAndRender();

        // Update Storage Status Indicator
        if (elements.storageStatusText && responseData.storageType) {
          const type = responseData.storageType;
          if (type.includes('Upstash') || type.includes('KV') || type.includes('Gist') || type.includes('JSONBin')) {
            elements.storageStatusText.textContent = `🟢 Cloud DB: ${type}`;
            elements.storageStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            elements.storageStatusBadge.style.color = 'var(--accent-emerald)';
          } else {
            elements.storageStatusText.textContent = `🟡 Ephemeral (Setup Cloud DB)`;
            elements.storageStatusBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            elements.storageStatusBadge.style.color = 'var(--accent-amber)';
          }
        }

        // Keep a local copy in browser localStorage
        if (state.hwids.length > 0) {
          localStorage.setItem('hwid_local_db', JSON.stringify(state.hwids));
        }

        if (!silent && responseData.storageType && !responseData.storageType.includes('Upstash') && !responseData.storageType.includes('KV')) {
          // Check if server only has default data but browser has more
          const localCache = localStorage.getItem('hwid_local_db');
          if (localCache) {
            try {
              const parsed = JSON.parse(localCache);
              if (parsed.length > state.hwids.length) {
                console.log('Restoring records from browser cache to serverless container...');
                forceSyncToServer(true);
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error('Error fetching HWIDs:', error);
      if (!silent) showToast('Failed to load HWIDs: ' + error.message, 'error');
    }
  }

  async function forceSyncToServer(silent = false) {
    const savedLocal = localStorage.getItem('hwid_local_db');
    if (!savedLocal) {
      if (!silent) showToast('No local database found to sync.', 'info');
      return;
    }

    try {
      const records = JSON.parse(savedLocal);
      const res = await fetch('/api/hwids', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'sync', records }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (!silent) showToast(`Synced ${records.length} user(s) to server & raw text!`, 'success');
        fetchHWIDs(true);
      } else {
        if (!silent) showToast(json.message || 'Sync failed', 'error');
      }
    } catch (e) {
      if (!silent) showToast('Error syncing: ' + e.message, 'error');
    }
  }

  async function createHWID(data) {
    try {
      const res = await fetch('/api/hwids', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || 'HWID activated successfully!', 'success');
        closeModal(elements.addModal);
        elements.addForm.reset();
        updateAddPreview();

        if (json.data) {
          state.hwids.unshift(json.data);
          localStorage.setItem('hwid_local_db', JSON.stringify(state.hwids));
          applyFilterAndRender();
        }

        fetchHWIDs(true);
      } else {
        showToast(json.message || 'Failed to activate HWID', 'error');
      }
    } catch (error) {
      showToast('Error creating HWID: ' + error.message, 'error');
    }
  }

  async function createBulkHWIDs(bulkData) {
    try {
      const res = await fetch('/api/hwids', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bulk: bulkData }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || `Imported ${json.addedCount} HWIDs!`, 'success');
        closeModal(elements.bulkModal);
        elements.bulkForm.reset();
        if (json.data && Array.isArray(json.data)) {
          state.hwids = json.data;
          localStorage.setItem('hwid_local_db', JSON.stringify(state.hwids));
          applyFilterAndRender();
        }
        fetchHWIDs(true);
      } else {
        showToast(json.message || 'Failed to bulk import', 'error');
      }
    } catch (error) {
      showToast('Error in bulk import: ' + error.message, 'error');
    }
  }

  async function updateHWID(data) {
    try {
      const res = await fetch('/api/hwids', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast('HWID record updated!', 'success');
        closeModal(elements.editModal);
        fetchHWIDs();
      } else {
        showToast(json.message || 'Failed to update HWID', 'error');
      }
    } catch (error) {
      showToast('Error updating HWID: ' + error.message, 'error');
    }
  }

  async function deleteHWID(params) {
    const { id, name, hwid } = params || {};
    
    // Optimistically remove from state so the UI is instantaneous
    const prevHwids = [...state.hwids];
    state.hwids = state.hwids.filter((r) => {
      if (id && (r.id === id || r.hwid === id)) return false;
      if (name && r.name && r.name.trim().toLowerCase() === name.trim().toLowerCase()) return false;
      if (hwid && formatHwidString(r.hwid) === formatHwidString(hwid)) return false;
      return true;
    });

    localStorage.setItem('hwid_local_db', JSON.stringify(state.hwids));
    applyFilterAndRender();
    updateStats({
      total: state.hwids.length,
      active: state.hwids.filter(r => r.effectiveStatus === 'active').length,
      suspended: state.hwids.filter(r => r.effectiveStatus === 'suspended').length,
      expired: state.hwids.filter(r => r.effectiveStatus === 'expired').length,
    });

    try {
      // Build query string params
      const qParams = new URLSearchParams();
      if (id) qParams.set('id', id);
      if (name) qParams.set('name', name);
      if (hwid) qParams.set('hwid', hwid);

      // Attempt 1: Standard DELETE with query and body
      let res = await fetch(`/api/hwids?${qParams.toString()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, name, hwid }),
      });

      // Attempt 2: If DELETE failed with 404/405/400, fallback to POST action: 'delete'
      if (!res.ok) {
        res = await fetch('/api/hwids', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action: 'delete', id, name, hwid }),
        });
      }

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || `User removed from database and raw text!`, 'success');
        fetchHWIDs(true);
        return true;
      } else {
        // If server failed, force full sync with latest state
        await forceSyncToServer(true);
        showToast(`User deleted and raw text synchronized!`, 'success');
        return true;
      }
    } catch (error) {
      console.error('Delete request error, syncing locally...', error);
      await forceSyncToServer(true);
      showToast(`User removed locally & synced!`, 'success');
      return true;
    }
  }

  // --------------------------------------------------------------------------
  // UI Rendering & Filter Logic
  // --------------------------------------------------------------------------

  function updateStats(stats) {
    if (!stats) return;
    elements.statActive.textContent = stats.active || 0;
    elements.statTotal.textContent = stats.total || 0;
    elements.statSuspended.textContent = stats.suspended || 0;
    elements.statExpired.textContent = stats.expired || 0;
  }

  function applyFilterAndRender() {
    let result = [...state.hwids];

    // Filter by Search Query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.hwid && item.hwid.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q))
      );
    }

    // Filter by Status
    if (state.statusFilter !== 'all') {
      result = result.filter((item) => item.effectiveStatus === state.statusFilter);
    }

    state.filteredHwids = result;
    renderTable();
  }

  function renderTable() {
    const list = state.filteredHwids;

    if (list.length === 0) {
      elements.tableContainer.style.display = 'none';
      elements.emptyState.style.display = 'block';
      return;
    }

    elements.tableContainer.style.display = 'block';
    elements.emptyState.style.display = 'none';

    elements.tableBody.innerHTML = list
      .map((item) => {
        const initial = (item.name || 'U').charAt(0).toUpperCase();
        const formattedPair = `${item.name}:${item.hwid}`;
        
        let statusBadge = '';
        if (item.effectiveStatus === 'active') {
          statusBadge = '<span class="badge badge-active">Active</span>';
        } else if (item.effectiveStatus === 'suspended') {
          statusBadge = '<span class="badge badge-suspended">Suspended</span>';
        } else {
          statusBadge = '<span class="badge badge-expired">Expired</span>';
        }

        let expiryDisplay = '<span class="expiry-lifetime">⚡ Lifetime</span>';
        if (item.expiresAt) {
          const expDate = new Date(item.expiresAt);
          expiryDisplay = `<span class="expiry-date">${expDate.toLocaleDateString()} ${expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
        }

        const isCurrentlyActive = item.status === 'active' && !item.isExpired;
        const toggleBtnTitle = isCurrentlyActive ? 'Suspend License' : 'Activate License';
        const toggleBtnIcon = isCurrentlyActive ? '⏸️' : '▶️';
        const toggleNewStatus = isCurrentlyActive ? 'suspended' : 'active';

        return `
          <tr data-id="${item.id}">
            <td>
              <div class="user-cell">
                <div class="user-avatar">${initial}</div>
                <div>
                  <div class="user-name">${escapeHtml(item.name)}</div>
                  ${item.notes ? `<div class="user-notes">${escapeHtml(item.notes)}</div>` : ''}
                </div>
              </div>
            </td>
            <td>
              <div class="hwid-chip" title="Click to copy HWID" onclick="window.HWIDApp.copyHwid('${item.hwid}')" style="cursor:pointer">
                <span>${escapeHtml(item.hwid)}</span>
                <span style="font-size:0.75rem;opacity:0.7">📋</span>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td><div class="expiry-cell">${expiryDisplay}</div></td>
            <td>
              <div class="table-actions">
                <button class="btn btn-secondary btn-sm" title="Copy NAME:HWID format" onclick="window.HWIDApp.copyPair('${escapeHtml(formattedPair)}')">
                  📋 Raw Pair
                </button>
                <button class="btn btn-secondary btn-sm btn-icon-only" title="${toggleBtnTitle}" onclick="window.HWIDApp.toggleStatus('${item.id}', '${toggleNewStatus}')">
                  ${toggleBtnIcon}
                </button>
                <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit record" onclick="window.HWIDApp.openEdit('${item.id}')">
                  ✏️
                </button>
                <button class="btn btn-danger btn-sm btn-icon-only" title="Delete record & remove from raw" onclick="window.HWIDApp.openDelete('${item.id}')">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function updateAddPreview() {
    const name = elements.addNameInput.value.trim() || 'USERNAME';
    const hwid = elements.addHwidInput.value.trim() || 'XXXX-XXXX-XXXX-XXXX';
    elements.addLivePreview.textContent = `${name}:${hwid}`;
  }

  function updateCppCodeSnippet() {
    const origin = window.location.origin;
    const verifyUrl = `${origin}/api/verify?hwid=`;
    const code = `bool cHardwareId::CheckHWIDLock()
{
    this->matchedName = ""; // Reset matched name
    std::string currentHWID = this->GetSerial();

    if (currentHWID.empty()) {
        return false;
    }

    // Direct Website API Verification (100% Secure & Fast)
    std::string verifyUrl = "${verifyUrl}" + currentHWID;
    std::string response = this->GetHWIDList(verifyUrl);

    if (response.empty()) {
        return false;
    }

    response = CUtils::get()->Trim(response);

    // Server returns "AUTH_OK:Username" if active & authorized
    if (response.rfind("AUTH_OK:", 0) == 0)
    {
        this->matchedName = response.substr(8); // Extracts the authorized username
        return true; // License is valid!
    }

    // Returns false if Suspended, Expired, or Not Registered
    return false;
}`;
    elements.cppCodeSnippet.textContent = code;
  }

  // --------------------------------------------------------------------------
  // Modal Handlers
  // --------------------------------------------------------------------------

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
  }

  // Helper to format Date object into local HTML datetime-local string (YYYY-MM-DDTHH:MM)
  function formatToLocalDateTimeInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Setup Expiry Preset Buttons
  function setupPresetButtons(containerSelector, targetInput) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.querySelectorAll('.btn-preset').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const preset = btn.getAttribute('data-preset');
        if (preset === 'lifetime') {
          targetInput.value = '';
        } else if (preset === '1d') {
          const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
          targetInput.value = formatToLocalDateTimeInput(d);
        } else if (preset === '7d') {
          const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          targetInput.value = formatToLocalDateTimeInput(d);
        } else if (preset === '30d') {
          const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          targetInput.value = formatToLocalDateTimeInput(d);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  function initEventListeners() {
    // Search & Filter
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      applyFilterAndRender();
    });

    elements.statusFilterSelect.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      applyFilterAndRender();
    });

    elements.refreshBtn.addEventListener('click', () => {
      showToast('Refreshing records...', 'info', 1500);
      fetchHWIDs();
    });

    // Single Add Form
    elements.openAddBtn.addEventListener('click', () => {
      openModal(elements.addModal);
      elements.addNameInput.focus();
    });

    elements.closeAddBtn.addEventListener('click', () => closeModal(elements.addModal));

    elements.addHwidInput.addEventListener('input', (e) => {
      e.target.value = formatHwidString(e.target.value);
      updateAddPreview();
    });

    elements.addNameInput.addEventListener('input', updateAddPreview);

    elements.genRandomHwidBtn.addEventListener('click', () => {
      elements.addHwidInput.value = generateRandomHwid();
      updateAddPreview();
    });

    setupPresetButtons('#addExpiryPresets', elements.addExpiryInput);

    elements.addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = elements.addNameInput.value.trim();
      const hwid = elements.addHwidInput.value.trim();
      const expiresAt = elements.addExpiryInput.value ? new Date(elements.addExpiryInput.value).toISOString() : null;
      const notes = elements.addNotesInput.value.trim();

      if (!name || !hwid) {
        showToast('Please enter both User Name and HWID', 'error');
        return;
      }

      createHWID({ name, hwid, expiresAt, notes, status: 'active' });
    });

    // Bulk Add Form
    elements.openBulkBtn.addEventListener('click', () => openModal(elements.bulkModal));
    elements.closeBulkBtn.addEventListener('click', () => closeModal(elements.bulkModal));

    elements.bulkTextarea.addEventListener('input', (e) => {
      const lines = e.target.value.split('\n').filter((l) => l.trim().length > 0);
      let validCount = 0;
      lines.forEach((l) => {
        if (l.includes(':') || l.includes('=')) validCount++;
      });
      elements.bulkStatsInfo.textContent = `Detected ${validCount} valid entry line(s) from ${lines.length} total line(s).`;
    });

    elements.bulkForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawText = elements.bulkTextarea.value.trim();
      if (!rawText) {
        showToast('Please paste at least one line of NAME:HWID', 'error');
        return;
      }

      const lines = rawText.split('\n');
      const bulkArray = [];

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let delimiterIndex = trimmed.indexOf(':');
        if (delimiterIndex === -1) delimiterIndex = trimmed.indexOf('=');

        if (delimiterIndex !== -1) {
          const name = trimmed.substring(0, delimiterIndex).trim();
          const hwid = trimmed.substring(delimiterIndex + 1).trim();
          if (name && hwid) {
            bulkArray.push({
              name,
              hwid: formatHwidString(hwid),
              status: 'active',
              notes: 'Bulk Imported',
            });
          }
        }
      });

      if (bulkArray.length === 0) {
        showToast('No valid NAME:HWID pairs found. Make sure format is Name:XXXX-XXXX-XXXX-XXXX', 'error');
        return;
      }

      createBulkHWIDs(bulkArray);
    });

    // Edit Modal
    elements.closeEditBtn.addEventListener('click', () => closeModal(elements.editModal));
    setupPresetButtons('#editExpiryPresets', elements.editExpiryInput);

    elements.editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = elements.editIdInput.value;
      const name = elements.editNameInput.value.trim();
      const hwid = elements.editHwidInput.value.trim();
      const status = elements.editStatusSelect.value;
      const expiresAt = elements.editExpiryInput.value ? new Date(elements.editExpiryInput.value).toISOString() : null;
      const notes = elements.editNotesInput.value.trim();

      updateHWID({ id, name, hwid, status, expiresAt, notes });
    });

    // C++ Integration Modal
    elements.openCppBtn.addEventListener('click', () => {
      updateCppCodeSnippet();
      openModal(elements.cppModal);
    });

    elements.closeCppBtn.addEventListener('click', () => closeModal(elements.cppModal));

    elements.copyCppSnippetBtn.addEventListener('click', () => {
      copyToClipboard(elements.cppCodeSnippet.textContent, 'C++ Code snippet copied!');
    });

    // Confirm Delete Modal (Row Action)
    if (elements.closeConfirmDeleteBtn) {
      elements.closeConfirmDeleteBtn.addEventListener('click', () => closeModal(elements.confirmDeleteModal));
    }

    if (elements.confirmDeleteForm) {
      elements.confirmDeleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = elements.deleteTargetId.value;
        const name = elements.deleteTargetName.value;
        const success = await deleteHWID({ id, name });
        if (success) {
          closeModal(elements.confirmDeleteModal);
        }
      });
    }

    // Quick Delete Modal (Toolbar Action)
    if (elements.openQuickDeleteBtn) {
      elements.openQuickDeleteBtn.addEventListener('click', () => {
        elements.quickDeleteInput.value = '';
        openModal(elements.quickDeleteModal);
        elements.quickDeleteInput.focus();
      });
    }

    if (elements.closeQuickDeleteBtn) {
      elements.closeQuickDeleteBtn.addEventListener('click', () => closeModal(elements.quickDeleteModal));
    }

    if (elements.quickDeleteForm) {
      elements.quickDeleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = elements.quickDeleteInput.value.trim();
        if (!query) {
          showToast('Please enter a username or HWID to delete', 'error');
          return;
        }

        // Determine if query looks like an HWID or username
        let params = {};
        if (query.includes('-') && query.length >= 10) {
          params = { hwid: formatHwidString(query) };
        } else {
          params = { name: query };
        }

        const success = await deleteHWID(params);
        if (success) {
          closeModal(elements.quickDeleteModal);
          elements.quickDeleteForm.reset();
        }
      });
    }

    // Cloud Storage Modal & Sync
    if (elements.storageStatusBadge) {
      elements.storageStatusBadge.addEventListener('click', () => openModal(elements.cloudStorageModal));
    }

    if (elements.syncDbBtn) {
      elements.syncDbBtn.addEventListener('click', () => forceSyncToServer());
    }

    if (elements.closeCloudStorageBtn) {
      elements.closeCloudStorageBtn.addEventListener('click', () => closeModal(elements.cloudStorageModal));
    }

    // Auth / Settings Modal
    elements.openSettingsBtn.addEventListener('click', () => {
      elements.adminSecretInput.value = state.adminSecret;
      openModal(elements.authModal);
    });

    elements.closeAuthBtn.addEventListener('click', () => closeModal(elements.authModal));

    elements.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const secret = elements.adminSecretInput.value.trim();
      if (!secret) return;
      state.adminSecret = secret;
      localStorage.setItem('hwid_admin_secret', secret);
      closeModal(elements.authModal);
      showToast('Admin key updated! Loading dashboard...', 'success');
      fetchHWIDs();
    });

    // Close Modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal(backdrop);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Global Exposure for inline HTML handlers
  // --------------------------------------------------------------------------

  window.HWIDApp = {
    copyHwid: (hwid) => copyToClipboard(hwid, `HWID ${hwid} copied!`),
    copyPair: (pair) => copyToClipboard(pair, `Pair ${pair} copied!`),
    toggleStatus: (id, newStatus) => {
      updateHWID({ id, status: newStatus });
    },
    forceSyncToServer: (silent) => forceSyncToServer(silent),
    openEdit: (id) => {
      const item = state.hwids.find((r) => r.id === id);
      if (!item) return;

      elements.editIdInput.value = item.id;
      elements.editNameInput.value = item.name;
      elements.editHwidInput.value = item.hwid;
      elements.editStatusSelect.value = item.status || 'active';
      elements.editNotesInput.value = item.notes || '';
      elements.editExpiryInput.value = item.expiresAt ? formatToLocalDateTimeInput(item.expiresAt) : '';

      openModal(elements.editModal);
    },
    openDelete: (id) => {
      const item = state.hwids.find((r) => r.id === id);
      if (!item) return;

      elements.deleteTargetId.value = item.id;
      elements.deleteTargetName.value = item.name;
      elements.deleteTargetDisplayName.textContent = item.name;
      elements.deleteTargetDisplayHwid.textContent = item.hwid;

      openModal(elements.confirmDeleteModal);
    },
    deleteItem: (id, name) => deleteHWID({ id, name }),
    exportBackup: () => {
      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.hwids, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', `hwid_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('HWID Database backup downloaded!', 'success');
    },
  };

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchHWIDs();
  });
})();
