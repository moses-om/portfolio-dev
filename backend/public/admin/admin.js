/**
 * MIRA KNOWLEDGE GOVERNANCE CONSOLE — CLIENT JAVASCRIPT
 * Zero dependencies, Vanilla ES6+, Fetch API.
 */

// Application State
const state = {
  activeTab: 'queue',
  stats: null,
  faqs: [],
  candidates: [],
  currentCandidate: null,
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  },
  filters: {
    status: 'ALL',
    classification: 'ALL',
    search: ''
  },
  batch: {
    queue: [],
    currentIndex: 0,
    size: 25,
    customSize: 25,
    stats: {
      promoted: 0,
      rejected: 0,
      kept: 0
    }
  },
  logs: [],
  logFilter: 'ALL',
  pendingAction: null
};

// Authentication helper for Governance API
function getAdminKey() {
  let key = sessionStorage.getItem('mira_admin_key');
  if (!key) {
    key = prompt('Enter MIRA Knowledge Governance Passkey:');
    if (key) {
      sessionStorage.setItem('mira_admin_key', key.trim());
    }
  }
  return key ? key.trim() : '';
}

async function authFetch(url, options = {}) {
  const key = getAdminKey();
  const headers = {
    ...(options.headers || {}),
    'x-admin-key': key
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    sessionStorage.removeItem('mira_admin_key');
    alert('Unauthorized: Invalid or missing Admin Passkey. Please authenticate.');
    throw new Error('HTTP 401: Unauthorized');
  }
  if (res.status === 503) {
    alert('Service Unavailable: Admin authentication is not configured on the backend.');
    throw new Error('HTTP 503: Admin authentication not configured.');
  }
  return res;
}

// API Client
const api = {
  async getStats() {
    const res = await authFetch('/api/admin/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch stats`);
    return await res.json();
  },

  async getFaqs() {
    const res = await authFetch('/api/admin/faqs');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch FAQs`);
    const data = await res.json();
    return data.faqs || [];
  },

  async createFaq(faqData) {
    const res = await authFetch('/api/admin/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(faqData)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create canonical FAQ.');
    }
    return data;
  },

  async updateFaq(faqId, updateData) {
    const res = await authFetch(`/api/admin/faqs/${encodeURIComponent(faqId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update canonical FAQ.');
    }
    return data;
  },

  async deleteFaq(faqId) {
    const res = await authFetch(`/api/admin/faqs/${encodeURIComponent(faqId)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete canonical FAQ.');
    }
    return data;
  },

  async deleteFaqVariant(faqId, variantText) {
    const res = await authFetch(`/api/admin/faqs/${encodeURIComponent(faqId)}/variants?variantText=${encodeURIComponent(variantText)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete variant.');
    }
    return data;
  },

  async getCandidates(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await authFetch(`/api/admin/candidates?${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch candidates`);
    return await res.json();
  },

  async getCandidateById(id) {
    const res = await authFetch(`/api/admin/candidates/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch candidate ${id}`);
    const data = await res.json();
    return data.candidate;
  },

  async getLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await authFetch(`/api/admin/log?${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit logs`);
    return await res.json();
  },

  async promote(candidateId, destinationFaqId) {
    const res = await authFetch('/api/admin/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, destinationFaqId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Promotion failed.');
    }
    return data;
  },

  async reject(candidateId) {
    const res = await authFetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Rejection failed.');
    }
    return data;
  },

  async keep(candidateId) {
    const res = await authFetch('/api/admin/keep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Keep for review failed.');
    }
    return data;
  }
};

// UI Elements
const el = {
  statusText: document.getElementById('statusText'),
  refreshAllBtn: document.getElementById('refreshAllBtn'),

  // Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  panes: {
    queue: document.getElementById('paneQueue'),
    batch: document.getElementById('paneBatch'),
    faqs: document.getElementById('paneFaqs'),
    provenance: document.getElementById('paneProvenance')
  },

  // Tab Badges
  queueTabCount: document.getElementById('queueTabCount'),
  batchTabCount: document.getElementById('batchTabCount'),
  faqsTabCount: document.getElementById('faqsTabCount'),
  logTabCount: document.getElementById('logTabCount'),

  // KPIs
  kpiCandidates: document.getElementById('kpiCandidates'),
  kpiFaqs: document.getElementById('kpiFaqs'),
  kpiVariants: document.getElementById('kpiVariants'),
  kpiDecisions: document.getElementById('kpiDecisions'),
  kpiEligible: document.getElementById('kpiEligible'),

  // Classification Strip
  clsCountDuplicate: document.getElementById('clsCountDuplicate'),
  clsCountSynthesis: document.getElementById('clsCountSynthesis'),
  clsCountReview: document.getElementById('clsCountReview'),
  clsCountGuardrail: document.getElementById('clsCountGuardrail'),
  clsCountScope: document.getElementById('clsCountScope'),

  // Queue Controls
  statusFilterControl: document.getElementById('statusFilterControl'),
  classificationFilterSelect: document.getElementById('classificationFilterSelect'),
  queueSearchInput: document.getElementById('queueSearchInput'),
  queueSearchClearBtn: document.getElementById('queueSearchClearBtn'),
  candidateTableBody: document.getElementById('candidateTableBody'),
  paginationInfo: document.getElementById('paginationInfo'),
  pageIndicator: document.getElementById('pageIndicator'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),

  // Batch Workstation
  batchHeading: document.getElementById('batchHeading'),
  batchSizeControl: document.getElementById('batchSizeControl'),
  customBatchSizeInput: document.getElementById('customBatchSizeInput'),
  batchRestartBtn: document.getElementById('batchRestartBtn'),
  batchProgressLabel: document.getElementById('batchProgressLabel'),
  batchProgressFill: document.getElementById('batchProgressFill'),
  workstationContainer: document.getElementById('workstationContainer'),
  batchCompleteScreen: document.getElementById('batchCompleteScreen'),
  batchCompleteDesc: document.getElementById('batchCompleteDesc'),
  completeBatchSizeControl: document.getElementById('completeBatchSizeControl'),
  completeCustomBatchSizeInput: document.getElementById('completeCustomBatchSizeInput'),

  wsCandidateStatus: document.getElementById('wsCandidateStatus'),
  wsCandidateId: document.getElementById('wsCandidateId'),
  wsConfidenceScore: document.getElementById('wsConfidenceScore'),
  wsModelUsed: document.getElementById('wsModelUsed'),
  wsOriginalQuery: document.getElementById('wsOriginalQuery'),
  wsCandidateAnswer: document.getElementById('wsCandidateAnswer'),
  wsClassificationTag: document.getElementById('wsClassificationTag'),
  wsQueryNature: document.getElementById('wsQueryNature'),
  wsRecommendation: document.getElementById('wsRecommendation'),
  wsReason: document.getElementById('wsReason'),
  wsGroundingEvidence: document.getElementById('wsGroundingEvidence'),
  wsFaqSelect: document.getElementById('wsFaqSelect'),
  wsFaqPreviewTitle: document.getElementById('wsFaqPreviewTitle'),
  wsFaqPreviewAnswer: document.getElementById('wsFaqPreviewAnswer'),
  wsFaqVariantsCount: document.getElementById('wsFaqVariantsCount'),

  wsPrevBtn: document.getElementById('wsPrevBtn'),
  wsRejectBtn: document.getElementById('wsRejectBtn'),
  wsKeepBtn: document.getElementById('wsKeepBtn'),
  wsPromoteBtn: document.getElementById('wsPromoteBtn'),
  wsNextBtn: document.getElementById('wsNextBtn'),

  batchStatPromoted: document.getElementById('batchStatPromoted'),
  batchStatRejected: document.getElementById('batchStatRejected'),
  batchStatKept: document.getElementById('batchStatKept'),
  batchStatRemaining: document.getElementById('batchStatRemaining'),
  batchReviewRemainingBtn: document.getElementById('batchReviewRemainingBtn'),
  batchReturnQueueBtn: document.getElementById('batchReturnQueueBtn'),

  // FAQs Tab & Modals
  faqSearchInput: document.getElementById('faqSearchInput'),
  openAddFaqModalBtn: document.getElementById('openAddFaqModalBtn'),
  faqsContainer: document.getElementById('faqsContainer'),

  faqEditModal: document.getElementById('faqEditModal'),
  faqModalBadge: document.getElementById('faqModalBadge'),
  faqModalTitle: document.getElementById('faqModalTitle'),
  faqModalCloseBtn: document.getElementById('faqModalCloseBtn'),
  faqModalCancelBtn: document.getElementById('faqModalCancelBtn'),
  faqModalSaveBtn: document.getElementById('faqModalSaveBtn'),
  faqFormId: document.getElementById('faqFormId'),
  faqFormCategory: document.getElementById('faqFormCategory'),
  faqFormAnchor: document.getElementById('faqFormAnchor'),
  faqFormAnswer: document.getElementById('faqFormAnswer'),
  faqFormVariants: document.getElementById('faqFormVariants'),

  faqDeleteModal: document.getElementById('faqDeleteModal'),
  faqDeleteModalCloseBtn: document.getElementById('faqDeleteModalCloseBtn'),
  faqDeleteModalCancelBtn: document.getElementById('faqDeleteModalCancelBtn'),
  faqDeleteModalConfirmBtn: document.getElementById('faqDeleteModalConfirmBtn'),
  faqDeleteModalPreview: document.getElementById('faqDeleteModalPreview'),

  // Logs
  logFilterControl: document.getElementById('logFilterControl'),
  logSearchInput: document.getElementById('logSearchInput'),
  logTableBody: document.getElementById('logTableBody'),

  // Modal
  actionModal: document.getElementById('actionModal'),
  modalActionBadge: document.getElementById('modalActionBadge'),
  modalTitle: document.getElementById('modalTitle'),
  modalPreview: document.getElementById('modalPreview'),
  modalAlert: document.getElementById('modalAlert'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  modalConfirmBtn: document.getElementById('modalConfirmBtn'),

  // Toasts
  toastContainer: document.getElementById('toastContainer')
};

