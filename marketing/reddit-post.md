# Reddit Post Draft

Title options:

1. I built Codex for Obsidian: OpenAI Codex inside your local vault
2. Codex for Obsidian: a local Codex CLI powered plugin for Obsidian
3. I vibe-coded a Codex-first fork/adaptation of Claudian for Obsidian

Post:

Hey everyone,

I built **Codex for Obsidian**, a desktop Obsidian plugin that brings the local OpenAI Codex CLI experience into an Obsidian sidebar.

The idea is simple: if your thinking, writing, research, or code notes already live in Obsidian, you should not have to constantly switch between your vault, terminal, and AI chat. Codex should be able to sit next to your notes, use local context, and help you work directly inside the vault.

What it supports:

- Codex/GPT chat inside Obsidian
- GPT-5.5 model selection in the chat toolbar
- Three execution modes: Ask first, Auto run, Plan only
- Note context, image/file attachments, and inline editing
- Local Codex skills, MCP servers, subagents, and sessions
- Multilingual UI
- Manual Obsidian plugin installation via `manifest.json`, `main.js`, and `styles.css`

This project was vibe-coded from Claudian and adapted into a Codex-first plugin. Claudian explored the Claude Code + Obsidian workflow; I wanted a similar local-first experience for OpenAI Codex users.

Requirements:

- Obsidian desktop
- Codex CLI installed locally
- Community plugins enabled

Install Codex CLI:

```bash
npm install -g @openai/codex
```

or:

```bash
brew install --cask codex
```

GitHub:

https://github.com/lufie/codex-for-obsidian

I would love feedback from people who use Obsidian as a serious knowledge base, especially around local context, safer execution modes, and how Codex should interact with notes.

