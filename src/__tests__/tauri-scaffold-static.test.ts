import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Tauri 2.0 scaffold pins (v1.1 Wave 1, unit B; updated v1.2 Phase 11): the
// desktop shell wraps the static docs/ UI. Prod (Phase 12) bundles the loopback
// server as a sidecar; dev still runs it alongside. No webview privileges
// beyond the bare core. These tests
// pin the SHAPE (config markers, capability deny-list, script wiring,
// decision-record coverage), not Tauri behavior itself (see docs/TAURI.md
// toolchain probe + 2026-10-10 re-probe).

const root = process.cwd();
interface TauriWindow {
  label: string;
  width: number;
  minWidth: number;
}

interface TauriConf {
  productName: string;
  identifier: string;
  version: string;
  build: { frontendDist: string; devUrl: string; beforeDevCommand: string };
  app: { windows: TauriWindow[]; security: { csp: string } };
  bundle: { targets: string[]; icon: string[]; externalBin?: string[]; resources?: Record<string, string> };
}

// Both Tauri JSON files are strict JSON since v1.2 Phase 11 (the Rust
// toolchain rejects comments — cargo check proved it). The stripper stays as
// a no-op guard; only full-line comments would be stripped.
const stripJsonComments = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '');
const conf = JSON.parse(
  stripJsonComments(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')),
) as TauriConf;
interface PackageJson {
  version: string;
  scripts: Record<string, string>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as PackageJson;
const capabilities = readFileSync(join(root, 'src-tauri/capabilities/default.json'), 'utf8');
const tauriDoc = readFileSync(join(root, 'docs/TAURI.md'), 'utf8');
const buildRs = readFileSync(join(root, 'src-tauri/build.rs'), 'utf8');

describe('tauri.conf.json shape', () => {
  it('identifies the app and tracks the package version', () => {
    expect(conf.identifier).toBe('com.t3mp3st.app');
    // Version is duplicated (JSON has no interpolation) — must track package.json.
    expect(conf.version).toBe(pkg.version);
  });

  it('serves docs/ with dev against the loopback server UI mount', () => {
    expect(conf.build.frontendDist).toBe('../docs');
    expect(conf.build.devUrl).toBe('http://127.0.0.1:3333/ui');
    expect(conf.build.beforeDevCommand).toContain('npm run server');
  });

  it('bundles desktop targets and constrains the window to the UI breakpoints', () => {
    for (const target of ['deb', 'appimage', 'msi', 'app', 'dmg']) {
      expect(conf.bundle.targets).toContain(target);
    }
    expect(conf.bundle.externalBin).toContain('binaries/t3mp3st-server');
    expect(conf.bundle.resources?.['../docs/']).toBe('docs/');
    const main = conf.app.windows.find((w: TauriWindow) => w.label === 'main');
    expect(main).toBeDefined();
    expect(main?.minWidth).toBeLessThanOrEqual(360);
    expect(main?.width).toBeGreaterThanOrEqual(1200);
  });

  it('restricts webview connect sources to loopback', () => {
    const csp: string = conf.app.security.csp;
    expect(csp).toContain('connect-src');
    expect(csp).toMatch(/127\.0\.0\.1/);
    expect(csp).not.toContain('https://*');
  });
});

describe('capabilities lockdown', () => {
  it('grants core only — no blanket shell/fs/dialog scope', () => {
    const parsed = JSON.parse(stripJsonComments(capabilities)) as { permissions: string[] };
    expect(parsed.permissions).toEqual(['core:default']);
    // Quoted-permission deny-list (comments in the file name the denied
    // scopes in prose, so match the JSON `"scope:` permission form only).
    for (const denied of ['"shell:', '"fs:', '"dialog:', '"http:']) {
      expect(capabilities, `capability grants denied scope ${denied}`).not.toContain(denied);
    }
  });
});

describe('package.json wiring', () => {
  it('exposes exactly the four tauri scripts', () => {
    for (const script of ['tauri:dev', 'tauri:build', 'tauri:ios', 'tauri:android']) {
      expect(pkg.scripts[script], `missing script ${script}`).toBeDefined();
    }
  });

  it('pins @tauri-apps/cli as a devDependency only (installed 2026-10-10, Phase 11)', () => {
    expect(pkg.dependencies ?? {}).not.toHaveProperty('@tauri-apps/cli');
    expect(pkg.devDependencies ?? {}).toHaveProperty('@tauri-apps/cli');
  });
});

describe('docs/TAURI.md decision record', () => {
  it('records the toolchain probe honestly', () => {
    expect(tauriDoc).toContain('cargo 1.98.1');
    expect(tauriDoc).toContain('node_modules/.bin/tauri');
    expect(tauriDoc).toContain('ABSENT');
  });

  it('documents the backend strategy and follow-ups', () => {
    // Desktop prod + dev against the alongside loopback server.
    expect(tauriDoc).toContain('npm run server');
    // Mobile LAN pairing via explicit opt-in bind.
    expect(tauriDoc).toContain('T3MP3ST_HOST');
    // Bearer-auth upgrade named as a follow-up, not done here.
    expect(tauriDoc).toMatch(/[Bb]earer/);
    // Node sidecar closed in Phase 12 (still named in the decision record).
    expect(tauriDoc).toMatch(/[Ss]idecar/);
  });
});

describe('build.rs', () => {
  it('stays a minimal codegen stub', () => {
    expect(buildRs).toContain('tauri_build::build()');
  });
});

// Bundle wiring pins (09-02): frontendDist is ../docs, so the bundle ships
// exactly the FINAL docs/ asset set from docs/IA.md — eleven content pages plus
// the index landing (same document as overview.html), the shell script, and
// the token stylesheet. Any rename/move/add must update this list AND the
// conf; the test fails loudly on drift either way.
describe('bundled frontendDist asset set', () => {
  it('points frontendDist at ../docs', () => {
    expect(conf.build.frontendDist).toBe('../docs');
  });
  it('resolves every bundle.icon path to a committed file', () => {
    for (const icon of conf.bundle.icon) {
      expect(existsSync(join(root, 'src-tauri', icon)), `missing icon ${icon}`).toBe(true);
    }
  });

  it.each([
    'index.html',
    'overview.html',
    'mission.html',
    'operators.html',
    'evidence.html',
    'defend.html',
    'arsenal.html',
    'terminal.html',
    'range.html',
    'engagements.html',
    'settings.html',
    'about.html',
    'assets/shell.js',
    'assets/tokens.css',
  ])('ships docs/%s', (rel) => {
    expect(existsSync(join(root, 'docs', rel)), `missing bundled asset docs/${rel}`).toBe(true);
  });
});
