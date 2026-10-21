#!/usr/bin/env node
// T3MP3ST server sidecar builder (Phase 12).
//
// Compiles the `npm run build` (tsc) output `dist/server.js` into a
// self-contained Node-22 executable via @yao-pkg/pkg (maintained pkg fork).
// Each requested target is emitted under BOTH names that consume it:
//
//   src-tauri/binaries/t3mp3st-server-<pkg-triple>      e.g. t3mp3st-server-linux-x64
//   src-tauri/binaries/t3mp3st-server-<rust-triple>     e.g. t3mp3st-server-x86_64-unknown-linux-gnu
//
// The pkg name is the platform-arch @yao-pkg/pkg targets natively; the Rust
// name is what tauri-build/tauri-bundler resolve `bundle.externalBin` against
// (`externalBin: ["binaries/t3mp3st-server"]` + the cargo target triple — the
// build fails without it). Same bytes, two names; the whole directory is a
// gitignored build artifact.
//
// Usage: npm run sidecar:build [-- --triple <t> | --all]
//   --triple accepts either naming (linux-x64 or x86_64-unknown-linux-gnu).
//   --all builds linux-x64, win-x64, darwin-x64, darwin-arm64.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { exec } from '@yao-pkg/pkg';

const ENTRY = resolve('dist/server.js');
const OUT_DIR = resolve('src-tauri/binaries');
const OUT_NAME = 't3mp3st-server';
const NODE_TARGET = 'node22';
const DESKTOP_TRIPLES = ['linux-x64', 'win-x64', 'darwin-x64', 'darwin-arm64'];

// pkg platform-arch <-> Rust target triple (what tauri-build appends to
// externalBin entries; tauri-utils also adds `.exe` on Windows).
const PKG_TO_RUST = {
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'win-x64': 'x86_64-pc-windows-msvc',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
};
const RUST_TO_PKG = Object.fromEntries(
  Object.entries(PKG_TO_RUST).map(([pkg, rust]) => [rust, pkg]),
);
// pkg-fetch asset names use "macos", not "darwin" (expected-shas.json).
const PKG_TO_FETCH = {
  'linux-x64': 'linux-x64',
  'linux-arm64': 'linux-arm64',
  'win-x64': 'win-x64',
  'darwin-x64': 'macos-x64',
  'darwin-arm64': 'macos-arm64',
};

// pkg-fetch 3.6 dropped node20 base binaries (a missing one compiles Node+V8
// from source, ~30+ min, and it blows the CI job). node22 matches
// package.json engines and is still published. v3.5 is only a fallback tag.
const PKG_FETCH_FALLBACK_TAG = 'v3.5';

async function withPkgMain(pkgJsonPath, main, run) {
  if (!existsSync(pkgJsonPath)) return run();
  const original = readFileSync(pkgJsonPath, 'utf8');
  const json = JSON.parse(original);
  if (json.main) return run();
  json.main = main;
  writeFileSync(pkgJsonPath, `${JSON.stringify(json, null, 2)}\n`);
  try {
    return await run();
  } finally {
    writeFileSync(pkgJsonPath, original);
  }
}

function fail(message) {
  console.error(`[sidecar:build] ${message}`);
  process.exit(1);
}

function hostTriple() {
  switch (`${process.platform}-${process.arch}`) {
    case 'linux-x64':
      return 'linux-x64';
    case 'linux-arm64':
      return 'linux-arm64';
    case 'win32-x64':
      return 'win-x64';
    case 'darwin-x64':
      return 'darwin-x64';
    case 'darwin-arm64':
      return 'darwin-arm64';
    default:
      throw new Error(
        `unsupported host ${process.platform}-${process.arch}; pass --triple explicitly`,
      );
  }
}

function parseArgs(argv) {
  const triples = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') {
      triples.push(...DESKTOP_TRIPLES);
    } else if (arg === '--triple') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--triple requires a value, e.g. --triple win-x64');
      }
      triples.push(next);
      i += 1;
    } else {
      throw new Error(`unknown argument "${arg}" (expected --triple <t> or --all)`);
    }
  }
  return [...new Set(triples.length > 0 ? triples : [hostTriple()])];
}

// Accept either naming; map to the pkg target plus (when known) the Rust
// triple tauri's toolchain resolves externalBin against.
function resolveTriple(input) {
  const pkg = RUST_TO_PKG[input] ?? input;
  return { pkg, rust: PKG_TO_RUST[pkg] };
}

// ---------------------------------------------------------------------------
// Node base-binary pre-seeding.
//
// pkg-fetch's expected-shas.json pins the exact node20 base binary per
// platform. We resolve it from the installed @yao-pkg/pkg-fetch, fetch it
// (hash-verified) if missing, and point pkg at it via PKG_NODE_PATH. Without
// this, a missing base binary means a from-source Node build.
// ---------------------------------------------------------------------------

function pkgFetchInfo() {
  try {
    const require = createRequire(import.meta.url);
    const dir = dirname(require.resolve('@yao-pkg/pkg-fetch/package.json'));
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
    const shas = JSON.parse(readFileSync(join(dir, 'lib-es5', 'expected-shas.json'), 'utf8'));
    return { version, shas };
  } catch {
    return undefined;
  }
}

