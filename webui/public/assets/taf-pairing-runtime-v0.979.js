(() => {
  'use strict'

  const VERSION = '0.979'
  const CARD_SELECTOR = '[data-taf-pairing-runtime="0.979"]'
  const NATIVE_PAIRING_SELECTOR = '.pairing-card:not(.taf-runtime-pairing-card)'
  let pollTimer = null

  function patchFrontendVersionBadge() {
    const candidates = document.querySelectorAll('.version-badge, .el-tag')
    for (const el of candidates) {
      const text = (el.textContent || '').trim()
      if (!/frontend/i.test(text)) continue
      const replaced = text.replace(/v\d+\.\d+(?:\.\d+)?/i, `v${VERSION}`)
      if (replaced !== text) el.textContent = replaced
    }
    document.documentElement.dataset.tafEmbeddedFrontend = VERSION
  }

  function ensureStyles() {
    if (document.getElementById('taf-pairing-runtime-style')) return
    const style = document.createElement('style')
    style.id = 'taf-pairing-runtime-style'
    style.textContent = `
      .taf-runtime-pairing-card { border-color: rgba(64, 158, 255, .65) !important; }
      .taf-pairing-runtime-badge { display:inline-flex; align-items:center; min-height:22px; padding:0 9px; border-radius:4px; font-size:12px; font-weight:700; color:#fff; background:#909399; }
      .taf-pairing-runtime-badge[data-state="waiting"], .taf-pairing-runtime-badge[data-state="pairing"] { background:#e6a23c; }
      .taf-pairing-runtime-badge[data-state="success"] { background:#67c23a; }
      .taf-pairing-runtime-badge[data-state="failed"], .taf-pairing-runtime-badge[data-state="timeout"] { background:#f56c6c; }
      .taf-pairing-runtime-message { margin:8px 0 10px; padding:8px 10px; border:1px solid rgba(144,147,153,.3); border-radius:4px; font-size:12px; line-height:1.45; word-break:break-word; }
      .taf-pairing-runtime-actions { display:flex; gap:8px; flex-wrap:wrap; }
      .taf-pairing-runtime-note { margin-top:7px; opacity:.72; font-size:11px; line-height:1.4; }
    `
    document.head.appendChild(style)
  }

  function stateLabel(state) {
    return String(state || 'idle').toUpperCase()
  }

  function getRuntimeCard() {
    return document.querySelector(CARD_SELECTOR)
  }

  function renderPairing(state, message, rawHex) {
    const card = getRuntimeCard()
    if (!card) return
    const normalized = String(state || 'idle').toLowerCase()
    const badge = card.querySelector('[data-taf-pairing-badge]')
    const msg = card.querySelector('[data-taf-pairing-message]')
    const start = card.querySelector('[data-taf-pairing-start]')
    if (badge) {
      badge.dataset.state = normalized
      badge.textContent = stateLabel(normalized)
    }
    if (msg) {
      msg.textContent = message || 'No pairing session started'
      msg.title = rawHex || ''
    }
    if (start) {
      const busy = normalized === 'waiting' || normalized === 'pairing'
      start.disabled = busy
      start.textContent = busy ? 'Pairing in progress…' : '🔗 Re-pair Controller / Aircraft'
    }
  }

  async function pollStatus() {
    if (!getRuntimeCard()) return
    try {
      const response = await fetch(`/api/status?_tafPairing=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data && data.pairing) {
        renderPairing(data.pairing.state, data.pairing.lastMessage, data.pairing.resultRawHex)
      }
    } catch (_) {
      // Keep the last known status. The normal application connection indicator already exposes backend outages.
    }
  }

  async function startPairing() {
    const ok = window.confirm(
      'Start ATOM controller / aircraft pairing?\n\n' +
      'The controller will enter MiniPair mode. Afterwards put the aircraft into frequency-pairing mode using its power button.'
    )
    if (!ok) return

    renderPairing('waiting', 'Sending pairing command to the controller…')
    try {
      const response = await fetch('/api/cmd/pair', { method: 'POST', cache: 'no-store' })
      const text = await response.text()
      if (!response.ok) throw new Error(text || `HTTP ${response.status}`)
      renderPairing('waiting', 'Pairing command sent; waiting for controller pairing mode')
      await pollStatus()
    } catch (error) {
      renderPairing('failed', `Could not start pairing: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function resetPairing() {
    try {
      await fetch('/api/cmd/pair/reset', { method: 'POST', cache: 'no-store' })
    } catch (_) {}
    renderPairing('idle', 'No pairing session started')
  }

  function ensurePairingCard() {
    patchFrontendVersionBadge()

    // A freshly rebuilt Vue bundle already contains the native pairing panel.
    // In that case this compatibility bridge deliberately stays out of the UI.
    if (document.querySelector(NATIVE_PAIRING_SELECTOR)) {
      const runtime = getRuntimeCard()
      if (runtime) runtime.remove()
      return
    }

    if (getRuntimeCard()) return
    const panel = document.querySelector('.fpv-pane .fpv-controls-col .panel-box')
    if (!panel) return

    ensureStyles()
    const card = document.createElement('div')
    card.className = 'action-card highlight-card pairing-card taf-runtime-pairing-card'
    card.dataset.tafPairingRuntime = VERSION
    card.innerHTML = `
      <div class="act-header">
        <span class="act-name">ATOM Controller / Aircraft Pairing</span>
        <span class="taf-pairing-runtime-badge" data-taf-pairing-badge data-state="idle">IDLE</span>
      </div>
      <p class="act-desc">
        Starts the PotensicPro MiniPair sequence (FE 0x16 / function 0x18). After starting, put the aircraft into frequency-pairing mode using its power button.
      </p>
      <div class="taf-pairing-runtime-message" data-taf-pairing-message>No pairing session started</div>
      <div class="taf-pairing-runtime-actions">
        <button type="button" class="el-button el-button--primary el-button--small" data-taf-pairing-start>🔗 Re-pair Controller / Aircraft</button>
        <button type="button" class="el-button el-button--small is-plain" data-taf-pairing-reset>Reset Status</button>
      </div>
      <div class="taf-pairing-runtime-note">Status and result are monitored by the Android backend from 0x1715 / 0x1718 and are written to the Live Log.</div>
    `

    const title = panel.querySelector('.box-title')
    if (title && title.parentElement === panel) title.insertAdjacentElement('afterend', card)
    else panel.prepend(card)

    card.querySelector('[data-taf-pairing-start]')?.addEventListener('click', startPairing)
    card.querySelector('[data-taf-pairing-reset]')?.addEventListener('click', resetPairing)

    if (!pollTimer) pollTimer = window.setInterval(pollStatus, 1000)
    pollStatus()
  }

  const observer = new MutationObserver(() => ensurePairingCard())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('load', ensurePairingCard, { once: true })
  ensurePairingCard()
})()