// Toast Helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initial Data Load
async function initApp() {
  try {
    el.statusText.textContent = 'Connecting...';
    updateClassificationFilter(state.filters.classification);
    updateBatchSizeSelection(state.batch.size);
    await Promise.all([
      loadStats(),
      loadFaqs(),
      loadCandidates(),
      loadLogs()
    ]);
    el.statusText.textContent = 'System Active';
    showToast('Governance repository connected successfully.', 'success');
  } catch (err) {
    el.statusText.textContent = 'Error';
    console.error('Initialization Error:', err);
    showToast(`Connection failed: ${err.message}`, 'error');
  }
}

// Load KPIs & Stats
async function loadStats() {
  const data = await api.getStats();
  state.stats = data;

  el.kpiCandidates.textContent = data.totalCandidates || 0;
  el.kpiFaqs.textContent = data.totalVerifiedFaqs || 0;
  el.kpiVariants.textContent = data.totalQuestionVariants || 0;
  el.kpiDecisions.textContent = data.totalLoggedDecisions || 0;
  el.kpiEligible.textContent = data.eligibleForReview || 0;

  el.queueTabCount.textContent = data.totalCandidates || 0;
  el.batchTabCount.textContent = data.eligibleForReview || 0;
  el.faqsTabCount.textContent = data.totalVerifiedFaqs || 0;
  el.logTabCount.textContent = data.totalLoggedDecisions || 0;

  const cb = data.classificationBreakdown || {};
  el.clsCountDuplicate.textContent = cb.CANONICAL_DUPLICATE || 0;
  el.clsCountSynthesis.textContent = cb.CANONICAL_SUPPORTED_SYNTHESIS || 0;
  el.clsCountReview.textContent = cb.REQUIRES_REVIEW || 0;
  el.clsCountGuardrail.textContent = cb.GUARDRAIL_RESPONSE || 0;
  el.clsCountScope.textContent = cb.OUT_OF_SCOPE || 0;
}

// Load Canonical FAQs
async function loadFaqs() {
  const faqs = await api.getFaqs();
  state.faqs = faqs;
  renderFaqs(faqs);
  populateFaqDropdown(faqs);
}

