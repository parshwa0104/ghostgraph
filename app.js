/* ═══════════════════════════════════════════════════════════
   GhostGraph v3.3 — E2EE Messaging Prototype
   Backend-integrated + Admin Log + Friendly UI
   ═══════════════════════════════════════════════════════════ */

const API_BASE = "/api";
const CONTACTS = ["alice", "bob", "charlie"];
const STORAGE = {
  keys: "ghostgraph-v3-keys",
  relay: "ghostgraph-v3-relay",
  chain: "ghostgraph-v3-chain",
  rewards: "ghostgraph-v3-rewards",
  files: "ghostgraph-v3-files",
};

const state = {
  activeUser: "alice",
  recipient: "bob",
  keys: loadKeys(),
  packets: loadRelayPackets(),
  filePackets: loadFilePackets(),
  chain: [],
  rewards: loadRewards(),
  overlayMode: false,
  currentView: "chat",
  serverOnline: false,
  adminAutoRefresh: true,
  adminRefreshTimer: null,
};

/* ────────── API Helpers ────────── */

async function api(method, path, body = null) {
  try {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[API] ${method} ${path} failed:`, err.message);
    return null;
  }
}

async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    state.serverOnline = res.ok;
  } catch {
    state.serverOnline = false;
  }
  updateConnectionBadge();
}

function updateConnectionBadge() {
  const badge = document.getElementById("connection-badge");
  if (!badge) return;
  const dot = badge.querySelector(".status-dot");
  const text = badge.querySelector(".status-text");
  if (state.serverOnline) {
    dot.className = "status-dot online";
    text.textContent = "Connected";
  } else {
    dot.className = "status-dot offline";
    text.textContent = "Offline";
  }
}

/* ────────── DOM References ────────── */

const els = {
  banner: document.getElementById("banner"),
  activeUser: document.getElementById("active-user"),
  recipientUser: document.getElementById("recipient-user"),
  messageInput: document.getElementById("message-input"),
  sendMessage: document.getElementById("send-message"),
  inboxLog: document.getElementById("inbox-log"),
  identityList: document.getElementById("identity-list"),
  tokenBar: document.getElementById("token-bar"),
  relayLog: document.getElementById("relay-log"),
  chainLog: document.getElementById("chain-log"),
  chainHeight: document.getElementById("chain-height"),
  overlayToggle: document.getElementById("overlay-toggle"),
  clearData: document.getElementById("clear-data"),
  qrContactSelect: document.getElementById("qr-contact-select"),
  qrPayload: document.getElementById("qr-payload"),
  qrCanvas: document.getElementById("qr-canvas"),
  copyQrPayload: document.getElementById("copy-qr-payload"),
  qrImportInput: document.getElementById("qr-import-input"),
  qrImportTarget: document.getElementById("qr-import-target"),
  qrImportBtn: document.getElementById("qr-import-btn"),
  vaultPass: document.getElementById("vault-pass"),
  exportVault: document.getElementById("export-vault"),
  strengthFill: document.getElementById("strength-fill"),
  strengthLabel: document.getElementById("strength-label"),
  importVault: document.getElementById("import-vault"),
  vaultImportFile: document.getElementById("vault-import-file"),
  vaultImportZone: document.getElementById("vault-import-zone"),
  vaultImportPass: document.getElementById("vault-import-pass"),
  fileFrom: document.getElementById("file-from"),
  fileTo: document.getElementById("file-to"),
  fileDropZone: document.getElementById("file-drop-zone"),
  fileInput: document.getElementById("file-input"),
  fileProgress: document.getElementById("file-progress"),
  fileProgressLabel: document.getElementById("file-progress-label"),
  fileProgressFill: document.getElementById("file-progress-fill"),
  fileList: document.getElementById("file-list"),
  viewNav: document.getElementById("view-nav"),
  viewLinks: Array.from(document.querySelectorAll(".view-link")),
  viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
  adminLogList: document.getElementById("admin-log-list"),
  adminRefresh: document.getElementById("admin-refresh"),
  adminClear: document.getElementById("admin-clear"),
  adminAutoRefreshToggle: document.getElementById("admin-auto-refresh-toggle"),
};

boot();

async function boot() {
  state.chain = await loadOrCreateChain();
  await checkServerHealth();
  wireEvents();
  setView(state.currentView);
  renderSelectors();
  await refreshViews();

  // Sync data to server on first boot
  if (state.serverOnline) {
    syncToServer();
  }

  showNotice("GhostGraph ready! Choose a contact and start messaging.");

  // Periodic health check
  setInterval(checkServerHealth, 15000);
}

/* ────────── Sync to Server ────────── */

async function syncToServer() {
  if (!state.serverOnline) return;

  // Sync chain
  if (state.chain.length > 0) {
    await api("PUT", "/chain", { chain: state.chain });
  }

  // Sync rewards
  await api("PUT", "/rewards", { rewards: state.rewards });
}

/* ────────── Event Wiring ────────── */

let _identityDebounce = null;
let _bannerTimeout = null;

function wireEvents() {
  els.activeUser.addEventListener("change", async (event) => {
    state.activeUser = event.target.value;
    if (state.activeUser === state.recipient) {
      state.recipient = CONTACTS.find((c) => c !== state.activeUser) || state.activeUser;
    }
    renderSelectors();
    await refreshViews();
  });

  els.recipientUser.addEventListener("change", async (event) => {
    state.recipient = event.target.value;
    await refreshViews();
  });

  els.sendMessage.addEventListener("click", sendMessage);

  els.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  els.viewNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    setView(button.dataset.view);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select")) return;
    const key = Number(event.key);
    if (!Number.isInteger(key) || key < 1 || key > 7) return;
    const viewMap = ["chat", "files", "identity", "exchange", "chain", "vault", "admin"];
    setView(viewMap[key - 1]);
  });

  els.identityList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const user = button.dataset.user;
    const action = button.dataset.action;
    if (!user || !action) return;
    if (action === "generate") {
      state.keys[user] = randomHex(32);
      persistKeys(state.keys);
      showNotice(`New key generated for ${capitalize(user)}.`);
      await refreshViews();
    }
  });

  els.identityList.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-user]");
    if (!input) return;
    const user = input.dataset.user;
    state.keys[user] = input.value.trim();
    persistKeys(state.keys);
    clearTimeout(_identityDebounce);
    _identityDebounce = setTimeout(() => refreshViews(), 400);
  });

  els.qrContactSelect.addEventListener("change", renderQrCard);

  els.copyQrPayload.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.qrPayload.value);
      showNotice("Key copied to clipboard!");
    } catch {
      showNotice("Couldn't copy automatically — please copy it manually.", true);
    }
  });

  els.qrImportBtn.addEventListener("click", async () => {
    const raw = els.qrImportInput.value.trim();
    const target = els.qrImportTarget.value;
    if (!raw || !target) {
      showNotice("Please paste a key and select a contact.", true);
      return;
    }
    const parsed = parseImportedPayload(raw);
    if (!parsed?.key) {
      showNotice("That doesn't look like a valid key. Try again.", true);
      return;
    }
    state.keys[target] = parsed.key;
    persistKeys(state.keys);
    showNotice(`Key imported for ${capitalize(target)}!`);
    await refreshViews();
  });

  els.overlayToggle.addEventListener("click", () => {
    state.overlayMode = !state.overlayMode;
    document.body.classList.toggle("overlay-mode", state.overlayMode);
    els.overlayToggle.textContent = `Clone-Gram Overlay: ${state.overlayMode ? "On" : "Off"}`;
  });

  els.vaultPass.addEventListener("input", () => {
    const strength = evaluatePassphraseStrength(els.vaultPass.value);
    els.strengthFill.setAttribute("data-strength", strength.level);
    els.strengthLabel.textContent = strength.label;
    els.strengthLabel.style.color =
      strength.level === "strong" ? "var(--lime)" :
      strength.level === "fair" ? "var(--gold)" :
      strength.level === "weak" ? "var(--danger)" : "var(--muted)";
  });

  els.exportVault.addEventListener("click", exportVaultArchive);

  els.vaultImportZone.addEventListener("click", () => els.vaultImportFile.click());
  els.vaultImportZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") els.vaultImportFile.click();
  });
  els.vaultImportFile.addEventListener("change", () => {
    if (els.vaultImportFile.files.length) {
      els.vaultImportZone.querySelector("p").textContent = els.vaultImportFile.files[0].name;
    }
  });
  els.importVault.addEventListener("click", importVaultArchive);

  wireFileEvents();
  wireAdminEvents();

  els.clearData.addEventListener("click", async () => {
    const confirmed = confirm(
      "⚠️ This will permanently erase all keys, messages, files, chain data, and rewards.\n\nAre you sure?"
    );
    if (!confirmed) return;
    localStorage.removeItem(STORAGE.relay);
    localStorage.removeItem(STORAGE.chain);
    localStorage.removeItem(STORAGE.rewards);
    localStorage.removeItem(STORAGE.keys);
    localStorage.removeItem(STORAGE.files);
    clearAllFileShards();
    state.keys = loadKeys(true);
    state.packets = [];
    state.filePackets = [];
    state.rewards = loadRewards(true);
    state.chain = await loadOrCreateChain(true);
    els.messageInput.value = "";
    persistAll();
    if (state.serverOnline) {
      await api("POST", "/admin/log/clear");
    }
    await refreshViews();
    showNotice("All data has been reset.");
  });
}

/* ────────── Admin Log Events ────────── */

function wireAdminEvents() {
  els.adminRefresh.addEventListener("click", () => renderAdminLog());
  els.adminClear.addEventListener("click", async () => {
    if (!confirm("Clear the admin activity log?")) return;
    if (state.serverOnline) {
      await api("POST", "/admin/log/clear");
    }
    renderAdminLog();
    showNotice("Admin log cleared.");
  });
  els.adminAutoRefreshToggle.addEventListener("change", (e) => {
    state.adminAutoRefresh = e.target.checked;
    if (state.adminAutoRefresh && state.currentView === "admin") {
      startAdminAutoRefresh();
    } else {
      stopAdminAutoRefresh();
    }
  });
}

function startAdminAutoRefresh() {
  stopAdminAutoRefresh();
  state.adminRefreshTimer = setInterval(() => renderAdminLog(), 3000);
}

function stopAdminAutoRefresh() {
  if (state.adminRefreshTimer) {
    clearInterval(state.adminRefreshTimer);
    state.adminRefreshTimer = null;
  }
}

/* ────────── View Management ────────── */

function renderSelectors() {
  const options = CONTACTS.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(capitalize(c))}</option>`).join("");
  els.activeUser.innerHTML = options;
  els.recipientUser.innerHTML = options;
  els.qrContactSelect.innerHTML = options;
  els.qrImportTarget.innerHTML = options;
  els.fileFrom.innerHTML = options;
  els.fileTo.innerHTML = options;
  els.activeUser.value = state.activeUser;
  els.recipientUser.value = state.recipient;
  els.qrContactSelect.value = state.activeUser;
  els.qrImportTarget.value = state.recipient;
  els.fileFrom.value = state.activeUser;
  els.fileTo.value = state.recipient;
  Array.from(els.recipientUser.options).forEach((option) => {
    option.disabled = option.value === state.activeUser;
  });
  if (state.recipient === state.activeUser) {
    const firstValid = CONTACTS.find((c) => c !== state.activeUser);
    if (firstValid) {
      state.recipient = firstValid;
      els.recipientUser.value = firstValid;
    }
  }
}