function latestNodeRuntimeName(shas, fetchTriple) {
  const major = NODE_TARGET.replace(/^node/, '');
  const versions = Object.keys(shas)
    .filter((name) => name === `node-v${major}.${fetchTriple}` || RegExp(`^node-v${major}\\.[0-9.]+-${fetchTriple}$`).test(name))
    .map((name) => name.slice('node-v'.length, name.length - `-${fetchTriple}`.length));
  if (versions.length === 0) return undefined;
  versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return `node-v${versions[versions.length - 1]}-${fetchTriple}`;
}

async function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function ensureNodeRuntime(pkgTriple) {
  const info = pkgFetchInfo();
  if (!info) {
    console.warn('[sidecar:build] cannot resolve @yao-pkg/pkg-fetch metadata; skipping base-binary pre-seed');
    return undefined;
  }
  const fetchTriple = PKG_TO_FETCH[pkgTriple] ?? pkgTriple;
  const name = latestNodeRuntimeName(info.shas, fetchTriple);
  if (!name) {
    console.warn(`[sidecar:build] no known ${NODE_TARGET} base binary for ${fetchTriple}; pkg may build Node from source`);
    return undefined;
  }
  const base = join(homedir(), '.pkg-cache', `t3mp3st-${name}`);
  if (existsSync(base)) return base;

  const expected = info.shas[name];
  const [major, minor] = info.version.split('.');
  const tags = [...new Set([`v${major}.${minor}`, PKG_FETCH_FALLBACK_TAG])];
  for (const tag of tags) {
    const url = `https://github.com/yao-pkg/pkg-fetch/releases/download/${tag}/${name}`;
    const tmp = `${base}.tmp`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(600_000) });
      if (!res.ok) continue;
      writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    } catch {
      continue;
    }
    if ((await sha256(tmp)) !== expected) {
      rmSync(tmp, { force: true });
      fail(`${name}: sha256 mismatch downloading from ${url} — refusing to use it`);
    }
    renameSync(tmp, base);
    if (!pkgTriple.startsWith('win')) chmodSync(base, 0o755);
    console.log(`[sidecar:build] ${pkgTriple}: seeded Node base binary ${base} (from ${tag})`);
    return base;
  }
  console.warn(
    `[sidecar:build] could not fetch ${name}; pkg will fall back to building Node from source (slow)`,
  );
  return undefined;
}

// ---------------------------------------------------------------------------

if (!existsSync(ENTRY)) {
  fail(
    `missing ${ENTRY} — run \`npm run build\` first. This script packages the ` +
      'existing tsc output (dist/server.js); it never compiles TypeScript itself.',
  );
}

mkdirSync(OUT_DIR, { recursive: true });

for (const input of parseArgs(process.argv.slice(2))) {
  const { pkg, rust } = resolveTriple(input);
  const isWindows = pkg.startsWith('win');
  const outPath = resolve(OUT_DIR, `${OUT_NAME}-${pkg}`);
  const target = `${NODE_TARGET}-${pkg}`;

  const runtime = await ensureNodeRuntime(pkg);
  if (runtime) {
    process.env.PKG_NODE_PATH = runtime;
  } else {
    delete process.env.PKG_NODE_PATH;
  }

  console.log(`[sidecar:build] ${pkg}: compiling ${ENTRY} for ${target}...`);
  try {
    // One pkg invocation per target with an explicit output path keeps the
    // produced filename exactly `t3mp3st-server-<triple>` (pkg would
    // otherwise derive it from the entry basename). pkg appends `.exe` to
    // Windows outputs whose path lacks the extension.
    // web-tree-sitter publishes `exports` and no `main`. pkg skips it, then
    // the binary dies at startup on `import 'web-tree-sitter'`. The patch is
    // restored in finally so node_modules is not left dirty.
    await withPkgMain(
      resolve('node_modules/web-tree-sitter/package.json'),
      './tree-sitter.cjs',
      () => exec([ENTRY, '--config', 'scripts/sidecar.pkg.json', '--target', target, '--output', outPath]),
    );
  } catch (err) {
    fail(`${pkg}: pkg failed: ${err?.message ?? err}`);
  }
  const produced = existsSync(outPath) ? outPath : `${outPath}.exe`;
  if (!existsSync(produced)) {
    fail(`${pkg}: expected pkg output ${produced} but it does not exist`);
  }
  console.log(`[sidecar:build] ${pkg}: produced ${produced}`);
  if (rust) {
    const tauriPath = resolve(OUT_DIR, `${OUT_NAME}-${rust}${isWindows ? '.exe' : ''}`);
    copyFileSync(produced, tauriPath);
    // Linux bundles map the sidecar by a triple-free path (src-tauri/tauri.linux.conf.json),
    // so each Linux build also writes the bare name; with several Linux arches in one run, the last wins.
    if (pkg.startsWith('linux-')) {
      copyFileSync(produced, resolve(OUT_DIR, OUT_NAME));
    }
    console.log(
      `[sidecar:build] ${pkg}: produced ${tauriPath} (Tauri externalBin name for this target)`,
    );
  } else {
    console.warn(
      `[sidecar:build] ${pkg}: no known Rust-triple mapping — tauri-build ` +
        'will not find an externalBin under this name',
    );
  }
}
