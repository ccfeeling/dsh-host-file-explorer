<div align="center">

[English](README.md) · **简体中文** · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH 宿主机文件资源管理器

### 一个 DeepSeek Harness plugin，在左侧边栏添加一个条目，用于浏览 Harness 所在机器的文件系统。

[![MIT 许可证](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](#功能特性)
[![侧边栏条目](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#功能特性)
[![传输方式](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#架构)

</div>

---

在 Harness 内浏览宿主机器的文件系统：查看带类型、大小和修改时间的目录列表、预览文本文件，以及新建文件夹。每次读取都经过 Host/Client Remote 通道，与 agent 自带的文件系统工具使用的是同一条边界。文件可以直接下载到浏览器，图片则能内联预览。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 文件下载 | 通过 Harness 自带的鉴权文件路由把文件交给浏览器，并保留文件原名 |
| 图片预览 | 内联显示 PNG、JPEG、GIF、WebP、AVIF、SVG 等图片，不再当作文本读取 |
| 目录列表 | 先列目录，后列文件，各自带大小和修改时间；隐藏条目以暗色显示 |
| 路径导航 | 跳转到绝对路径、返回上级目录，或使用 HOME、tmp、cwd 与文件系统根目录的快捷入口 |
| 文件预览 | 读取文本文件的前 256 KiB 并渲染出来；二进制文件会自行说明情况，而不是打印无意义的内容 |
| 新建文件夹 | 在当前目录下创建一个单层子目录 |
| 双语界面 | 所有可见文本都经过 `ctx.locale` 处理，因此面板会跟随界面语言 |

## 安装

### 使用 plugin 管理器（推荐）

克隆本仓库，然后从 Harness 的 plugin 管理器中安装：

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

对应的工具调用是 `plugin_manager { action: 'install_bundle', target: '<local path>' }`。

### 从插件市场安装

本插件已收录于 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 列表，市场可以直接从 GitHub 安装：

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### 作为 profile 依赖

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

安装完成后，侧边栏中会在 Plugins 和 Schedules 之后出现一个**文件夹图标**。点击它即可打开面板。

> **注意**：如果你的 profile 中有附带 agent skills 的依赖（例如 `dsh-answer-me-with-html`），pnpm 10.11+ 和 12.x 在声明 skills 目录之前会拒绝安装，并以 `ERR_PNPM_NO_AGENT_SKILLS_DIR` 失败。可以在 profile 的 `pnpm-workspace.yaml` 中加上一段配置，关掉 pnpm 自带的 skill 链接：
>
> ```yaml
> skills:
>   dirs: []
> ```

## 架构

本 plugin 是一个标准的 DSH bundle，由 Host 端和 Client 端两部分组成：

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Host 端**提供一个 `ctx.hostFiles` 服务，并用原型标记 `@deepseek-ai/dsh-typert-protocol/remote-methods` 标记它的各个动词以适配 Remote 传输，从而让网关能在 SRC 模式下发现它：

| 方法 | 参数 | 返回值 |
| --- | --- | --- |
| `roots()` | — | 常用位置（HOME、tmp、cwd、文件系统根目录） |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`、`name` | `{ path }` |
| `limits()` | — | 单次下载可携带的最大文件大小 |

`signal` 必须是最后一个参数：网关使用 `Function.prototype.toString()` 解析方法签名以推导出线上参数，一旦签名出错，调用就会失败。

### 文件如何到达浏览器

页面不会把文件字节塞进 Remote 通道。它向 Host 询问该文件在 Harness 自带的鉴权文件路由上的地址——官方文档预览渲染 Markdown 内嵌图片时用的正是这条路由——浏览器再用页面已有的会话去取。于是下载保留文件原名，预览拿到文件自己的内容类型，PNG 就是按 PNG 渲染的。

单次响应受 Harness 附件字节上限约束（默认 20 MiB）。页面会从 Host 读到这个数字，遇到超限文件直接说明原因，而不是发起注定失败的传输。

**Client 端**手写了一份 Typert Remote 贡献，用 `ctx.remote.$mount(...)` 将其挂载，然后注册两个插槽：

- `sidebar.panellist`：id 为 `host-files`，order 为 `30`，并带有自己的文件夹图标；
- `main`：key 为 `host-files`，即侧边栏按钮所打开的面板。

### 两个值得注意的坑

1. **命名空间不能声明为 plugin 自身的 inject。** 被挂载的 `remote.hostFiles` 本身就是一项服务，而且只有在本 plugin 的 mount 执行之后才会出现——等待它的 fiber 永远不会唤醒，于是 plugin 永远不会启动。请改用 `ctx.get('remote.hostFiles')` 读取它，这是 Cordis mixin 的入口点，可以直接从共享存储中读取服务：

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   随附发布的 plugin 之所以能写 `inject: ['remote.agentPresets']`，是因为另一个 package 挂载了这些命名空间，从而让使用方可以自由声明该依赖。

2. **Client 端不依赖任何 Harness client package。** 本 plugin 只使用 `react` 和 `zod`，用 `--dsw-alias-*` 主题 token 为自身设置样式，并且不从 `@deepseek-ai/dsh-client-ui-primitives` 或其同级 package 导入任何内容。

## 权限与边界

- 本 plugin 读取宿主文件系统时使用的是 **Harness 进程自身的权限**：它能读到运行它的账号所能读取的一切。这是 host 文件浏览器固有的特性，因此请只在你信任的机器和账号上启用它。
- 本 plugin **只读，另外支持新建文件夹**。它无法写入文件、删除、重命名或更改权限。
- 单次列表最多返回 2000 个条目，单次预览最多读取 256 KiB。
- 单次下载最多携带 Harness 附件字节上限（默认 20 MiB）的内容；超限时面板会先说明原因。

## 开发

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

本地开发期间，profile 通过 `link:` 指向工作目录，因此改动后刷新浏览器即可生效（client 模块按内容哈希进行版本管理）。

## 许可证

MIT，参见 [LICENSE](LICENSE)。