function setView(view) {
  state.currentView = view;
  els.viewLinks.forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  els.viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
  if (view === "admin") {
    renderAdminLog();
    if (state.adminAutoRefresh) startAdminAutoRefresh();
  } else {
    stopAdminAutoRefresh();
  }
}

/* ────────── Send & Decrypt ────────── */

async function sendMessage() {
  const from = state.activeUser;
  const to = state.recipient;
  const message = els.messageInput.value.trim();

  if (!message) {
    showNotice("Please type a message first.", true);
    return;
  }

  const fromKey = state.keys[from];
  const toKey = state.keys[to];
  if (!fromKey || !toKey) {
    showNotice("Both contacts need keys set up. Go to Contacts to generate them.", true);
    return;
  }

  els.sendMessage.classList.add("is-loading");
  els.sendMessage.disabled = true;

  try {
    const sharedKey = await deriveSharedKey(fromKey, toKey);
    const encrypted = await encryptMessage(sharedKey, message);

    const packet = {
      id: crypto.randomUUID(),
      from,
      to,
      ts: new Date().toISOString(),
      payload: encrypted.payload,
      iv: encrypted.iv,
      shards: shardCiphertext(encrypted.payload, 3),
    };

    state.packets.push(packet);
    persistRelayPackets(state.packets);

    // Sync to server
    if (state.serverOnline) {
      await api("POST", "/packets", packet);
    }

    await anchorPacketOnChain(packet);
    state.rewards[from] = (state.rewards[from] || 0) + 1;
    state.rewards[to] = (state.rewards[to] || 0) + 1;
    persistRewards(state.rewards);

    if (state.serverOnline) {
      await api("PUT", "/rewards", { rewards: state.rewards });
    }

    els.messageInput.value = "";
    await refreshViews();
    showNotice(`Message sent! +1 token for ${capitalize(from)} and ${capitalize(to)}.`);
  } catch (error) {
    showNotice(`Failed to send: ${error.message || String(error)}`, true);
  } finally {
    els.sendMessage.classList.remove("is-loading");
    els.sendMessage.disabled = false;
  }
}

