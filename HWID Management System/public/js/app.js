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

    // Quick URL Banner
    quickUrlDisplay: document.getElementById('quickUrlDisplay'),
    copyQuickUrlBtn: document.getElementById('copyQuickUrlBtn'),
    viewRawLink: document.getElementById('viewRawLink'),

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

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.adminSecret}`,
      'x-admin-secret': state.adminSecret,
    };
  }

  // --------------------------------------------------------------------------
  // API Calls
  // --------------------------------------------------------------------------

  async function fetchHWIDs() {
    try {
      const res = await fetch('/api/hwids', {
        headers: getAuthHeaders(),
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
      }
    } catch (error) {
      console.error('Error fetching HWIDs:', error);
      showToast('Failed to load HWIDs: ' + error.message, 'error');
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
        fetchHWIDs();
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
        fetchHWIDs();
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
    try {
      const res = await fetch('/api/hwids', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, name, hwid }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || `User deleted and removed from raw text!`, 'success');
        fetchHWIDs();
        return true;
      } else {
        showToast(json.message || 'Failed to delete user record', 'error');
        return false;
      }
    } catch (error) {
      showToast('Error deleting HWID: ' + error.message, 'error');
      return false;
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
    const rawUrl = getRawUrl();
    const code = `bool cHardwareId::CheckHWIDLock()
{
    this->matchedName = ""; // Reset matched name

    // Fetches live active users from your Vercel HWID Management System
    std::string hwidListRaw = this->GetHWIDList("${rawUrl}");

    if (hwidListRaw.empty()) {
        return false;
    }

    std::istringstream iss(hwidListRaw);
    std::string line;
    std::string currentHWID = this->GetSerial();

    while (std::getline(iss, line)) {
        if (line.empty()) continue;

        size_t delimiter = line.find(':');
        if (delimiter != std::string::npos) {
            std::string name = line.substr(0, delimiter);
            std::string hwid = line.substr(delimiter + 1);

            name = CUtils::get()->Trim(name);
            hwid = CUtils::get()->Trim(hwid);

            if (hwid == currentHWID) {
                this->matchedName = name;
                return true;
            }
        }
    }

    return false; // No match found
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
          targetInput.value = d.toISOString().slice(0, 16);
        } else if (preset === '7d') {
          const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          targetInput.value = d.toISOString().slice(0, 16);
        } else if (preset === '30d') {
          const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          targetInput.value = d.toISOString().slice(0, 16);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  function initEventListeners() {
    // Quick URL Copy
    const rawUrl = getRawUrl();
    elements.quickUrlDisplay.textContent = rawUrl;
    elements.viewRawLink.href = rawUrl;

    elements.copyQuickUrlBtn.addEventListener('click', () => {
      copyToClipboard(rawUrl, 'Raw endpoint URL copied!');
    });

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
    openEdit: (id) => {
      const item = state.hwids.find((r) => r.id === id);
      if (!item) return;

      elements.editIdInput.value = item.id;
      elements.editNameInput.value = item.name;
      elements.editHwidInput.value = item.hwid;
      elements.editStatusSelect.value = item.status || 'active';
      elements.editNotesInput.value = item.notes || '';
      elements.editExpiryInput.value = item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : '';

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
