/* Purple Team shared shell: persistent nav, deep links, api helpers, toasts,
 * query-param state, v2 workspace draft persistence, command palette (Ctrl+K),
 * 4-Hat switcher shortcuts (Alt+1..4), platform capability fallbacks, and
 * mobile bottom navigation. Loaded by every /ui page. No colors here — all
 * paint comes from tokens.css via class names. */
(function () {
  'use strict';

  var PAGES = [
    { group: 'Command' },
    { id: 'overview', file: 'overview.html', label: 'Overview', icon: 'O' },
    { id: 'mission', file: 'mission.html', label: 'Mission', icon: 'M' },
    { id: 'operators', file: 'operators.html', label: 'Operatives', icon: 'P' },
    { id: 'hats', file: 'hats.html', label: 'Four Hats', icon: '4' },
    { id: 'evidence', file: 'evidence.html', label: 'Evidence', icon: 'E' },
    { id: 'defend', file: 'defend.html', label: 'Defend', icon: 'D' },
    { group: 'Toolkit' },
    { id: 'arsenal', file: 'arsenal.html', label: 'Arsenal', icon: 'A' },
    { id: 'terminal', file: 'terminal.html', label: 'Terminal', icon: 'T' },
    { group: 'Ranges' },
    { id: 'range', file: 'range.html', label: 'Range', icon: 'R' },
    { group: 'Operations' },
    { id: 'engagements', file: 'engagements.html', label: 'Engagements', icon: 'G' },
    { id: 'settings', file: 'settings.html', label: 'Settings', icon: 'S' },
    { id: 'about', file: 'about.html', label: 'About', icon: '?' }
  ];

  var HAT_PALETTE_ITEMS = [
    { id: 'hat-red', label: '[RED] Red Hat — Adversarial Validation', href: 'hats.html?hat=red', badge: 'red' },
    { id: 'hat-blue', label: '[BLUE] Blue Hat — Orchestration & Defense', href: 'hats.html?hat=blue', badge: 'blue' },
    { id: 'hat-black', label: '[BLACK] Black Hat — Stress, Risk & Policy', href: 'hats.html?hat=black', badge: 'black' },
    { id: 'hat-white', label: '[WHITE] White Hat — Evidence & Gap Analysis', href: 'hats.html?hat=white', badge: 'white' },
    { id: 'tool-blue-workflow-sequencer', label: 'Tool: Blue Workflow Sequencer', href: 'hats.html?hat=blue&tool=blue-workflow-sequencer', badge: 'blue' },
    { id: 'tool-blue-decision-ledger', label: 'Tool: Blue Decision Ledger', href: 'hats.html?hat=blue&tool=blue-decision-ledger', badge: 'blue' },
    { id: 'tool-blue-execution-monitor', label: 'Tool: Blue Execution Monitor', href: 'hats.html?hat=blue&tool=blue-execution-monitor', badge: 'blue' },
    { id: 'tool-white-data-inspector', label: 'Tool: White Data & Telemetry Inspector', href: 'hats.html?hat=white&tool=white-data-inspector', badge: 'white' },
    { id: 'tool-white-evidence-collector', label: 'Tool: White Fact & Evidence Collector', href: 'hats.html?hat=white&tool=white-evidence-collector', badge: 'white' },
    { id: 'tool-white-gap-analyzer', label: 'Tool: White Gap & Assumption Analyzer', href: 'hats.html?hat=white&tool=white-gap-analyzer', badge: 'white' },
    { id: 'tool-black-risk-analyzer', label: 'Tool: Black Risk & Failure-Mode Analyzer', href: 'hats.html?hat=black&tool=black-risk-analyzer', badge: 'black' },
    { id: 'tool-black-policy-validator', label: 'Tool: Black Constraint & Policy Validator', href: 'hats.html?hat=black&tool=black-policy-validator', badge: 'black' },
    { id: 'tool-black-stress-prober', label: 'Tool: Black Edge-Case & Stress Prober', href: 'hats.html?hat=black&tool=black-stress-prober', badge: 'black' },
    { id: 'tool-shared-context-transform', label: 'Tool: Cross-Hat Context Transformer (Send to Hat)', href: 'hats.html?hat=shared&tool=shared-context-transform', badge: 'purple' },
    { id: 'tool-shared-artifact-diff', label: 'Tool: Cross-Hat Artifact Diff', href: 'hats.html?hat=shared&tool=shared-artifact-diff', badge: 'purple' },
    { id: 'tool-shared-snapshot-manager', label: 'Tool: Versioned Snapshot Manager', href: 'hats.html?hat=shared&tool=shared-snapshot-manager', badge: 'purple' },
    { id: 'tool-shared-batch-runner', label: 'Tool: Cross-Hat Batch Runner', href: 'hats.html?hat=shared&tool=shared-batch-runner', badge: 'purple' },
    { id: 'skill-blue-incident-sequencer', label: 'Skill: Blue Incident Triage & Sequencer', href: 'hats.html?mode=skills&skill=skill-blue-incident-sequencer', badge: 'blue' },
    { id: 'skill-white-roe-gap-verification', label: 'Skill: White ROE & Telemetry Gap Verification', href: 'hats.html?mode=skills&skill=skill-white-roe-gap-verification', badge: 'white' },
    { id: 'skill-black-predeploy-stress-audit', label: 'Skill: Black Pre-Deployment Policy & Stress Audit', href: 'hats.html?mode=skills&skill=skill-black-predeploy-stress-audit', badge: 'black' },
    { id: 'skill-purple-four-hat-synthesis', label: 'Skill: Purple Four-Hat Closed-Loop Synthesis', href: 'hats.html?mode=skills&skill=skill-purple-four-hat-synthesis', badge: 'purple' }
  ];

  /* Legacy single-page ids (bookmarks, keyboard shortcuts, in-app links) map
   * onto the compartmentalized pages. See docs/IA.md for the full mapping. */
  var LEGACY_MAP = {
    warroom: 'overview.html',
    'live-scan': 'mission.html',
    receipts: 'mission.html',
    operators: 'operators.html',
    hats: 'hats.html',
    evidence: 'evidence.html',
    arsenal: 'arsenal.html',
    terminal: 'terminal.html',
    benchmarks: 'range.html',
    'ctf-range': 'range.html',
    general: 'engagements.html',
    selfimprove: 'engagements.html',
    configs: 'engagements.html',
    settings: 'settings.html',
    about: 'about.html'
  };

  var WORKSPACE_STORAGE_KEY = 't3mp3st_workspace_v2';
  var LEGACY_WORKSPACE_KEY = 't3mp3st_workspace_v1';

  function defaultWorkspaceState() {
    return {
      version: 2,
      activeHat: 'blue',
      toolDrafts: {},
      pinnedOutputs: [],
      forwardedContext: null,
      executionHistory: []
    };
  }

  function validHat(value) {
    return value === 'red' || value === 'blue' || value === 'black' || value === 'white' ? value : 'blue';
  }

  function hydrateWorkspaceState(raw) {
    var base = defaultWorkspaceState();
    if (!raw || typeof raw !== 'object') return base;
    base.activeHat = validHat(raw.activeHat || raw.currentHat || raw.hat);
    var drafts = raw.toolDrafts || raw.drafts;
    if (drafts && typeof drafts === 'object' && !Array.isArray(drafts)) {
      base.toolDrafts = Object.assign({}, drafts);
    }
    var pins = Array.isArray(raw.pinnedOutputs) ? raw.pinnedOutputs : (Array.isArray(raw.pins) ? raw.pins : []);
    base.pinnedOutputs = pins.slice(0, 25);
    if (raw.forwardedContext && typeof raw.forwardedContext === 'object') {
      base.forwardedContext = raw.forwardedContext;
    }
    if (Array.isArray(raw.executionHistory)) {
      base.executionHistory = raw.executionHistory.slice(0, 50);
    }
    return base;
  }

  var workspace = {
    get: function () {
      try {
        var rawV2 = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (rawV2) return hydrateWorkspaceState(JSON.parse(rawV2));
        var rawV1 = window.localStorage.getItem(LEGACY_WORKSPACE_KEY);
        if (rawV1) {
          var migrated = hydrateWorkspaceState(JSON.parse(rawV1));
          window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      } catch (e) { /* storage unavailable or corrupt JSON */ }
      return defaultWorkspaceState();
    },
    save: function (next) {
      var hydrated = hydrateWorkspaceState(next);
      try {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(hydrated));
      } catch (e) { /* storage unavailable */ }
      return hydrated;
    },
    setActiveHat: function (hat) {
      var st = workspace.get();
      st.activeHat = validHat(hat);
      return workspace.save(st);
    },
    saveDraft: function (toolId, draft) {
      if (!toolId) return workspace.get();
      var st = workspace.get();
      st.toolDrafts[toolId] = draft;
      return workspace.save(st);
    },
    getDraft: function (toolId) {
      var st = workspace.get();
      return st.toolDrafts[toolId] || null;
    },
    pinOutput: function (entry) {
      var st = workspace.get();
      var item = {
        id: String((entry && entry.id) || ('pin-' + Date.now())),
        hat: validHat(entry && entry.hat),
        toolId: String((entry && entry.toolId) || 'unknown'),
        title: String((entry && entry.title) || 'Pinned Output'),
        createdAt: new Date().toISOString(),
        payload: entry ? entry.payload : null
      };
      st.pinnedOutputs = [item].concat(st.pinnedOutputs.filter(function (p) { return p.id !== item.id; })).slice(0, 20);
      workspace.save(st);
      return item;
    },
    unpinOutput: function (id) {
      var st = workspace.get();
      st.pinnedOutputs = st.pinnedOutputs.filter(function (p) { return p.id !== id; });
      return workspace.save(st);
    },
    forwardContext: function (ctx) {
      var st = workspace.get();
      st.forwardedContext = {
        fromHat: validHat(ctx && ctx.fromHat),
        toHat: validHat(ctx && ctx.toHat),
        sourceToolId: String((ctx && ctx.sourceToolId) || 'workspace'),
        targetToolId: String((ctx && ctx.targetToolId) || ''),
        payload: ctx ? ctx.payload : null,
        forwardedAt: new Date().toISOString()
      };
      st.activeHat = st.forwardedContext.toHat;
      return workspace.save(st);
    },
    clearForwardedContext: function () {
      var st = workspace.get();
      st.forwardedContext = null;
      return workspace.save(st);
    }
  };

  function currentFile() {
    var p = window.location.pathname;
    var base = p.slice(p.lastIndexOf('/') + 1) || 'index.html';
    return base;
  }

  function ensureLiveRegion() {
    var region = document.querySelector('[data-shell-live]');
    if (!region && document.body) {
      region = document.createElement('div');
      region.className = 'sr-only';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('data-shell-live', '');
      document.body.appendChild(region);
    }
    return region;
  }

  function announce(message) {
    var region = ensureLiveRegion();
    if (region) region.textContent = String(message || '');
  }

  function renderNav() {
    var hosts = document.querySelectorAll('[data-shell-nav]');
    if (!hosts.length) return;
    var cur = currentFile();
    if (cur === 'index.html' || cur === '') cur = 'overview.html';
    hosts.forEach(function (host) {
      var html = '';
      PAGES.forEach(function (entry) {
        if (entry.group) {
          html += '<div class="shell__group">' + escHtml(entry.group) + '</div>';
          return;
        }
        var active = entry.file === cur ? ' shell__link--active' : '';
        var aria = entry.file === cur ? ' aria-current="page"' : '';
        html += '<a class="shell__link' + active + '" href="' + entry.file + '"' + aria + '>'
          + '<span class="shell__link-icon" aria-hidden="true">' + escHtml(entry.icon) + '</span>'
          + '<span>' + escHtml(entry.label) + '</span></a>';
      });
      html += '<div class="shell__group">Quick Actions</div>'
        + '<button type="button" class="shell__link" data-cmd-palette-open aria-label="Open Command Palette (Ctrl+K)">'
        + '<span class="shell__link-icon" aria-hidden="true">K</span>'
        + '<span>Command Palette</span></button>';
      host.innerHTML = html;
    });
    var toggles = document.querySelectorAll('[data-nav-toggle]');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var bar = btn.closest('.shell__sidebar');
        if (!bar) return;
        var open = bar.classList.toggle('shell__sidebar--open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    document.querySelectorAll('[data-cmd-palette-open]').forEach(function (btn) {
      btn.addEventListener('click', openCommandPalette);
    });
    renderMobileBottomNav(cur);
  }

  function renderMobileBottomNav(cur) {
    if (!document.body || document.querySelector('[data-mobile-bottom-nav]')) return;
    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile quick navigation');
    nav.setAttribute('data-mobile-bottom-nav', '');
    var items = [
      { file: 'overview.html', label: 'Overview', icon: 'O' },
      { file: 'hats.html', label: 'Four Hats', icon: '4' },
      { file: 'operators.html', label: 'Operatives', icon: 'P' },
      { file: 'defend.html', label: 'Defend', icon: 'D' }
    ];
    var html = items.map(function (it) {
      var active = it.file === cur ? ' mobile-bottom-nav__item--active' : '';
      var aria = it.file === cur ? ' aria-current="page"' : '';
      return '<a class="mobile-bottom-nav__item' + active + '" href="' + it.file + '"' + aria + '>'
        + '<span aria-hidden="true">' + escHtml(it.icon) + '</span>'
        + '<span>' + escHtml(it.label) + '</span></a>';
    }).join('');
    html += '<button type="button" class="mobile-bottom-nav__item" data-mobile-palette>'
      + '<span aria-hidden="true">K</span><span>Palette</span></button>';
    nav.innerHTML = html;
    document.body.appendChild(nav);
    var pBtn = nav.querySelector('[data-mobile-palette]');
    if (pBtn) pBtn.addEventListener('click', openCommandPalette);
  }

  function allPaletteEntries() {
    var list = [];
    PAGES.forEach(function (p) {
      if (!p.group) {
        list.push({
          id: 'page-' + p.id,
          label: 'Page: ' + p.label,
          href: p.file,
          badge: 'shared'
        });
      }
    });
    return list.concat(HAT_PALETTE_ITEMS);
  }

  var palettePreviousFocus = null;

  function closeCommandPalette() {
    var el = document.querySelector('[data-cmd-palette-backdrop]');
    if (el) el.remove();
    if (palettePreviousFocus && typeof palettePreviousFocus.focus === 'function') {
      try { palettePreviousFocus.focus(); } catch (e) { /* ignore */ }
    }
    palettePreviousFocus = null;
  }

  function openCommandPalette() {
    if (!document.body) return;
    var prevFocus = document.activeElement;
    closeCommandPalette();
    palettePreviousFocus = prevFocus;
    var backdrop = document.createElement('div');
    backdrop.className = 'cmd-palette-backdrop';
    backdrop.setAttribute('data-cmd-palette-backdrop', '');
    backdrop.innerHTML = '<div class="cmd-palette" role="dialog" aria-modal="true" aria-label="Command Palette">'
      + '<div class="card__row"><strong class="card__title">Command Palette</strong>'
      + '<span class="badge badge--neutral mono">Esc to close · Alt+1..4 Switch Hat</span></div>'
      + '<label class="sr-only" for="cmdPaletteInput">Search pages, Hats, tools, and skills</label>'
      + '<input id="cmdPaletteInput" class="form-input" type="search" placeholder="Jump to Hat, tool, skill, or page..." autocomplete="off">'
      + '<ul class="cmd-palette__list" role="listbox" id="cmdPaletteList"></ul>'
      + '</div>';
    document.body.appendChild(backdrop);

    var input = backdrop.querySelector('#cmdPaletteInput');
    var listEl = backdrop.querySelector('#cmdPaletteList');
    var entries = allPaletteEntries();
    var activeIdx = 0;
    var filtered = entries.slice();

    function renderItems() {
      var q = (input && input.value ? input.value : '').trim().toLowerCase();
      filtered = entries.filter(function (item) {
        return !q || item.label.toLowerCase().indexOf(q) !== -1 || item.id.toLowerCase().indexOf(q) !== -1;
      });
      if (activeIdx >= filtered.length) activeIdx = 0;
      if (!listEl) return;
      if (!filtered.length) {
        listEl.innerHTML = '<li class="text-secondary">No matching Hat, tool, skill, or page.</li>';
        return;
      }
      listEl.innerHTML = filtered.map(function (item, idx) {
        var sel = idx === activeIdx ? 'true' : 'false';
        return '<li role="option" aria-selected="' + sel + '">'
          + '<button type="button" class="cmd-palette__item" aria-selected="' + sel + '" data-palette-idx="' + idx + '">'
          + '<span>' + escHtml(item.label) + '</span>'
          + '<span class="hat-badge hat-badge--' + escHtml(item.badge) + '">' + escHtml(item.badge) + '</span>'
          + '</button></li>';
      }).join('');
      listEl.querySelectorAll('[data-palette-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = Number(btn.getAttribute('data-palette-idx') || 0);
          var chosen = filtered[i];
          if (chosen) {
            closeCommandPalette();
            window.location.href = chosen.href;
          }
        });
      });
    }

    if (input) {
      input.addEventListener('input', function () {
        activeIdx = 0;
        renderItems();
      });
      input.focus();
    }
    backdrop.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeCommandPalette();
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (filtered.length) activeIdx = (activeIdx + 1) % filtered.length;
        renderItems();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (filtered.length) activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
        renderItems();
      } else if (ev.key === 'Enter' && ev.target === input) {
        ev.preventDefault();
        var chosen = filtered[activeIdx];
        if (chosen) {
          closeCommandPalette();
          window.location.href = chosen.href;
        }
      } else if (ev.key === 'Tab') {
        var focusable = Array.prototype.slice.call(backdrop.querySelectorAll('#cmdPaletteInput, button.cmd-palette__item'));
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    });
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) closeCommandPalette();
    });
    renderItems();
  }

  function setupGlobalShortcuts() {
    window.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        openCommandPalette();
        return;
      }
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        var hatMap = { '1': 'red', '2': 'blue', '3': 'black', '4': 'white' };
        var targetHat = hatMap[ev.key];
        if (targetHat) {
          ev.preventDefault();
          workspace.setActiveHat(targetHat);
          announce('Switched active Hat to ' + targetHat.toUpperCase());
          if (typeof window.__onShellHatSwitch === 'function') {
            window.__onShellHatSwitch(targetHat);
          } else {
            window.location.href = 'hats.html?hat=' + targetHat;
          }
        }
      }
    });
  }

  async function copyText(text) {
    var str = String(text == null ? '' : text);
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(str);
        toast('Copied to clipboard', 'success');
        return true;
      }
    } catch (e) { /* fallback below */ }
    try {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.className = 'sr-only';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Copied to clipboard', 'success');
      return true;
    } catch (err) {
      toast('Clipboard unavailable in this WebView; use Export JSON instead.', 'warning');
      return false;
    }
  }

  function exportArtifact(filename, data) {
    try {
      var content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || ('purpleteam-artifact-' + Date.now() + '.json');
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('Exported ' + a.download, 'success');
      return true;
    } catch (e) {
      toast('Export fallback: copied artifact to clipboard.', 'warning');
      copyText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      return false;
    }
  }

  async function shareArtifact(title, text) {
    try {
      if (navigator && typeof navigator.share === 'function') {
        await navigator.share({ title: title || 'Purple Team Artifact', text: String(text || '') });
        return true;
      }
    } catch (e) { /* fallback to copy */ }
    return copyText(text);
  }

  function navigateTo(page) {
    var file = LEGACY_MAP[page] || 'overview.html';
    window.location.href = file;
  }

  // Non-loopback binds require a bearer on /api. Loopback ignores it.
  // Set localStorage t3mp3st_bearer_token in the operator browser; nothing
  // is prompted and nothing is sent when the key is absent.
  (function patchApiFetch() {
    if (window.__t3mp3stFetchPatched || typeof window.fetch !== 'function') return;
    var orig = window.fetch;
    window.__t3mp3stFetchPatched = true;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var token = '';
      try { token = window.localStorage.getItem('t3mp3st_bearer_token') || ''; } catch (e) { /* storage unavailable */ }
      if (token && String(url).indexOf('/api/') !== -1) {
        init = init ? Object.assign({}, init) : {};
        var headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
        init.headers = headers;
      }
      return orig.call(this, input, init);
    };
  })();

  function apiBase() {
    try {
      var custom = window.localStorage.getItem('t3mp3st_api_url');
      if (custom) return custom.replace(/\/$/, '');
    } catch (e) { /* storage unavailable */ }
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://' + host + ':3333';
    // Windows Tauri serves the bundled UI from http://tauri.localhost, which is
    // not the API. The shell's sidecar listens on the loopback port.
    if (host === 'tauri.localhost') return 'http://127.0.0.1:3333';
    return '';
  }

  async function apiGet(path) {
    var r = await fetch(apiBase() + path);
    var d = await r.json();
    if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
    return d;
  }

  async function apiSend(method, path, body) {
    var r = await fetch(apiBase() + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    var d = await r.json();
    if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
    return d;
  }

  function apiPost(path, body) { return apiSend('POST', path, body); }
  function apiPut(path, body) { return apiSend('PUT', path, body); }

  function toast(message, kind) {
    var host = document.querySelector('[data-toast]');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast__item' + (kind ? ' toast__item--' + kind : '');
    item.textContent = message;
    host.appendChild(item);
    window.setTimeout(function () { item.remove(); }, 6000);
  }

  function escHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
    });
  }

  /* Query-param state: filters/selection persist in the URL so back/forward
   * restores them. Pages read Shell.params.get on load, write via set. */
  var params = {
    get: function () { return new URLSearchParams(window.location.search); },
    set: function (obj) {
      var q = new URLSearchParams(window.location.search);
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if (v == null || v === '') q.delete(k);
        else q.set(k, v);
      });
      var url = window.location.pathname + (q.toString() ? '?' + q.toString() : '');
      window.history.replaceState(null, '', url);
    },
    onRestore: function (cb) { window.addEventListener('popstate', cb); }
  };

  function showState(root, name) {
    if (!root) return;
    ['loading', 'empty', 'error', 'success', 'data'].forEach(function (key) {
      var el = root.querySelector('[data-state="' + key + '"]');
      if (el) el.hidden = key !== name;
    });
  }

  function setApiServerHint() {
    var els = document.querySelectorAll('[data-api-base]');
    els.forEach(function (el) { el.textContent = apiBase() || '(same origin)'; });
  }

  window.Shell = {
    PAGES: PAGES,
    HAT_PALETTE_ITEMS: HAT_PALETTE_ITEMS,
    workspace: workspace,
    announce: announce,
    openCommandPalette: openCommandPalette,
    closeCommandPalette: closeCommandPalette,
    copyText: copyText,
    exportArtifact: exportArtifact,
    shareArtifact: shareArtifact,
    navigateTo: navigateTo,
    apiBase: apiBase,
    apiGet: apiGet,
    apiPost: apiPost,
    apiPut: apiPut,
    toast: toast,
    escHtml: escHtml,
    params: params,
    showState: showState
  };
  // Shell helpers are attached for inline page scripts; Window has no typed slots for them.
  const shellWindow = /** @type {Window & { navigateTo: typeof navigateTo, toast: typeof toast }} */ (window);
  shellWindow.navigateTo = navigateTo;
  shellWindow.toast = toast;

  setupGlobalShortcuts();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      renderNav();
      setApiServerHint();
      ensureLiveRegion();
    });
  } else {
    renderNav();
    setApiServerHint();
    ensureLiveRegion();
  }
})();
