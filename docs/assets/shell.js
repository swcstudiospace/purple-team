/* T3MP3ST shared shell: persistent nav, deep links, api helpers, toasts,
 * query-param state. Loaded by every /ui page. No colors here — all paint
 * comes from tokens.css via class names. */
(function () {
  'use strict';

  var PAGES = [
    { group: 'Command' },
    { id: 'overview', file: 'overview.html', label: 'Overview', icon: 'O' },
    { id: 'mission', file: 'mission.html', label: 'Mission', icon: 'M' },
    { id: 'operators', file: 'operators.html', label: 'Operatives', icon: 'P' },
    { id: 'evidence', file: 'evidence.html', label: 'Evidence', icon: 'E' },
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

  /* Legacy single-page ids (bookmarks, keyboard shortcuts, in-app links) map
   * onto the compartmentalized pages. See docs/IA.md for the full mapping. */
  var LEGACY_MAP = {
    warroom: 'overview.html',
    'live-scan': 'mission.html',
    receipts: 'mission.html',
    operators: 'operators.html',
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

  function currentFile() {
    var p = window.location.pathname;
    var base = p.slice(p.lastIndexOf('/') + 1) || 'index.html';
    return base;
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
  }

  function navigateTo(page) {
    var file = LEGACY_MAP[page] || 'overview.html';
    window.location.href = file;
  }

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

  function apiGet(path) {
    return fetch(apiBase() + path).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
        return d;
      });
    });
  }

  function apiPost(path, body) {
    return fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
        return d;
      });
    });
  }

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
    navigateTo: navigateTo,
    apiBase: apiBase,
    apiGet: apiGet,
    apiPost: apiPost,
    toast: toast,
    escHtml: escHtml,
    params: params,
    showState: showState
  };
  window.navigateTo = navigateTo;
  window.toast = toast;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { renderNav(); setApiServerHint(); });
  } else {
    renderNav();
    setApiServerHint();
  }
})();