async function refreshViews() {
  renderIdentityList();
  renderRelay();
  renderQrCard();
  renderTokenBar();
  renderChain();
  renderFileList();
  await renderConversation();
  if (state.currentView === "admin") {
    renderAdminLog();
  }
}

/* ────────── Renderers ────────── */

function renderIdentityList() {
  const cards = CONTACTS.map((contact) => {
    const key = state.keys[contact] || "";
    return `
      <div class="identity-card">
        <div class="identity-meta">
          <strong>${escapeHtml(capitalize(contact))}</strong>
          <span class="muted">${shortAddress(key)}</span>
        </div>
        <input data-user="${escapeHtml(contact)}" value="${escapeHtml(key)}" placeholder="encryption key" autocomplete="off" />
        <div class="identity-actions">
          <button class="ghost" data-action="generate" data-user="${escapeHtml(contact)}">🔑 New Key</button>
        </div>
      </div>`;
  }).join("");
  els.identityList.innerHTML = cards;
}

function renderRelay() {
  if (!state.packets.length) {
    els.relayLog.innerHTML = '<div class="log-item muted">No encrypted data on the relay yet.</div>';
    return;
  }
  const items = state.packets.slice().reverse().map((packet) => {
    const shardText = packet.shards.map((shard, index) => `Shard ${index + 1}: ${shard.slice(0, 12)}…`).join(" | ");
    return `<div class="log-item">
      <div><strong>${escapeHtml(packet.from)}</strong> → <strong>${escapeHtml(packet.to)}</strong> <span class="muted">${formatTime(packet.ts)}</span></div>
      <div class="muted">${escapeHtml(shardText)}</div>
    </div>`;
  }).join("");
  els.relayLog.innerHTML = items;
}

async function renderConversation() {
  const a = state.activeUser;
  const b = state.recipient;
  const aKey = state.keys[a];
  const bKey = state.keys[b];

  if (!aKey || !bKey) {
    els.inboxLog.innerHTML = '<li class="empty-state"><div class="empty-icon">🔑</div><p>Set up keys for both contacts to see messages.</p></li>';
    return;
  }

  const lane = state.packets
    .filter((p) => (p.from === a && p.to === b) || (p.from === b && p.to === a))
    .slice(-30);

  if (!lane.length) {
    els.inboxLog.innerHTML = '<li class="empty-state"><div class="empty-icon">💬</div><p>No messages yet. Say hello!</p></li>';
    return;
  }

  const sharedKey = await deriveSharedKey(aKey, bKey);
  const messages = [];

  for (const packet of lane) {
    try {
      const plaintext = await decryptMessage(sharedKey, packet.payload, packet.iv);
      const side = packet.from === a ? "self" : "peer";
      messages.push(`<li class="msg ${side}"><strong>${escapeHtml(packet.from)}:</strong> ${escapeHtml(plaintext)}</li>`);
    } catch {
      messages.push(`<li class="msg">${escapeHtml(packet.from)}: [could not decrypt]</li>`);
    }
  }

  els.inboxLog.innerHTML = messages.join("");
  requestAnimationFrame(() => {
    els.inboxLog.scrollTop = els.inboxLog.scrollHeight;
  });
}