function renderFaqs(faqs) {
  if (!el.faqsContainer) return;
  if (!faqs || faqs.length === 0) {
    el.faqsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No canonical FAQs found. Click "+ Add Canonical FAQ" above to create one.</div>`;
    return;
  }

  el.faqsContainer.innerHTML = faqs.map(f => `
    <div class="faq-card" data-id="${escapeHtml(f.id)}">
      <div class="faq-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="faq-id-badge">${escapeHtml(f.id)}</span>
          <span class="faq-category-badge">${escapeHtml(f.category || 'General')}</span>
        </div>
        <div class="faq-card-actions">
          <button class="faq-btn-icon" onclick="openEditFaqModal('${escapeHtml(f.id)}')" title="Edit canonical answer or variants">
            ✏️ Edit
          </button>
          <button class="faq-btn-icon faq-btn-delete" onclick="openDeleteFaqModal('${escapeHtml(f.id)}')" title="Permanently delete FAQ entry">
            🗑️ Delete
          </button>
        </div>
      </div>
      ${f.anchor ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Section Anchor: <span style="color: var(--navy); font-weight: 600;">${escapeHtml(f.anchor)}</span></div>` : ''}
      <div class="faq-canonical-answer">
        ${escapeHtml(f.answer || '')}
      </div>
      <div class="faq-variants-list">
        <div class="faq-variants-title">
          <span>Question Variants (${(f.questions || []).length})</span>
          <button class="faq-btn-icon" style="padding: 2px 6px; font-size: 10px;" onclick="openEditFaqModal('${escapeHtml(f.id)}')">
            + Add Variant
          </button>
        </div>
        <div class="faq-variants-tags">
          ${(f.questions || []).map(q => `
            <div class="variant-tag">
              <span>${escapeHtml(q)}</span>
              <button class="variant-remove-btn" onclick="deleteFaqVariant('${escapeHtml(f.id)}', '${escapeHtml(q).replace(/'/g, "\\'")}')" title="Delete this variant">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// FAQ Modal State & Handlers
let currentFaqModalMode = 'CREATE'; // 'CREATE' | 'EDIT'
let currentDeleteFaqId = null;

function openCreateFaqModal() {
  currentFaqModalMode = 'CREATE';
  el.faqModalTitle.textContent = 'Create New Canonical FAQ';
  el.faqModalBadge.textContent = 'NEW CANONICAL ENTRY';
  el.faqModalBadge.style.background = 'var(--text-green)';

  el.faqFormId.value = '';
  el.faqFormId.readOnly = false;
  el.faqFormId.style.opacity = '1';
  el.faqFormCategory.value = '';
  el.faqFormAnchor.value = '';
  el.faqFormAnswer.value = '';
  el.faqFormVariants.value = '';

  el.faqEditModal.style.display = 'flex';
  el.faqFormId.focus();
}

function openEditFaqModal(faqId) {
  const faq = state.faqs.find(f => f.id === faqId);
  if (!faq) {
    showToast(`FAQ "${faqId}" not found.`, 'error');
    return;
  }

  currentFaqModalMode = 'EDIT';
  el.faqModalTitle.textContent = `Edit Canonical FAQ: ${faq.id}`;
  el.faqModalBadge.textContent = 'EDIT CANONICAL ENTRY';
  el.faqModalBadge.style.background = 'var(--maroon)';

  el.faqFormId.value = faq.id;
  el.faqFormId.readOnly = true;
  el.faqFormId.style.opacity = '0.7';
  el.faqFormCategory.value = faq.category || '';
  el.faqFormAnchor.value = faq.anchor || '';
  el.faqFormAnswer.value = faq.answer || '';
  el.faqFormVariants.value = (faq.questions || []).join('\n');

  el.faqEditModal.style.display = 'flex';
  el.faqFormAnswer.focus();
}

function closeFaqModal() {
  if (el.faqEditModal) el.faqEditModal.style.display = 'none';
}

async function saveFaqModal() {
  const id = el.faqFormId.value.trim();
  const category = el.faqFormCategory.value.trim();
  const anchor = el.faqFormAnchor.value.trim();
  const answer = el.faqFormAnswer.value.trim();
  const variantsRaw = el.faqFormVariants.value.trim();

  if (!id && currentFaqModalMode === 'CREATE') {
    showToast('FAQ Identifier (Key) is required.', 'error');
    el.faqFormId.focus();
    return;
  }

  if (!answer) {
    showToast('Canonical Answer is required.', 'error');
    el.faqFormAnswer.focus();
    return;
  }

  const questions = variantsRaw ? variantsRaw.split('\n').map(q => q.trim()).filter(Boolean) : [];

  el.faqModalSaveBtn.disabled = true;
  el.faqModalSaveBtn.textContent = 'Saving...';

  try {
    if (currentFaqModalMode === 'CREATE') {
      await api.createFaq({ id, category, anchor, answer, questions });
      showToast(`Canonical FAQ "${id}" created successfully!`, 'success');
    } else {
      await api.updateFaq(id, { category, anchor, answer, questions });
      showToast(`Canonical FAQ "${id}" updated successfully!`, 'success');
    }

    closeFaqModal();
    await Promise.all([loadStats(), loadFaqs()]);
  } catch (err) {
    showToast(`Failed to save FAQ: ${err.message}`, 'error');
  } finally {
    el.faqModalSaveBtn.disabled = false;
    el.faqModalSaveBtn.textContent = 'Save Canonical FAQ';
  }
}

function openDeleteFaqModal(faqId) {
  const faq = state.faqs.find(f => f.id === faqId);
  if (!faq) return;

  currentDeleteFaqId = faqId;
  el.faqDeleteModalPreview.innerHTML = `
    <div><b>FAQ Identifier:</b> <span class="font-mono text-orange">${escapeHtml(faq.id)}</span></div>
    <div style="margin-top: 6px;"><b>Category:</b> ${escapeHtml(faq.category || 'General')}</div>
    <div style="margin-top: 6px;"><b>Question Variants:</b> ${(faq.questions || []).length} registered matchers</div>
    <div style="margin-top: 8px;"><b>Canonical Answer:</b></div>
    <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.04); padding: 8px 10px; border-radius: 4px; margin-top: 4px;">
      ${escapeHtml(faq.answer)}
    </div>
  `;

  el.faqDeleteModal.style.display = 'flex';
}

function closeFaqDeleteModal() {
  if (el.faqDeleteModal) el.faqDeleteModal.style.display = 'none';
  currentDeleteFaqId = null;
}

async function confirmDeleteFaq() {
  if (!currentDeleteFaqId) return;

  el.faqDeleteModalConfirmBtn.disabled = true;
  el.faqDeleteModalConfirmBtn.textContent = 'Deleting...';

  try {
    await api.deleteFaq(currentDeleteFaqId);
    showToast(`Canonical FAQ "${currentDeleteFaqId}" deleted successfully.`, 'info');
    closeFaqDeleteModal();
    await Promise.all([loadStats(), loadFaqs()]);
  } catch (err) {
    showToast(`Deletion failed: ${err.message}`, 'error');
  } finally {
    el.faqDeleteModalConfirmBtn.disabled = false;
    el.faqDeleteModalConfirmBtn.textContent = 'Delete FAQ';
  }
}

async function deleteFaqVariant(faqId, variantText) {
  if (!confirm(`Remove question variant "${variantText}" from ${faqId}?`)) {
    return;
  }

  try {
    await api.deleteFaqVariant(faqId, variantText);
    showToast(`Variant "${variantText}" removed from ${faqId}.`, 'info');
    await Promise.all([loadStats(), loadFaqs()]);
  } catch (err) {
    showToast(`Failed to remove variant: ${err.message}`, 'error');
  }
}

// Global exposure for inline onclick handlers
window.openEditFaqModal = openEditFaqModal;
window.openDeleteFaqModal = openDeleteFaqModal;
window.deleteFaqVariant = deleteFaqVariant;

function populateFaqDropdown(faqs) {
  el.wsFaqSelect.innerHTML = `
    <option value="">-- Select Destination FAQ --</option>
    ${faqs.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.id)} (${(f.questions || []).length} variants)</option>`).join('')}
  `;
}

let activeCandidateReqId = 0;

// Helper to synchronize classification strip and select
function updateClassificationFilter(cls) {
  state.filters.classification = cls || 'ALL';
  if (el.classificationFilterSelect) {
    el.classificationFilterSelect.value = state.filters.classification;
  }
  document.querySelectorAll('.strip-item').forEach(item => {
    const itemCls = item.getAttribute('data-cls');
    if (state.filters.classification === itemCls) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Load Candidates Queue
async function loadCandidates() {
  const currentSearch = state.filters.search;
  const thisReqId = ++activeCandidateReqId;

  const params = {
    page: state.pagination.page,
    limit: state.pagination.limit,
    status: state.filters.status,
    classification: state.filters.classification,
    search: currentSearch
  };

  try {
    const data = await api.getCandidates(params);
    if (thisReqId !== activeCandidateReqId) return; // Prevent race conditions
    state.candidates = data.candidates || [];
    state.pagination = data.pagination || state.pagination;
    renderCandidateTable(state.candidates);
  } catch (err) {
    if (thisReqId !== activeCandidateReqId) return;
    console.error('Failed to load candidates:', err);
    if (el.candidateTableBody) {
      el.candidateTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-danger">
            ⚠️ Error loading candidates: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

function renderCandidateTable(candidates) {
  if (candidates.length === 0) {
    el.candidateTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted" style="animation: rowFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;">No candidates found matching the current filters.</td>
      </tr>
    `;
    updatePaginationUI();
    return;
  }

  el.candidateTableBody.innerHTML = candidates.map((c, idx) => `
    <tr class="clickable" style="animation-delay: ${Math.min(idx * 0.025, 0.22)}s;" onclick="openWorkstationForCandidate('${escapeHtml(c.id)}')">
      <td class="font-mono" style="font-size: 12px; color: var(--text-orange); text-align: left; padding: 14px 8px 14px 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.id)}">${escapeHtml(c.id)}</td>
      <td style="overflow: hidden; padding-left: 10px;">
        <div style="font-weight: 600; font-size: 15.5px; color: var(--text-primary); margin-bottom: 4px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.originalQuery || '')}">${escapeHtml(c.originalQuery || '')}</div>
        <div style="font-size: 13.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.45;" title="${escapeHtml(c.answer || '')}">${escapeHtml((c.answer || '').substring(0, 110))}...</div>
      </td>
      <td style="text-align: center;">${getClassificationBadge(c.classification)}</td>
      <td style="text-align: center;">
        <span style="font-weight: 600; font-size: 12px; color: ${getRecommendationColor(c.recommendation)};">
          ${escapeHtml(c.recommendation || '-')}
        </span>
      </td>
      <td style="text-align: center;">${getStatusPill(c.status)}</td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openWorkstationForCandidate('${escapeHtml(c.id)}')">
          Inspect ↗
        </button>
      </td>
    </tr>
  `).join('');

  updatePaginationUI();
}

