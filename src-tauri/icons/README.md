# T3MP3ST Tauri icons

Source of truth: `t3mp3st.svg` in this directory (512x512, shield + bolt mark).

Raster/ICNS/ICO binaries (`128x128.png`, `128x128@2x.png`, `icon.icns`,
`icon.ico` — referenced by `tauri.conf.json` `bundle.icon`) are NOT committed:
they are generated with the Tauri CLI on a machine that has it installed:

```sh
npx @tauri-apps/cli icon src-tauri/icons/t3mp3st.svg
```

The CLI was absent when this scaffold was written (see `docs/TAURI.md`
toolchain probe), so generation is deferred — no binaries are faked here.
