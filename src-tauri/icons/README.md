# T3MP3ST Tauri icons

Source of truth: `t3mp3st.svg` in this directory (512x512, shield + bolt mark).

Raster/ICNS/ICO binaries ARE committed (generated 2026-10-10 with
`@tauri-apps/cli` 2.12.1 — `npm i -D @tauri-apps/cli@2` is now a
devDependency):

```sh
npx tauri icon src-tauri/icons/t3mp3st.svg
```

The full generated set is committed: the four `bundle.icon` paths
`tauri.conf.json` references (`128x128.png`, `128x128@2x.png`, `icon.icns`,
`icon.ico`) plus the extra sizes the CLI emits (`32x32.png`, `64x64.png`,
`icon.png`, Windows Store `Square*Logo`/`StoreLogo`, and the `android/` +
`ios/` mipmap/asset sets the mobile targets consume). Regenerate after
editing the SVG and commit the result — nothing here is hand-made.
