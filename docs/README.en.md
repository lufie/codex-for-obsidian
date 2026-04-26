# Codex for Obsidian

[中文说明](README.zh-CN.md) | English

Codex for Obsidian embeds OpenAI Codex in an Obsidian sidebar so you can chat with GPT/Codex, work with vault context, edit notes, and use local Codex capabilities without leaving your knowledge base.

## Features

- Codex/GPT chat inside Obsidian.
- Model picker in the chat toolbar, including GPT-5.5 support.
- Three clear execution modes: Ask first, Auto run, and Plan only.
- Vault-aware context, note editing, image/file attachments, and inline edit.
- Uses local Codex configuration for skills, subagents, MCP, and sessions instead of duplicating them in plugin settings.
- Multilingual UI with English, Chinese, Japanese, Korean, German, French, Spanish, Russian, and Portuguese translations.

## Requirements

1. Obsidian desktop app.
2. Community plugins enabled in Obsidian.
3. Codex CLI installed and working on your computer.
4. An OpenAI/Codex account or API setup that can run Codex locally.

## Install Codex CLI

The official Codex CLI can be installed with npm or Homebrew:

```bash
npm install -g @openai/codex
```

or:

```bash
brew install --cask codex
```

Then verify:

```bash
codex --version
codex
```

If Obsidian cannot find `codex` automatically, open the plugin settings and set the Codex CLI path manually. On macOS with Homebrew, it is often:

```text
/opt/homebrew/bin/codex
```

## Installation

1. Download the latest release assets from GitHub.
2. Create this folder in your Obsidian vault:

```text
<your-vault>/.obsidian/plugins/codex-for-obsidian/
```

3. Copy these three files into that folder:

```text
manifest.json
main.js
styles.css
```

4. Restart Obsidian.
5. Open `Settings -> Community plugins` and enable `Codex for Obsidian`.
6. Open the Codex sidebar from the ribbon icon or command palette.

## Usage

- Pick a model from the chat toolbar.
- Choose an execution mode:
  - Ask first: asks before sensitive commands or file changes.
  - Auto run: lets Codex work with fewer confirmations.
  - Plan only: asks Codex to plan before changing files.
- Attach notes, images, or external folders when you want Codex to use more context.
- Use your local Codex skills, MCP servers, and subagents the same way you use them with Codex CLI.

## Build From Source

```bash
npm install
npm run typecheck
npm run build
```

The Obsidian runtime files are generated at the repository root:

```text
manifest.json
main.js
styles.css
```

## Notes

- This plugin is desktop-only because it depends on local Codex CLI execution.
- It does not upload your vault by itself. Codex behavior follows your local Codex configuration and the execution mode you choose.
- Advanced environment variables can be set in plugin settings when you need a custom OpenAI base URL, proxy, certificate, or runtime override.

## Credits

This project is a Codex-first adaptation produced by vibe coding from [Claudian](https://github.com/lufie/claudian), with the goal of bringing the same Obsidian-native AI workflow to OpenAI Codex users.

## License

MIT.
