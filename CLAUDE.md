# Codex for Obsidian

## Overview

Codex for Obsidian is an Obsidian community plugin adapted from Claudian into a Codex-first experience. The runtime uses the local Codex CLI app-server path and keeps Obsidian-facing settings focused on the plugin surface instead of duplicating Codex-native configuration.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

## Release Files

Obsidian users need these files from the repository root or GitHub Release assets:

- `manifest.json`
- `main.js`
- `styles.css`

## Notes

- The plugin is desktop-only because it depends on local Codex CLI execution.
- Codex-native skills, MCP servers, subagents, and sessions are expected to follow the user’s local Codex configuration.
- Keep README content bilingual through `docs/README.en.md` and `docs/README.zh-CN.md`.