function renderTokenBar() {
  els.tokenBar.innerHTML = CONTACTS.map((contact) => {
    const value = state.rewards[contact] || 0;
    return `<span>🪙 ${escapeHtml(capitalize(contact))}: ${value} tokens</span>`;
  }).join("");
}

function renderQrCard() {
  const user = els.qrContactSelect.value || state.activeUser;
  const key = state.keys[user] || "";
  const payload = `ghostgraph://key-exchange?user=${encodeURIComponent(user)}&key=${encodeURIComponent(key)}`;
  els.qrPayload.value = payload;
  drawQrCode(els.qrCanvas, payload);
}

function renderChain() {
  els.chainHeight.textContent = String(state.chain.length - 1);
  const rows = state.chain.slice().reverse().map((block) => {
    return `<div class="log-item">
      <div>Block #${block.index} • ${block.txCount} transaction${block.txCount !== 1 ? "s" : ""} • nonce: ${block.nonce}</div>
      <div class="muted">hash: ${escapeHtml(block.hash.slice(0, 26))}…</div>
    </div>`;
  }).join("");
  els.chainLog.innerHTML = rows || '<div class="log-item muted">No blocks yet.</div>';
}

/* ────────── Admin Log Renderer ────────── */

const ADMIN_TYPE_CONFIG = {
  encryption: { icon: "🔐", color: "var(--neon)", label: "Encrypted" },
  shard: { icon: "🧩", color: "var(--violet)", label: "Sharded" },
  block: { icon: "🧱", color: "var(--lime)", label: "Mined" },
  file: { icon: "📁", color: "var(--gold)", label: "File" },
  download: { icon: "⬇️", color: "var(--text-secondary)", label: "Download" },
};