function updatePaginationUI() {
  const p = state.pagination;
  el.paginationInfo.textContent = `Showing ${(p.page - 1) * p.limit + (state.candidates.length > 0 ? 1 : 0)}–${(p.page - 1) * p.limit + state.candidates.length} of ${p.total} candidates`;
  el.pageIndicator.textContent = `Page ${p.page} of ${p.totalPages}`;
  el.prevPageBtn.disabled = p.page <= 1;
  el.nextPageBtn.disabled = p.page >= p.totalPages;
}

// Helpers for badges and pills
function getClassificationBadge(cls) {
  switch (cls) {
    case 'CANONICAL_DUPLICATE':
      return `<span class="cls-tag tag-duplicate">CANONICAL_DUPLICATE</span>`;
    case 'CANONICAL_SUPPORTED_SYNTHESIS':
      return `<span class="cls-tag tag-synthesis">SUPPORTED_SYNTHESIS</span>`;
    case 'REQUIRES_REVIEW':
      return `<span class="cls-tag tag-review">REQUIRES_REVIEW</span>`;
    case 'GUARDRAIL_RESPONSE':
      return `<span class="cls-tag tag-guardrail">GUARDRAIL_RESPONSE</span>`;
    case 'OUT_OF_SCOPE':
      return `<span class="cls-tag tag-scope">OUT_OF_SCOPE</span>`;
    default:
      return `<span class="cls-tag">${escapeHtml(cls || '-')}</span>`;
  }
}

function getStatusPill(status) {
  switch (status) {
    case 'PENDING':
      return `<span class="status-pill pill-pending">PENDING</span>`;
    case 'PROMOTED':
      return `<span class="status-pill pill-promoted">PROMOTED</span>`;
    case 'REJECTED':
      return `<span class="status-pill pill-rejected">REJECTED</span>`;
    case 'KEEP_FOR_REVIEW':
      return `<span class="status-pill pill-keep">KEEP REVIEW</span>`;
    default:
      return `<span class="status-pill pill-neutral">${escapeHtml(status || 'PENDING')}</span>`;
  }
}

function getRecommendationColor(rec) {
  switch (rec) {
    case 'PROMOTE': return 'var(--text-green)';
    case 'REJECT': return 'var(--text-red)';
    case 'KEEP FOR REVIEW': return 'var(--text-yellow)';
    default: return 'var(--text-secondary)';
  }
}

// Load Audit Logs
async function loadLogs() {
  const params = {
    decision: state.logFilter,
    limit: 100
  };
  const data = await api.getLogs(params);
  state.logs = data.logs || [];
  renderLogs(state.logs);
}

