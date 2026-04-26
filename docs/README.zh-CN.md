# Codex for Obsidian

中文说明 | [English README](README.en.md)

Codex for Obsidian 是一个 Obsidian 桌面端插件，把 OpenAI Codex 放进 Obsidian 侧边栏，让你可以在知识库里直接和 GPT/Codex 对话、读取上下文、编辑笔记，并复用本地 Codex 的能力。

## 功能亮点

- 在 Obsidian 里直接使用 Codex/GPT 对话。
- 对话框底部可选择模型，已支持 GPT-5.5。
- 三种清晰的执行模式：确认模式、全自动、计划模式。
- 支持知识库上下文、笔记编辑、图片/文件附件、内联编辑。
- 复用本地 Codex 的 skills、subagents、MCP 和 sessions，不在插件里重复维护一套配置。
- 多语言界面：英文、简中、繁中、日文、韩文、德文、法文、西班牙文、俄文、葡萄牙文。

## 依赖条件

1. Obsidian 桌面端。
2. Obsidian 已开启第三方插件。
3. 本机已安装并可运行 Codex CLI。
4. 你已有可运行 Codex 的 OpenAI/Codex 账号或 API 配置。

## 安装 Codex CLI

官方 Codex CLI 可以通过 npm 或 Homebrew 安装：

```bash
npm install -g @openai/codex
```

或者：

```bash
brew install --cask codex
```

安装后验证：

```bash
codex --version
codex
```

如果 Obsidian 无法自动找到 `codex`，可以在插件设置里手动填写 Codex CLI 路径。macOS Homebrew 常见路径是：

```text
/opt/homebrew/bin/codex
```

## 安装

1. 在 GitHub Release 里下载最新版文件。
2. 在你的 Obsidian vault 里创建目录：

```text
<your-vault>/.obsidian/plugins/codex-for-obsidian/
```

3. 把下面三个文件复制进去：

```text
manifest.json
main.js
styles.css
```

4. 重启 Obsidian。
5. 进入 `设置 -> 第三方插件`，启用 `Codex for Obsidian`。
6. 点击侧边栏图标，或从命令面板打开 Codex 面板。

## 使用方式

- 在对话框底部选择模型。
- 选择执行模式：
  - 确认模式：执行敏感命令或修改文件前先询问你。
  - 全自动：让 Codex 尽量自动执行。
  - 计划模式：先制定计划，不直接修改文件。
- 需要更多上下文时，可以附加笔记、图片、文件或外部文件夹。
- 本地 Codex 已配置的 skills、MCP、subagents 会按 Codex 原生方式使用。

## 从源码构建

```bash
npm install
npm run typecheck
npm run build
```

构建完成后，Obsidian 需要加载的文件会生成在仓库根目录：

```text
manifest.json
main.js
styles.css
```

## 注意事项

- 这个插件仅支持桌面端，因为它依赖本机 Codex CLI。
- 插件本身不会主动上传你的整个知识库。Codex 的行为取决于你的本地 Codex 配置和你选择的执行模式。
- 如果需要自定义 OpenAI Base URL、代理、证书或运行环境变量，可以在插件高级设置里配置。

## 致谢

这个项目是基于 [Claudian](https://github.com/lufie/claudian) vibe coding 出来的 Codex-first 改造版本，目标是把类似的 Obsidian 原生 AI 工作流带给 OpenAI Codex 用户。

## 许可证

MIT。