async function renderAdminLog() {
  if (!state.serverOnline) {
    els.adminLogList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔌</div>
        <p>Server is offline. Start the server to see activity logs.</p>
      </div>`;
    return;
  }

  const result = await api("GET", "/admin/log");
  if (!result || !result.log) {
    els.adminLogList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Could not fetch logs from server.</p>
      </div>`;
    return;
  }

  if (!result.log.length) {
    els.adminLogList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>No activity yet. Send a message or file to see events here.</p>
      </div>`;
    return;
  }

  const entries = result.log.slice(0, 100).map((entry) => {
    const config = ADMIN_TYPE_CONFIG[entry.type] || { icon: "📝", color: "var(--muted)", label: entry.type };
    const details = entry.details || {};
    let detailHtml = "";

    if (details.payloadPreview) {
      detailHtml += `<div class="admin-detail"><span class="detail-label">Ciphertext:</span> <code>${escapeHtml(details.payloadPreview)}</code></div>`;
    }
    if (details.shardPreviews) {
      detailHtml += details.shardPreviews.map((s) =>
        `<div class="admin-detail"><span class="detail-label">Shard ${s.index}:</span> <code>${escapeHtml(s.preview)}</code></div>`
      ).join("");
    }
    if (details.nodes) {
      detailHtml += `<div class="admin-detail"><span class="detail-label">Nodes:</span> ${details.nodes.map((n) => `<span class="admin-node-badge">${escapeHtml(n)}</span>`).join(" ")}</div>`;
    }
    if (details.hash) {
      detailHtml += `<div class="admin-detail"><span class="detail-label">Hash:</span> <code>${escapeHtml(details.hash)}</code></div>`;
    }
    if (details.fileName) {
      detailHtml += `<div class="admin-detail"><span class="detail-label">File:</span> ${escapeHtml(details.fileName)}</div>`;
    }
    if (details.fileHash) {
      detailHtml += `<div class="admin-detail"><span class="detail-label">SHA-256:</span> <code>${escapeHtml(details.fileHash)}</code></div>`;
    }

    return `<div class="admin-log-entry">
      <div class="admin-log-icon" style="color:${config.color}">${config.icon}</div>
      <div class="admin-log-content">
        <div class="admin-log-header">
          <span class="admin-log-type" style="color:${config.color}">${config.label}</span>
          <span class="admin-log-time">${formatTime(entry.ts)}</span>
        </div>
        <div class="admin-log-summary">${escapeHtml(entry.summary)}</div>
        ${detailHtml ? `<div class="admin-details">${detailHtml}</div>` : ""}
      </div>
    </div>`;
  }).join("");

  els.adminLogList.innerHTML = entries;
}

/* ────────── GhostFile — E2EE File Sharing ────────── */

const RELAY_NODES = ["node-alpha", "node-beta", "node-gamma", "node-delta", "node-epsilon"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILE_SHARD_COUNT = 5;

function wireFileEvents() {
  els.fileDropZone.addEventListener("click", () => els.fileInput.click());
  els.fileDropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") els.fileInput.click();
  });
  els.fileDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.fileDropZone.classList.add("is-drag-over");
  });
  els.fileDropZone.addEventListener("dragleave", () => {
    els.fileDropZone.classList.remove("is-drag-over");
  });
  els.fileDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.fileDropZone.classList.remove("is-drag-over");
    if (e.dataTransfer.files.length) handleFileSend(e.dataTransfer.files[0]);
  });
  els.fileInput.addEventListener("change", () => {
    if (els.fileInput.files.length) {
      handleFileSend(els.fileInput.files[0]);
      els.fileInput.value = "";
    }
  });
  els.fileFrom.addEventListener("change", () => {
    state.activeUser = els.fileFrom.value;
    if (state.activeUser === state.recipient) {
      state.recipient = CONTACTS.find((c) => c !== state.activeUser) || state.activeUser;
    }
    renderSelectors();
    renderFileList();
  });
  els.fileTo.addEventListener("change", () => {
    state.recipient = els.fileTo.value;
    renderSelectors();
    renderFileList();
  });
  els.fileList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-download-file]");
    if (!btn) return;
    await downloadFile(btn.dataset.downloadFile);
  });
}

async function handleFileSend(file) {
  if (file.size > MAX_FILE_SIZE) {
    showNotice(`File too large (${formatFileSize(file.size)}). Max 5 MB.`, true);
    return;
  }
  const from = els.fileFrom.value;
  const to = els.fileTo.value;
  if (from === to) {
    showNotice("Sender and recipient must be different people.", true);
    return;
  }
  const fromKey = state.keys[from];
  const toKey = state.keys[to];
  if (!fromKey || !toKey) {
    showNotice("Both contacts need keys. Go to Contacts to set them up.", true);
    return;
  }

  els.fileProgress.hidden = false;
  setFileProgress("Reading file…", 10);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    setFileProgress("Creating file fingerprint…", 20);
    const fileHash = await sha256Hex(bytesToBase64(fileBytes));

    setFileProgress("Encrypting…", 35);
    const sharedKey = await deriveSharedKey(fromKey, toKey);
    const encrypted = await encryptFileData(sharedKey, fileBytes);

    setFileProgress("Splitting into 5 encrypted pieces…", 55);
    await yieldToUi();
    const encryptedBytes = base64ToBytes(encrypted.payload);
    const shards = shardFileBytes(encryptedBytes, FILE_SHARD_COUNT);

    setFileProgress("Distributing to relay nodes…", 70);
    await yieldToUi();
    const packetId = crypto.randomUUID();
    distributeFileShards(packetId, shards);

    // Send shards to server
    if (state.serverOnline) {
      const shardPayload = shards.map((s, i) => ({
        node: RELAY_NODES[i],
        data: bytesToBase64(s),
      }));
      await api("POST", `/files/${packetId}/shards`, { shards: shardPayload });
    }

    setFileProgress("Recording on blockchain…", 85);
    const filePacket = {
      id: packetId,
      type: "file",
      from,
      to,
      ts: new Date().toISOString(),
      fileName: file.name,
      fileSize: file.size,
      fileHash,
      iv: encrypted.iv,
      shardCount: FILE_SHARD_COUNT,
      relayNodes: [...RELAY_NODES],
    };

    state.filePackets.push(filePacket);
    persistFilePackets(state.filePackets);

    if (state.serverOnline) {
      await api("POST", "/files", filePacket);
    }

    await anchorPacketOnChain({
      id: packetId, from, to, payload: fileHash,
    });

    state.rewards[from] = (state.rewards[from] || 0) + 2;
    state.rewards[to] = (state.rewards[to] || 0) + 2;
    persistRewards(state.rewards);
    if (state.serverOnline) {
      await api("PUT", "/rewards", { rewards: state.rewards });
    }

    setFileProgress("Done! File encrypted & distributed.", 100);
    await refreshViews();
    showNotice(`"${escapeHtml(file.name)}" encrypted into ${FILE_SHARD_COUNT} pieces across ${FILE_SHARD_COUNT} nodes. +2 tokens each.`);

    setTimeout(() => { els.fileProgress.hidden = true; }, 2000);
  } catch (error) {
    showNotice(`File send failed: ${error.message || String(error)}`, true);
    els.fileProgress.hidden = true;
  }
}

async function downloadFile(packetId) {
  const packet = state.filePackets.find((p) => p.id === packetId);
  if (!packet) {
    showNotice("File not found.", true);
    return;
  }
  const a = state.activeUser;
  const aKey = state.keys[a];
  const otherUser = packet.from === a ? packet.to : packet.from;
  const otherKey = state.keys[otherUser];
  if (!aKey || !otherKey) {
    showNotice("Need keys for both sender and receiver to decrypt.", true);
    return;
  }

  showNotice("Collecting encrypted pieces from relay nodes…");

  try {
    let shards = null;

    // Try server first
    if (state.serverOnline) {
      const result = await api("GET", `/files/${packetId}/shards`);
      if (result?.shards?.length === packet.shardCount) {
        shards = result.shards.map((s) => base64ToBytes(s.data));
      }
    }

    // Fallback to localStorage
    if (!shards) {
      shards = collectFileShards(packetId, packet.shardCount);
    }

    if (!shards || shards.length !== packet.shardCount) {
      showNotice("Couldn't collect all pieces. Some relay nodes may be offline.", true);
      return;
    }

    const reassembled = reassembleFileShards(shards);
    const sharedKey = await deriveSharedKey(aKey, otherKey);
    const decryptedBytes = await decryptFileData(sharedKey, bytesToBase64(reassembled), packet.iv);

    const downloadHash = await sha256Hex(bytesToBase64(decryptedBytes));
    if (downloadHash !== packet.fileHash) {
      showNotice("⚠️ File integrity check failed! The file may be corrupted.", true);
    }

    const blob = new Blob([decryptedBytes]);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = packet.fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    showNotice(`"${escapeHtml(packet.fileName)}" decrypted and downloaded!`);
  } catch (error) {
    showNotice(`Download failed: ${error.message || "Decryption error — wrong keys?"}`, true);
  }
}

async function encryptFileData(sharedKeyBuffer, fileBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", sharedKeyBuffer, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fileBytes);
  return { iv: bytesToBase64(iv), payload: bytesToBase64(new Uint8Array(encrypted)) };
}

async function decryptFileData(sharedKeyBuffer, payloadB64, ivB64) {
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(payloadB64);
  const key = await crypto.subtle.importKey("raw", sharedKeyBuffer, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new Uint8Array(decrypted);
}

function shardFileBytes(bytes, count) {
  const shardSize = Math.ceil(bytes.length / count);
  const shards = [];
  for (let i = 0; i < count; i++) {
    shards.push(bytes.slice(i * shardSize, Math.min((i + 1) * shardSize, bytes.length)));
  }
  return shards;
}

function reassembleFileShards(shards) {
  const totalLength = shards.reduce((sum, s) => sum + s.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const shard of shards) { merged.set(shard, offset); offset += shard.length; }
  return merged;
}

function distributeFileShards(packetId, shards) {
  for (let i = 0; i < shards.length; i++) {
    localStorage.setItem(`ghostgraph-shard-${packetId}-${RELAY_NODES[i]}`, bytesToBase64(shards[i]));
  }
}

function collectFileShards(packetId, count) {
  const shards = [];
  for (let i = 0; i < count; i++) {
    const raw = localStorage.getItem(`ghostgraph-shard-${packetId}-${RELAY_NODES[i]}`);
    if (!raw) return null;
    shards.push(base64ToBytes(raw));
  }
  return shards;
}

function clearAllFileShards() {
  Object.keys(localStorage).filter((k) => k.startsWith("ghostgraph-shard-")).forEach((k) => localStorage.removeItem(k));
}

function setFileProgress(label, percent) {
  els.fileProgressLabel.textContent = label;
  els.fileProgressFill.style.width = `${percent}%`;
}

function renderFileList() {
  const a = state.activeUser;
  const b = state.recipient;
  const relevantFiles = state.filePackets
    .filter((p) => (p.from === a && p.to === b) || (p.from === b && p.to === a))
    .slice().reverse();

  if (!relevantFiles.length) {
    els.fileList.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><p>No files shared yet. Drag a file above to get started.</p></div>';
    return;
  }

  const cards = relevantFiles.map((packet) => {
    const isSender = packet.from === a;
    const direction = isSender ? `You → ${escapeHtml(capitalize(packet.to))}` : `${escapeHtml(capitalize(packet.from))} → You`;
    const shardSegments = packet.relayNodes.map((node, i) => `<div class="shard-segment" title="${escapeHtml(node)}">S${i + 1}</div>`).join("");
    const nodeLabels = packet.relayNodes.map((node) => `<div class="shard-node-label">${escapeHtml(node.replace("node-", ""))}</div>`).join("");

    return `<div class="file-card">
      <div class="file-card-header">
        <div class="file-card-info">
          <div class="file-card-name" title="${escapeHtml(packet.fileName)}">📄 ${escapeHtml(packet.fileName)}</div>
          <div class="file-card-meta">
            <span class="direction">${direction}</span>
            <span>${formatFileSize(packet.fileSize)}</span>
            <span>${formatTime(packet.ts)}</span>
          </div>
        </div>
        <div class="file-card-actions">
          <button data-download-file="${escapeHtml(packet.id)}" aria-label="Download and decrypt file">⬇ Download</button>
        </div>
      </div>
      <div class="shard-map">
        <div class="shard-map-label">Distributed across ${packet.shardCount} relay nodes</div>
        <div class="shard-bar">${shardSegments}</div>
        <div class="shard-nodes">${nodeLabels}</div>
      </div>
      <div class="file-hash">sha256: ${escapeHtml(packet.fileHash.slice(0, 32))}…</div>
    </div>`;
  }).join("");

  els.fileList.innerHTML = cards;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadFilePackets() {
  try {
    const raw = localStorage.getItem(STORAGE.files);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p?.type === "file" && p?.id && p?.fileName);
  } catch { return []; }
}

function persistFilePackets(packets) {
  localStorage.setItem(STORAGE.files, JSON.stringify(packets));
}

/* ────────── Blockchain ────────── */

async function anchorPacketOnChain(packet) {
  const prevBlock = state.chain[state.chain.length - 1];
  const txHash = await sha256Hex(`${packet.id}|${packet.from}|${packet.to}|${packet.payload}`);
  const block = {
    index: prevBlock.index + 1,
    ts: new Date().toISOString(),
    prevHash: prevBlock.hash,
    txCount: 1,
    txHashes: [txHash],
    nonce: 0,
    hash: "",
  };
  block.hash = await mineHash(block, 3);
  state.chain.push(block);
  persistChain(state.chain);

  if (state.serverOnline) {
    await api("POST", "/chain", block);
  }
}

async function mineHash(block, difficulty) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (true) {
    const candidate = await sha256Hex(
      `${block.index}|${block.ts}|${block.prevHash}|${block.txHashes.join(",")}|${nonce}`
    );
    if (candidate.startsWith(prefix)) {
      block.nonce = nonce;
      return candidate;
    }
    nonce += 1;
    if (nonce % 350 === 0) await yieldToUi();
  }
}

/* ────────── Vault Export / Import ────────── */

async function exportVaultArchive() {
  const passphrase = els.vaultPass.value;
  if (!passphrase || passphrase.length < 8) {
    showNotice("Password must be at least 8 characters.", true);
    return;
  }
  const payload = {
    version: "ghostgraph-v3",
    exportedAt: new Date().toISOString(),
    keys: state.keys,
    packets: state.packets,
    chain: state.chain,
    rewards: state.rewards,
  };
  try {
    const encrypted = await encryptWithPassphrase(JSON.stringify(payload), passphrase);
    downloadTextFile(`ghostgraph-backup-${Date.now()}.ghostvault`, JSON.stringify(encrypted, null, 2));
    showNotice("Backup created! Store your password safely.");
  } catch (error) {
    showNotice(`Backup failed: ${error.message || String(error)}`, true);
  }
}

async function importVaultArchive() {
  const file = els.vaultImportFile.files[0];
  const passphrase = els.vaultImportPass.value;
  if (!file) { showNotice("Select a .ghostvault file first.", true); return; }
  if (!passphrase || passphrase.length < 8) { showNotice("Enter the backup password (min 8 chars).", true); return; }

  try {
    const text = await file.text();
    const encrypted = JSON.parse(text);
    if (encrypted.format !== "ghostvault-aesgcm-pbkdf2") {
      showNotice("This doesn't look like a valid backup file.", true);
      return;
    }
    const decrypted = await decryptWithPassphrase(encrypted, passphrase);
    const payload = JSON.parse(decrypted);
    if (payload.version !== "ghostgraph-v3") {
      showNotice("Unsupported backup version.", true);
      return;
    }
    if (payload.keys) {
      state.keys = { ...state.keys, ...payload.keys };
      persistKeys(state.keys);
    }
    if (Array.isArray(payload.packets)) {
      const existingIds = new Set(state.packets.map((p) => p.id));
      state.packets = [...state.packets, ...payload.packets.filter((p) => !existingIds.has(p.id))];
      persistRelayPackets(state.packets);
    }
    if (Array.isArray(payload.chain) && payload.chain.length > state.chain.length) {
      state.chain = payload.chain;
      persistChain(state.chain);
    }
    if (payload.rewards) {
      for (const contact of CONTACTS) {
        state.rewards[contact] = Math.max(state.rewards[contact] || 0, payload.rewards[contact] || 0);
      }
      persistRewards(state.rewards);
    }
    await refreshViews();
    showNotice(`Backup restored! ${payload.packets?.length || 0} messages recovered.`);
  } catch (error) {
    showNotice(`Restore failed: ${error.message || "Wrong password or corrupted file."}`, true);
  }
}

/* ────────── Crypto Utilities ────────── */

async function encryptWithPassphrase(text, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, baseKey,
    { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { format: "ghostvault-aesgcm-pbkdf2", salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) };
}

async function decryptWithPassphrase(encrypted, passphrase) {
  const salt = base64ToBytes(encrypted.salt);
  const iv = base64ToBytes(encrypted.iv);
  const data = base64ToBytes(encrypted.ciphertext);
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, baseKey,
    { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

function parseImportedPayload(raw) {
  try {
    if (raw.startsWith("ghostgraph://")) {
      const url = new URL(raw.replace("ghostgraph://", "https://ghostgraph.local/"));
      const key = url.searchParams.get("key")?.trim();
      if (key && /^[0-9a-fA-F]+$/.test(key)) return { key };
      return null;
    }
    if (raw.includes(":")) {
      const cleaned = raw.split(":")[1]?.trim();
      if (cleaned && /^[0-9a-fA-F]{16,128}$/.test(cleaned)) return { key: cleaned };
    }
  } catch { return null; }
  return null;
}

async function loadOrCreateChain(forceFresh = false) {
  if (!forceFresh) {
    const stored = loadChain();
    if (stored.length) return stored;
  }
  const genesis = {
    index: 0, ts: new Date().toISOString(), prevHash: "GENESIS",
    txCount: 0, txHashes: [], nonce: 0,
    hash: await sha256Hex("ghostgraph-genesis"),
  };
  persistChain([genesis]);
  return [genesis];
}

async function deriveSharedKey(keyA, keyB) {
  const [first, second] = [keyA, keyB].sort();
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${first}:${second}`));
}