function renderLogs(logs) {
  if (logs.length === 0) {
    el.logTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">No audit logs found.</td>
      </tr>
    `;
    return;
  }

  el.logTableBody.innerHTML = logs.map((l, idx) => `
    <tr style="animation-delay: ${Math.min(idx * 0.025, 0.22)}s;">
      <td class="font-mono" style="font-size: 11px; color: var(--text-muted); text-align: left; padding-left: 16px; white-space: nowrap;">${escapeHtml(new Date(l.reviewerDecisionTimestamp).toLocaleString())}</td>
      <td style="text-align: center;">${getStatusPill(l.decision)}</td>
      <td class="font-mono" style="font-size: 12px; color: var(--text-orange); text-align: left; padding: 14px 8px 14px 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(l.candidateId || '')}">${escapeHtml(l.candidateId || '-')}</td>
      <td style="overflow: hidden; padding-left: 10px;">
        <div style="font-weight: 500; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(l.originalQuery || '')}">${escapeHtml(l.originalQuery || '')}</div>
      </td>
      <td class="font-mono" style="font-size: 12px; color: var(--text-blue); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(l.destinationFaqId || '')}">${escapeHtml(l.destinationFaqId || '—')}</td>
      <td style="text-align: center;">${getClassificationBadge(l.classification)}</td>
    </tr>
  `).join('');
}

// ══════════════════════════════════════════════════════════
// BATCH WORKSTATION LOGIC
// ══════════════════════════════════════════════════════════

function getActiveBatchSize() {
  if (state.batch.size === 'custom') {
    const customVal = parseInt(state.batch.customSize, 10);
    return (!isNaN(customVal) && customVal > 0) ? Math.min(customVal, 100) : 25;
  }
  const val = parseInt(state.batch.size, 10);
  return (!isNaN(val) && val > 0) ? val : 25;
}

function updateBatchSizeSelection(size, customVal = null) {
  state.batch.size = size;
  if (customVal != null && !isNaN(customVal)) {
    state.batch.customSize = customVal;
  }

  // Sync top bar controls
  if (el.batchSizeControl) {
    el.batchSizeControl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === String(size));
    });
  }
  if (el.customBatchSizeInput) {
    el.customBatchSizeInput.style.display = size === 'custom' ? 'inline-block' : 'none';
    if (size === 'custom') el.customBatchSizeInput.value = state.batch.customSize;
  }

  // Sync complete screen controls
  if (el.completeBatchSizeControl) {
    el.completeBatchSizeControl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === String(size));
    });
  }
  if (el.completeCustomBatchSizeInput) {
    el.completeCustomBatchSizeInput.style.display = size === 'custom' ? 'inline-block' : 'none';
    if (size === 'custom') el.completeCustomBatchSizeInput.value = state.batch.customSize;
  }

  // Update complete button text
  const remaining = state.stats ? state.stats.eligibleForReview : 0;
  if (el.batchReviewRemainingBtn) {
    if (remaining === 0) {
      el.batchReviewRemainingBtn.disabled = true;
      el.batchReviewRemainingBtn.classList.add('btn-disabled');
      el.batchReviewRemainingBtn.textContent = 'All Eligible Candidates Reviewed ✓';
    } else {
      el.batchReviewRemainingBtn.disabled = false;
      el.batchReviewRemainingBtn.classList.remove('btn-disabled');
      const effSize = getActiveBatchSize();
      const nextCount = Math.min(effSize, remaining);
      el.batchReviewRemainingBtn.textContent = `Review Next ${nextCount} Candidate${nextCount === 1 ? '' : 's'}`;
    }
  }
}

async function startBatchReview(batchType = 'eligible') {
  try {
    const batchSize = getActiveBatchSize();
    const params = {
      page: 1,
      limit: batchSize,
      status: 'PENDING',
      classification: batchType === 'eligible' ? 'ELIGIBLE' : 'ALL'
    };

    const data = await api.getCandidates(params);
    const queue = data.candidates || [];

    if (queue.length === 0) {
      switchTab('batch');
      el.workstationContainer.style.display = 'none';
      el.batchCompleteScreen.style.display = 'flex';
      showToast('No eligible pending candidates available for batch review.', 'info');
      await loadStats();
      showBatchCompleteScreen();
      return;
    }

    state.batch.queue = queue;
    state.batch.currentIndex = 0;
    state.batch.stats = { promoted: 0, rejected: 0, kept: 0 };

    el.batchCompleteScreen.style.display = 'none';
    el.workstationContainer.style.display = 'grid';

    switchTab('batch');
    renderCurrentBatchCandidate();
  } catch (err) {
    showToast(`Failed to load batch: ${err.message}`, 'error');
  }
}

async function openWorkstationForCandidate(candidateId) {
  try {
    const candidate = await api.getCandidateById(candidateId);
    if (!candidate) throw new Error('Candidate not found.');

    if (state.candidates && state.candidates.length > 0) {
      const idx = state.candidates.findIndex(c => c.id === candidateId);
      if (idx !== -1) {
        state.batch.queue = [...state.candidates];
        state.batch.currentIndex = idx;
      } else {
        state.batch.queue = [candidate];
        state.batch.currentIndex = 0;
      }
    } else {
      state.batch.queue = [candidate];
      state.batch.currentIndex = 0;
    }

    el.batchCompleteScreen.style.display = 'none';
    el.workstationContainer.style.display = 'grid';

    switchTab('batch');
    renderCurrentBatchCandidate();
  } catch (err) {
    showToast(`Failed to inspect candidate: ${err.message}`, 'error');
  }
}

function renderCurrentBatchCandidate() {
  const q = state.batch.queue;
  const idx = state.batch.currentIndex;

  if (idx >= q.length) {
    showBatchCompleteScreen();
    return;
  }

  const c = q[idx];
  state.currentCandidate = c;

  // Header & Progress
  el.batchHeading.textContent = `Batch Review — Candidate ${idx + 1} of ${q.length}`;
  el.batchProgressLabel.textContent = `Candidate ${idx + 1} of ${q.length} (${Math.round(((idx + 1) / q.length) * 100)}%)`;
  el.batchProgressFill.style.width = `${((idx + 1) / q.length) * 100}%`;

  const candStatus = c.status || 'PENDING';
  el.wsCandidateStatus.textContent = candStatus === 'KEEP_FOR_REVIEW' ? 'KEEP REVIEW' : candStatus;
  el.wsCandidateStatus.className = `status-pill ${candStatus === 'PROMOTED' ? 'pill-promoted' : candStatus === 'REJECTED' ? 'pill-rejected' : candStatus === 'KEEP_FOR_REVIEW' ? 'pill-keep' : 'pill-pending'}`;

  el.wsCandidateId.textContent = c.id;
  const scoreNum = c.confidenceScore != null ? Number(c.confidenceScore) : 0.85;
  el.wsConfidenceScore.textContent = `${Math.round(scoreNum <= 1 ? scoreNum * 100 : scoreNum)}%`;
  el.wsModelUsed.textContent = c.modelUsed || 'gemini-3.6-flash';
  el.wsOriginalQuery.textContent = c.originalQuery;
  el.wsCandidateAnswer.textContent = c.answer;

  // Classification & Evidence
  el.wsClassificationTag.innerHTML = getClassificationBadge(c.classification);
  el.wsQueryNature.textContent = c.queryNature || 'semantic paraphrase';
  el.wsRecommendation.textContent = c.recommendation || 'KEEP FOR REVIEW';
  el.wsRecommendation.style.color = getRecommendationColor(c.recommendation);
  el.wsReason.textContent = c.reason || 'Candidate evaluated for canonical consistency.';
  el.wsGroundingEvidence.textContent = c.groundingEvidence || 'portfolio.identity / portfolio.skills';

  // Destination FAQ Selector Pre-selection
  if (c.destinationFaqId) {
    el.wsFaqSelect.value = c.destinationFaqId;
  } else {
    el.wsFaqSelect.value = '';
  }
  updateFaqPreview();

  // Navigation Buttons
  el.wsPrevBtn.disabled = idx <= 0;
  el.wsNextBtn.disabled = idx >= q.length - 1;

  // Active Decision State Highlight
  el.wsPromoteBtn.classList.toggle('btn-active-decision', candStatus === 'PROMOTED');
  el.wsRejectBtn.classList.toggle('btn-active-decision', candStatus === 'REJECTED');
  el.wsKeepBtn.classList.toggle('btn-active-decision', candStatus === 'KEEP_FOR_REVIEW');
}

function updateFaqPreview() {
  const selectedFaqId = el.wsFaqSelect.value;
  const faq = state.faqs.find(f => f.id === selectedFaqId);

  if (faq) {
    el.wsFaqPreviewTitle.textContent = `Target FAQ: ${faq.id}`;
    el.wsFaqPreviewAnswer.textContent = faq.answer;
    el.wsFaqVariantsCount.textContent = `${(faq.questions || []).length} existing query variants in cache`;
  } else {
    el.wsFaqPreviewTitle.textContent = `Target FAQ: Not Selected`;
    el.wsFaqPreviewAnswer.textContent = `Select an FAQ above to inspect canonical answer.`;
    el.wsFaqVariantsCount.textContent = `0 existing variants`;
  }
  el.wsFaqSelect.blur();
}

function showBatchCompleteScreen() {
  el.workstationContainer.style.display = 'none';
  el.batchCompleteScreen.style.display = 'flex';

  el.batchStatPromoted.textContent = state.batch.stats.promoted;
  el.batchStatRejected.textContent = state.batch.stats.rejected;
  el.batchStatKept.textContent = state.batch.stats.kept;

  const remaining = state.stats ? state.stats.eligibleForReview : 0;
  el.batchStatRemaining.textContent = remaining;

  if (remaining === 0) {
    el.batchReviewRemainingBtn.disabled = true;
    el.batchReviewRemainingBtn.classList.add('btn-disabled');
    el.batchReviewRemainingBtn.textContent = 'All Eligible Candidates Reviewed ✓';
    if (el.batchCompleteDesc) {
      el.batchCompleteDesc.textContent = 'Queue cleared! All eligible candidates in the repository have been reviewed.';
    }
  } else {
    el.batchReviewRemainingBtn.disabled = false;
    el.batchReviewRemainingBtn.classList.remove('btn-disabled');
    const effSize = getActiveBatchSize();
    const nextCount = Math.min(effSize, remaining);
    el.batchReviewRemainingBtn.textContent = `Review Next ${nextCount} Candidate${nextCount === 1 ? '' : 's'}`;
    if (el.batchCompleteDesc) {
      el.batchCompleteDesc.textContent = `You have reviewed all candidates in this batch. ${remaining} eligible candidate${remaining === 1 ? '' : 's'} remain in queue.`;
    }
  }
}

// ══════════════════════════════════════════════════════════
// DRY-RUN SAFETY CONFIRMATION MODAL & ACTIONS
// ══════════════════════════════════════════════════════════

function promptPromoteCurrent() {
  const c = state.currentCandidate;
  if (!c) return;

  const targetFaqId = el.wsFaqSelect.value;
  if (!targetFaqId) {
    showToast('Please select a Destination FAQ before promoting.', 'error');
    el.wsFaqSelect.focus();
    return;
  }

  const targetFaq = state.faqs.find(f => f.id === targetFaqId);

  state.pendingAction = {
    type: 'PROMOTE',
    candidateId: c.id,
    destinationFaqId: targetFaqId
  };

  el.modalActionBadge.textContent = 'PROPOSED ACTION: PROMOTE';
  el.modalActionBadge.style.background = 'var(--text-green)';
  el.modalTitle.textContent = 'Confirm Candidate Promotion';

  el.modalPreview.innerHTML = `
    <div><b>Candidate ID:</b> <span class="font-mono text-orange">${escapeHtml(c.id)}</span></div>
    <div style="margin-top: 8px;"><b>Question Variant to Add:</b></div>
    <div style="font-size: 14px; font-weight: 600; color: #fff; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; margin: 4px 0 10px 0;">
      "${escapeHtml(c.originalQuery)}"
    </div>
    <div><b>Destination Canonical FAQ:</b> <span class="font-mono text-blue">${escapeHtml(targetFaqId)}</span></div>
    <div style="margin-top: 8px;"><b>Effect:</b> Adds 1 natural question variant to Layer 2 cache.</div>
    <div><b>Canonical Answer Text:</b> <span class="text-green font-semibold">100% UNCHANGED</span></div>
    <div><b>Provenance Log:</b> Will append permanent record with timestamp.</div>
  `;

  el.modalAlert.innerHTML = `
    ⚠️ <b>Safety Notice:</b> Promotion permanently adds this question variant to ground-truth retrieval. Canonical answers and portfolio facts will NOT be modified.
  `;

  el.modalConfirmBtn.className = 'btn btn-success';
  el.modalConfirmBtn.textContent = 'Confirm Promotion';
  el.actionModal.style.display = 'flex';
}

function promptRejectCurrent() {
  const c = state.currentCandidate;
  if (!c) return;

  state.pendingAction = {
    type: 'REJECT',
    candidateId: c.id
  };

  el.modalActionBadge.textContent = 'PROPOSED ACTION: REJECT';
  el.modalActionBadge.style.background = 'var(--text-red)';
  el.modalTitle.textContent = 'Confirm Candidate Rejection';

  el.modalPreview.innerHTML = `
    <div><b>Candidate ID:</b> <span class="font-mono text-orange">${escapeHtml(c.id)}</span></div>
    <div style="margin-top: 8px;"><b>Visitor Query:</b></div>
    <div style="font-size: 14px; font-weight: 600; color: #fff; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; margin: 4px 0 10px 0;">
      "${escapeHtml(c.originalQuery)}"
    </div>
    <div><b>Classification:</b> ${escapeHtml(c.classification)}</div>
    <div><b>Effect:</b> Candidate will be marked as REJECTED in governance provenance.</div>
    <div><b>FAQ Ground Truth:</b> <span class="text-green font-semibold">100% UNCHANGED</span></div>
  `;

  el.modalAlert.innerHTML = `
    ℹ️ <b>Governance Record:</b> Rejection logs a human decision to reject this query from ever entering canonical FAQ knowledge.
  `;

  el.modalConfirmBtn.className = 'btn btn-danger';
  el.modalConfirmBtn.textContent = 'Confirm Rejection';
  el.actionModal.style.display = 'flex';
}

function promptKeepCurrent() {
  const c = state.currentCandidate;
  if (!c) return;

  state.pendingAction = {
    type: 'KEEP',
    candidateId: c.id
  };

  el.modalActionBadge.textContent = 'PROPOSED ACTION: KEEP FOR REVIEW';
  el.modalActionBadge.style.background = 'var(--text-yellow)';
  el.modalTitle.textContent = 'Keep Candidate For Review';

  el.modalPreview.innerHTML = `
    <div><b>Candidate ID:</b> <span class="font-mono text-orange">${escapeHtml(c.id)}</span></div>
    <div style="margin-top: 8px;"><b>Visitor Query:</b> "${escapeHtml(c.originalQuery)}"</div>
    <div style="margin-top: 8px;"><b>Effect:</b> Marks candidate as retained for deeper human review.</div>
    <div><b>Status:</b> Stays in candidate cache with <span class="font-mono">verified: false</span>.</div>
  `;

  el.modalAlert.innerHTML = `
    ℹ️ <b>Retention Notice:</b> Candidate remains available for dynamic Layer 3 acceleration but will not be promoted to canonical Tier 2 cache.
  `;

  el.modalConfirmBtn.className = 'btn btn-warning';
  el.modalConfirmBtn.textContent = 'Keep for Review';
  el.actionModal.style.display = 'flex';
}

// Execute Confirmed Action
async function executePendingAction() {
  if (!state.pendingAction) return;

  const { type, candidateId, destinationFaqId } = state.pendingAction;
  el.modalConfirmBtn.disabled = true;
  el.modalConfirmBtn.textContent = 'Applying...';

  try {
    const newStatus = type === 'PROMOTE' ? 'PROMOTED' : (type === 'REJECT' ? 'REJECTED' : 'KEEP_FOR_REVIEW');

    if (type === 'PROMOTE') {
      const res = await api.promote(candidateId, destinationFaqId);
      showToast(`Candidate ${candidateId} promoted to ${destinationFaqId}!`, 'success');
      state.batch.stats.promoted++;
    } else if (type === 'REJECT') {
      const res = await api.reject(candidateId);
      showToast(`Candidate ${candidateId} rejected.`, 'info');
      state.batch.stats.rejected++;
    } else if (type === 'KEEP') {
      const res = await api.keep(candidateId);
      showToast(`Candidate ${candidateId} retained for review.`, 'info');
      state.batch.stats.kept++;
    }

    // 1. Immediately update status in active batch review queue
    const batchItem = state.batch.queue.find(item => item.id === candidateId);
    if (batchItem) {
      batchItem.status = newStatus;
      if (type === 'PROMOTE') {
        batchItem.destinationFaqId = destinationFaqId;
      }
    }

    // 2. Update current candidate reference if active
    if (state.currentCandidate && state.currentCandidate.id === candidateId) {
      state.currentCandidate.status = newStatus;
      if (type === 'PROMOTE') {
        state.currentCandidate.destinationFaqId = destinationFaqId;
      }
    }

    // 3. Update candidate queue cache
    const qItem = state.candidates.find(item => item.id === candidateId);
    if (qItem) {
      qItem.status = newStatus;
      if (type === 'PROMOTE') {
        qItem.destinationFaqId = destinationFaqId;
      }
    }

    closeModal();

    // Refresh background stats, FAQs & audit logs
    await Promise.all([loadStats(), loadFaqs(), loadLogs()]);

    // Advance to next candidate in batch
    state.batch.currentIndex++;
    renderCurrentBatchCandidate();

  } catch (err) {
    showToast(`Action failed: ${err.message}`, 'error');
  } finally {
    el.modalConfirmBtn.disabled = false;
  }
}

function closeModal() {
  el.actionModal.style.display = 'none';
  state.pendingAction = null;
}

// ══════════════════════════════════════════════════════════
// TAB SWITCHING & EVENT LISTENERS
// ══════════════════════════════════════════════════════════

function switchTab(tabName) {
  state.activeTab = tabName;

  el.navTabs.forEach(t => {
    if (t.getAttribute('data-tab') === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  Object.keys(el.panes).forEach(paneKey => {
    if (paneKey === tabName) {
      el.panes[paneKey].classList.add('active');
    } else {
      el.panes[paneKey].classList.remove('active');
    }
  });

  if (tabName === 'queue') {
    loadCandidates();
  } else if (tabName === 'faqs') {
    loadFaqs();
  } else if (tabName === 'provenance') {
    loadLogs();
  }
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Event Listeners
function setupEventListeners() {
  // Navigation Tabs
  el.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName === 'batch') {
        if (state.batch.queue.length === 0 || state.batch.currentIndex >= state.batch.queue.length) {
          startBatchReview('eligible');
        } else {
          switchTab('batch');
          el.batchCompleteScreen.style.display = 'none';
          el.workstationContainer.style.display = 'grid';
          renderCurrentBatchCandidate();
        }
      } else {
        switchTab(tabName);
      }
    });
  });

  // Refresh All Data
  el.refreshAllBtn.addEventListener('click', async () => {
    showToast('Refreshing all data from disk...', 'info');
    await Promise.all([loadStats(), loadFaqs(), loadCandidates(), loadLogs()]);
    showToast('Data refresh complete.', 'success');
  });

  // Classification Strip Click Filter (Toggle or Switch)
  document.querySelectorAll('.strip-item').forEach(item => {
    item.addEventListener('click', () => {
      const cls = item.getAttribute('data-cls');
      const targetCls = (state.filters.classification === cls) ? 'ALL' : cls;
      updateClassificationFilter(targetCls);
      state.pagination.page = 1;
      switchTab('queue');
      loadCandidates();
    });
  });

  // Queue Status Segmented Control
  el.statusFilterControl.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.statusFilterControl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.status = btn.getAttribute('data-val');
      state.pagination.page = 1;
      loadCandidates();
    });
  });

  // Classification Select
  el.classificationFilterSelect.addEventListener('change', () => {
    updateClassificationFilter(el.classificationFilterSelect.value);
    state.pagination.page = 1;
    loadCandidates();
  });

  // Search Input with Debounce, Immediate Enter Key Execution & Clear Button
  let searchTimeout = null;
  const triggerQueueSearch = () => {
    clearTimeout(searchTimeout);
    const query = el.queueSearchInput ? el.queueSearchInput.value.trim() : '';
    if (el.queueSearchClearBtn) {
      el.queueSearchClearBtn.style.display = query ? 'inline-flex' : 'none';
    }
    state.filters.search = query;
    state.pagination.page = 1;
    loadCandidates();
  };

  if (el.queueSearchInput) {
    el.queueSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = el.queueSearchInput.value.trim();
      if (el.queueSearchClearBtn) {
        el.queueSearchClearBtn.style.display = query ? 'inline-flex' : 'none';
      }
      searchTimeout = setTimeout(triggerQueueSearch, 250);
    });

    el.queueSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerQueueSearch();
      }
    });

    el.queueSearchInput.addEventListener('search', triggerQueueSearch);
  }

  if (el.queueSearchClearBtn) {
    el.queueSearchClearBtn.addEventListener('click', () => {
      if (el.queueSearchInput) {
        el.queueSearchInput.value = '';
        el.queueSearchInput.focus();
      }
      triggerQueueSearch();
    });
  }

  // Pagination
  el.prevPageBtn.addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      loadCandidates();
    }
  });

  el.nextPageBtn.addEventListener('click', () => {
    if (state.pagination.page < state.pagination.totalPages) {
      state.pagination.page++;
      loadCandidates();
    }
  });

  // Batch Workstation Navigation
  el.wsPrevBtn.addEventListener('click', () => {
    if (state.batch.currentIndex > 0) {
      state.batch.currentIndex--;
      renderCurrentBatchCandidate();
    }
  });

  el.wsNextBtn.addEventListener('click', () => {
    if (state.batch.currentIndex < state.batch.queue.length - 1) {
      state.batch.currentIndex++;
      renderCurrentBatchCandidate();
    }
  });

  // Action Triggers
  el.wsPromoteBtn.addEventListener('click', promptPromoteCurrent);
  el.wsRejectBtn.addEventListener('click', promptRejectCurrent);
  el.wsKeepBtn.addEventListener('click', promptKeepCurrent);

  // FAQ Select Change
  el.wsFaqSelect.addEventListener('change', updateFaqPreview);

  // Modal Buttons
  el.modalCloseBtn.addEventListener('click', closeModal);
  el.modalCancelBtn.addEventListener('click', closeModal);
  el.modalConfirmBtn.addEventListener('click', executePendingAction);
  // Batch Size Selector in Top Bar
  if (el.batchSizeControl) {
    el.batchSizeControl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size');
        updateBatchSizeSelection(size);
        if (size === 'custom' && el.customBatchSizeInput) {
          el.customBatchSizeInput.focus();
        } else {
          startBatchReview('eligible');
        }
      });
    });
  }

  if (el.customBatchSizeInput) {
    el.customBatchSizeInput.addEventListener('change', () => {
      const val = parseInt(el.customBatchSizeInput.value, 10);
      if (!isNaN(val) && val > 0) {
        updateBatchSizeSelection('custom', Math.min(val, 100));
        startBatchReview('eligible');
      }
    });
    el.customBatchSizeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = parseInt(el.customBatchSizeInput.value, 10);
        if (!isNaN(val) && val > 0) {
          updateBatchSizeSelection('custom', Math.min(val, 100));
          startBatchReview('eligible');
        }
      }
    });
  }

  if (el.batchRestartBtn) {
    el.batchRestartBtn.addEventListener('click', () => {
      startBatchReview('eligible');
    });
  }

  // Batch Size Selector in Complete Screen
  if (el.completeBatchSizeControl) {
    el.completeBatchSizeControl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size');
        updateBatchSizeSelection(size);
        if (size === 'custom' && el.completeCustomBatchSizeInput) {
          el.completeCustomBatchSizeInput.focus();
        }
      });
    });
  }

  if (el.completeCustomBatchSizeInput) {
    el.completeCustomBatchSizeInput.addEventListener('change', () => {
      const val = parseInt(el.completeCustomBatchSizeInput.value, 10);
      if (!isNaN(val) && val > 0) {
        updateBatchSizeSelection('custom', Math.min(val, 100));
      }
    });
    el.completeCustomBatchSizeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = parseInt(el.completeCustomBatchSizeInput.value, 10);
        if (!isNaN(val) && val > 0) {
          updateBatchSizeSelection('custom', Math.min(val, 100));
          startBatchReview('eligible');
        }
      }
    });
  }

  // Batch Complete Buttons
  el.batchReviewRemainingBtn.addEventListener('click', () => startBatchReview('eligible'));
  el.batchReturnQueueBtn.addEventListener('click', () => switchTab('queue'));

  // Log Filters
  el.logFilterControl.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.logFilterControl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.logFilter = btn.getAttribute('data-val');
      loadLogs();
    });
  });

  let logSearchTimeout = null;
  const triggerLogSearch = () => {
    clearTimeout(logSearchTimeout);
    const s = el.logSearchInput.value.trim().toLowerCase();
    if (!s) {
      renderLogs(state.logs);
      return;
    }
    const filtered = state.logs.filter(l =>
      (l.candidateId && l.candidateId.toLowerCase().includes(s)) ||
      (l.originalQuery && l.originalQuery.toLowerCase().includes(s)) ||
      (l.destinationFaqId && l.destinationFaqId.toLowerCase().includes(s))
    );
    renderLogs(filtered);
  };

  el.logSearchInput.addEventListener('input', () => {
    clearTimeout(logSearchTimeout);
    logSearchTimeout = setTimeout(triggerLogSearch, 300);
  });

  el.logSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerLogSearch();
    }
  });

  // FAQ Management & Modals
  if (el.openAddFaqModalBtn) {
    el.openAddFaqModalBtn.addEventListener('click', openCreateFaqModal);
  }
  if (el.faqModalCloseBtn) {
    el.faqModalCloseBtn.addEventListener('click', closeFaqModal);
  }
  if (el.faqModalCancelBtn) {
    el.faqModalCancelBtn.addEventListener('click', closeFaqModal);
  }
  if (el.faqModalSaveBtn) {
    el.faqModalSaveBtn.addEventListener('click', saveFaqModal);
  }
  if (el.faqDeleteModalCloseBtn) {
    el.faqDeleteModalCloseBtn.addEventListener('click', closeFaqDeleteModal);
  }
  if (el.faqDeleteModalCancelBtn) {
    el.faqDeleteModalCancelBtn.addEventListener('click', closeFaqDeleteModal);
  }
  if (el.faqDeleteModalConfirmBtn) {
    el.faqDeleteModalConfirmBtn.addEventListener('click', confirmDeleteFaq);
  }

  // FAQ Live Search
  let faqSearchTimeout = null;
  if (el.faqSearchInput) {
    el.faqSearchInput.addEventListener('input', () => {
      clearTimeout(faqSearchTimeout);
      faqSearchTimeout = setTimeout(() => {
        const query = el.faqSearchInput.value.trim().toLowerCase();
        if (!query) {
          renderFaqs(state.faqs);
          return;
        }
        const filtered = state.faqs.filter(f =>
          (f.id && f.id.toLowerCase().includes(query)) ||
          (f.category && f.category.toLowerCase().includes(query)) ||
          (f.answer && f.answer.toLowerCase().includes(query)) ||
          (f.questions && f.questions.some(q => q.toLowerCase().includes(query)))
        );
        renderFaqs(filtered);
      }, 200);
    });
  }

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Modal Shortcuts
    if (el.actionModal && el.actionModal.style.display === 'flex') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executePendingAction();
      }
      return;
    }

    if (el.faqEditModal && el.faqEditModal.style.display === 'flex') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFaqModal();
      }
      return;
    }

    if (el.faqDeleteModal && el.faqDeleteModal.style.display === 'flex') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFaqDeleteModal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmDeleteFaq();
      }
      return;
    }

    // Only in batch tab and not typing in text input
    if (state.activeTab !== 'batch') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      promptPromoteCurrent();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      promptRejectCurrent();
    } else if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      promptKeepCurrent();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (state.batch.currentIndex < state.batch.queue.length - 1) {
        state.batch.currentIndex++;
        renderCurrentBatchCandidate();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (state.batch.currentIndex > 0) {
        state.batch.currentIndex--;
        renderCurrentBatchCandidate();
      }
    }
  });
}

// Window load bootstrap
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initApp();
});
