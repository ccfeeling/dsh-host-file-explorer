# DSH 宿主机文件资源管理器

> Host File Explorer — a DeepSeek Harness plugin that adds a left-sidebar entry
> for browsing the filesystem of the machine the Harness runs on.

在 DSH 的左侧栏增加一个入口，打开后即可浏览**运行 Harness 的那台机器**的文件系统：目录列表（名称 / 类型 / 大小 / 修改时间）、文本文件预览、以及新建文件夹。所有读取都通过 DSH 的 Host/Client Remote 通道完成，与 Agent 自带的文件系统工具走同一条边界。

![面板构成](https://img.shields.io/badge/sidebar-entry-28-4CB1) ![Remote](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1)

---

## 功能

| 功能 | 说明 |
| --- | --- |
| 目录列表 | 按「目录在前、文件在后」排序，显示大小与修改时间；隐藏文件以次级色标注 |
| 路径导航 | 输入绝对路径跳转、上一级、主目录、以及若干常用位置快捷键（HOME / tmp / cwd / 根目录） |
| 文件预览 | 读取文本文件前 256 KiB 并渲染；二进制文件给出提示而非乱码 |
| 新建文件夹 | 在当前目录下创建一个单段名称的子目录 |
| 中英双语 | 全部可见文案走 `ctx.locale`，跟随界面语言 |

## 安装

### 用插件管理器安装（推荐）

把本仓库克隆到本地，然后在 Harness 的插件管理器里安装，或用 CLI：

```bash
# 克隆
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# 装进 DSH profile（把 profile 名与路径换成你的）
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

Harness 插件管理器对应的工具调用是 `plugin_manager { action: 'install_bundle', target: '<本地路径>' }`。

### 作为依赖加入 profile

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

安装后侧栏（插件、任务之后）会出现一个**文件夹图标**，点击即打开面板。

> **注意**：若你的 profile 里存在带 agent skills 的依赖（例如 `dsh-answer-me-with-html`），pnpm 10.11+ / 12.x 会在安装时要求声明 skills 目录，否则报 `ERR_PNPM_NO_AGENT_SKILLS_DIR`。在 profile 的 `pnpm-workspace.yaml` 里加一行即可关闭 pnpm 自带的链接：

> ```yaml
> skills:
>   dirs: []
> ```

## 架构

插件是一个标准 DSH bundle，宿主与浏览器两半分开：

```
index.js   (Host)    ctx.hostFiles  ——  node:fs/promises 之上的 5 个动词
client.js  (Client)  侧栏入口 + 主面板 + Remote 命名空间挂载
```

**Host 半**提供 `ctx.hostFiles` 服务，并在原型上写入 Remote 标记（`@deepseek-ai/dsh-typert-protocol/remote-methods`），因此 Gateway 能以 SRC 模式发现它：

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `roots()` | — | 常用位置（HOME、tmp、cwd、文件系统根） |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |

`signal` 必须是最后一个参数——Gateway 通过 `Function.prototype.toString()` 解析方法签名来推导线上参数，破坏签名就会让调用失败。

**Client 半**手写一份 Typert Remote contribution，通过 `ctx.remote.$mount(...)` 挂载，然后注册两个槽位：

- `sidebar.panellist`：id `host-files`，order `30`，自带文件夹图标；
- `main`：key `host-files`，即侧栏按钮打开的那块面板。

### 两个容易踩的坑

1. **namespace 不能声明成自己的 inject。** 挂载后得到的 `remote.hostFiles` 是一个独立 service；如果把它写进本插件的 `inject`，fiber 会永远等不到它（service 只有等 `apply` 跑完才存在），插件就不会启动。正确做法是用 `ctx.get('remote.hostFiles')`——Cordis mixin 提供的「绕过 inject 直接读共享 store」入口：

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   官方插件之所以能写 `inject: ['remote.agentPresets']`，是因为那些 namespace 由**另一个包**挂载，消费方可以正常声明依赖。

2. **客户端不依赖任何 Harness Client 包。** 本插件只用 `react` 与 `zod`，样式只用 `--dsw-alias-*` 主题 token，不 import `@deepseek-ai/dsh-client-ui-primitives` 之类。

## 权限与边界

- 插件以 **Harness 进程自身的权限**读取宿主机文件系统：能读到运行账号能读到的一切。这是「宿主机文件资源管理器」这一需求的固有语义，请只在你信任的机器与账号下启用。
- 插件**只读 + 建目录**，没有写入文件、删除、重命名或改权限的能力。
- 单次目录列表最多 2000 条，单次预览最多 256 KiB。

## 开发

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # 查看实际会打进包里的文件
```

本地开发时 profile 用 `link:` 指向工作目录，改完刷新浏览器即可生效（客户端模块按内容哈希换版本）。

## 许可

MIT，见 [LICENSE](LICENSE)。