async function encryptMessage(sharedKeyBuffer, message) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", sharedKeyBuffer, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(message));
  return { iv: bytesToBase64(iv), payload: bytesToBase64(new Uint8Array(encrypted)) };
}

async function decryptMessage(sharedKeyBuffer, payload, ivB64) {
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(payload);
  const key = await crypto.subtle.importKey("raw", sharedKeyBuffer, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

function shardCiphertext(ciphertext, shardCount) {
  const size = Math.ceil(ciphertext.length / shardCount);
  const shards = [];
  for (let i = 0; i < shardCount; i++) shards.push(ciphertext.slice(i * size, i * size + size));
  return shards;
}

/* ────────── Persistence ────────── */

function loadKeys(forceFresh = false) {
  if (!forceFresh) {
    const raw = localStorage.getItem(STORAGE.keys);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const valid = CONTACTS.reduce((acc, c) => { acc[c] = parsed[c] || ""; return acc; }, {});
        if (Object.values(valid).some(Boolean)) return valid;
      } catch {}
    }
  }
  const keys = CONTACTS.reduce((acc, c) => { acc[c] = randomHex(32); return acc; }, {});
  persistKeys(keys);
  return keys;
}

function loadRewards(forceFresh = false) {
  if (!forceFresh) {
    try {
      const raw = localStorage.getItem(STORAGE.rewards);
      if (raw) {
        const parsed = JSON.parse(raw);
        return CONTACTS.reduce((acc, c) => { acc[c] = Number(parsed[c]) || 0; return acc; }, {});
      }
    } catch {}
  }
  const rewards = CONTACTS.reduce((acc, c) => { acc[c] = 0; return acc; }, {});
  persistRewards(rewards);
  return rewards;
}

function loadRelayPackets() {
  try {
    const raw = localStorage.getItem(STORAGE.relay);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((i) => i?.payload && i?.iv && i?.from && i?.to) : [];
  } catch { return []; }
}

function loadChain() {
  try {
    const raw = localStorage.getItem(STORAGE.chain);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistKeys(keys) { localStorage.setItem(STORAGE.keys, JSON.stringify(keys)); }
function persistRewards(rewards) { localStorage.setItem(STORAGE.rewards, JSON.stringify(rewards)); }
function persistRelayPackets(packets) { localStorage.setItem(STORAGE.relay, JSON.stringify(packets)); }
function persistChain(chain) { localStorage.setItem(STORAGE.chain, JSON.stringify(chain)); }
function persistAll() { persistKeys(state.keys); persistRelayPackets(state.packets); persistChain(state.chain); persistRewards(state.rewards); }

/* ────────── Helpers ────────── */

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let str = "";
  bytes.forEach((v) => { str += String.fromCharCode(v); });
  return btoa(str);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function randomHex(byteLength = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function shortAddress(key) {
  return key ? `${key.slice(0, 6)}…${key.slice(-6)}` : "no key";
}

function formatTime(iso) { return new Date(iso).toLocaleTimeString(); }

function showNotice(message, isError = false) {
  clearTimeout(_bannerTimeout);
  els.banner.textContent = message;
  els.banner.classList.toggle("is-error", isError);
  els.banner.classList.remove("is-fading");
  els.banner.style.color = isError ? "var(--danger)" : "var(--lime)";
  _bannerTimeout = setTimeout(() => {
    els.banner.classList.add("is-fading");
    setTimeout(() => { els.banner.textContent = ""; els.banner.classList.remove("is-fading", "is-error"); }, 300);
  }, 6000);
}

function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function yieldToUi() { return new Promise((r) => setTimeout(r, 0)); }

function evaluatePassphraseStrength(p) {
  if (!p) return { level: "", label: "" };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (p.length >= 16) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  if (s <= 2) return { level: "weak", label: "Weak — add more length & variety" };
  if (s <= 4) return { level: "fair", label: "Fair — consider adding symbols" };
  return { level: "strong", label: "Strong password ✓" };
}

/* ────────── QR Code Generator ────────── */

function drawQrCode(canvas, text) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const modules = generateQrMatrix(text);
  const moduleCount = modules.length;
  const cellSize = size / moduleCount;
  ctx.fillStyle = "#0c0d16";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#00dcff";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        ctx.fillRect(Math.round(col * cellSize), Math.round(row * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  }
}

function generateQrMatrix(text) {
  const n = 25;
  const matrix = Array.from({ length: n }, () => Array(n).fill(false));
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, 0, n - 7);
  drawFinderPattern(matrix, n - 7, 0);
  drawAlignmentPattern(matrix, 18, 18);
  for (let i = 8; i < n - 8; i++) { matrix[6][i] = i % 2 === 0; matrix[i][6] = i % 2 === 0; }
  const hash = simpleHash(text);
  let bitIndex = 0;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let row = 0; row < n; row++) {
      for (let c = 0; c < 2; c++) {
        const x = col - c, y = row;
        if (!isReserved(x, y, n)) {
          matrix[y][x] = ((hash[bitIndex % hash.length] >> (bitIndex % 8)) & 1) === 1;
          bitIndex++;
        }
      }
    }
  }
  return matrix;
}

function drawFinderPattern(m, sr, sc) {
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const outer = r === 0 || r === 6 || c === 0 || c === 6;
    const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
    m[sr + r][sc + c] = outer || inner;
  }
  for (let i = -1; i <= 7; i++) {
    setIfValid(m, sr - 1, sc + i, false); setIfValid(m, sr + 7, sc + i, false);
    setIfValid(m, sr + i, sc - 1, false); setIfValid(m, sr + i, sc + 7, false);
  }
}

function drawAlignmentPattern(m, cr, cc) {
  for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
    m[cr + r][cc + c] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
  }
}

function setIfValid(m, r, c, v) {
  if (r >= 0 && r < m.length && c >= 0 && c < m[0].length) m[r][c] = v;
}

function isReserved(x, y, n) {
  if (x <= 8 && y <= 8) return true;
  if (x <= 8 && y >= n - 8) return true;
  if (x >= n - 8 && y <= 8) return true;
  if (x === 6 || y === 6) return true;
  if (x >= 16 && x <= 20 && y >= 16 && y <= 20) return true;
  return false;
}

function simpleHash(str) {
  const result = new Uint8Array(64);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    result[i % 64] = (result[i % 64] ^ c ^ (i * 31)) & 0xff;
    result[(i + 17) % 64] = (result[(i + 17) % 64] + c * 7 + i) & 0xff;
    result[(i + 37) % 64] = (result[(i + 37) % 64] ^ (c * 13 + i * 3)) & 0xff;
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < 64; i++) {
      result[i] = (result[i] ^ result[(i + 1) % 64] ^ (result[(i + 31) % 64] * 3)) & 0xff;
    }
  }
  return result;
}
