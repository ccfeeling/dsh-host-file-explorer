<div align="center">

[English](README.md) · [简体中文](README_zh.md) · **繁體中文** · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH 主機檔案資源管理器

### 一個 DeepSeek Harness plugin，在左側邊欄新增一個項目，可用來瀏覽 Harness 執行所在機器的檔案系統。

[![MIT 授權](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![側邊欄項目](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#功能)
[![傳輸機制](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#架構)

</div>

---

在 Harness 內瀏覽 host 機器的檔案系統：目錄清單會列出類型、大小與修改時間，並提供文字檔預覽與建立資料夾功能。所有讀取都經由 Host/Client Remote 通道，與 agent 自身的檔案系統工具使用相同的邊界。檔案可以直接下載到瀏覽器，圖片則能內嵌預覽。 檔案也可以上傳到目前開啟的目錄。

![主機檔案面板](assets/screenshot-1.png)

## 功能

| 功能 | 說明 |
| --- | --- |
| 檔案下載 | 透過 Harness 自帶的鑑權檔案路由把檔案交給瀏覽器，並保留檔案原名 |
| 圖片預覽 | 內嵌顯示 PNG、JPEG、GIF、WebP、AVIF、SVG 等圖片，不再當作文字讀取 |
| 目錄清單 | 先列出目錄，再列出檔案，每個項目都附有大小與修改時間；隱藏項目會以較淡的樣式顯示 |
| 路徑導覽 | 跳至絕對路徑、回到上層目錄，或使用 HOME、tmp、cwd 與檔案系統根目錄的快捷方式 |
| 檔案預覽 | 讀取文字檔的前 256 KiB 並加以呈現；二進位檔會直接回報自身狀態，而非印出雜訊 |
| 建立資料夾 | 在目前目錄內建立單一段的子目錄 |
| 多語言介面 | 所有可見文字都經過 `ctx.locale` 處理，面板自帶十二種語言，並跟隨介面語言 |
| 檔案上傳 | 把瀏覽器裡的檔案送到目前開啟的目錄，作為一次攜帶位元組的 Remote 呼叫 |

## 安裝

### 使用 plugin 管理器安裝（建議）

先複製本儲存庫，再從 Harness plugin 管理器安裝：

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

對應的工具呼叫為 `plugin_manager { action: 'install_bundle', target: '<local path>' }`。

### 從外掛市集安裝

本外掛已收錄於 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 清單，市集可以直接從 GitHub 安裝：

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### 作為 profile 相依性套件

```jsonc 上傳的檔案和其他命令一樣走 Remote 通道：位元組就在這次呼叫裡面，而不是走瀏覽器的檔案路由。
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

安裝後，側邊欄會在 Plugins 與 Schedules 之後出現一個**資料夾圖示**。點擊它即可開啟面板。

> **注意**：若你的 profile 中有會隨附 agent skills 的相依性套件（例如 `dsh-answer-me-with-html`），pnpm 10.11+ 與 12.x 會在宣告 skills 目錄之前拒絕安裝，並以 `ERR_PNPM_NO_AGENT_SKILLS_DIR` 失敗。可在 profile 的 `pnpm-workspace.yaml` 中加入一段設定，關閉 pnpm 自身的 skill 連結功能：
>
> ```yaml
> skills:
>   dirs: []
> ```

## 架構

這個 plugin 是標準的 DSH bundle，由 Host 與 Client 兩半組成：

```
index.js   (Host)    ctx.hostFiles  ——  seven verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Host 那一半**提供 `ctx.hostFiles` service，並以 prototype 標記 `@deepseek-ai/dsh-typert-protocol/remote-methods` 標記它的各個 methods 以供 Remote 傳輸使用，讓 gateway 能在 SRC 模式下找到它：

| Method | 參數 | 回傳值 |
| --- | --- | --- |
| `roots()` | — | 常用位置（HOME、tmp、cwd、檔案系統根目錄） |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `upload(path, name, data, signal)` | `path`, `name`, `data` | `{ path, size }` |
| `limits()` | — | 單次下載可攜帶的最大檔案大小 |

`signal` 必須是最後一個參數：gateway 會以 `Function.prototype.toString()` 解析 method 簽章以推導 wire 參數，簽章一旦損壞就會導致呼叫失敗。

### 檔案如何到達瀏覽器

頁面不會把檔案位元組塞進 Remote 通道。它向 Host 詢問該檔案在 Harness 自帶的鑑權檔案路由上的位址——官方文件預覽渲染 Markdown 內嵌圖片時用的正是這條路由——瀏覽器再用頁面已有的工作階段去取。於是下載保留檔案原名，預覽拿到檔案自己的內容型別，PNG 就是按 PNG 算繪的。

單次回應受 Harness 附件位元組上限約束（預設 20 MiB）。頁面會從 Host 讀到這個數字，遇到超限檔案直接說明原因，而不是發起注定失敗的傳輸。

**Client 那一半**以手寫方式提供一個 Typert Remote 貢獻，以 `ctx.remote.$mount(...)` 掛載它，接著註冊兩個 slots：

- `sidebar.panellist`：id 為 `host-files`，order 為 `30`，並帶有自己的資料夾圖示；
- `main`：key 為 `host-files`，即側邊欄按鈕所開啟的面板。

### 值得注意的兩個陷阱

1. **不能把這個 namespace 宣告成 plugin 自己的 inject。** 掛載後的 `remote.hostFiles` 本身就是一個 service，而且只有在這個 plugin 的 mount 執行完畢後才會出現——等待它的 fiber 永遠不會醒來，plugin 因此永遠無法啟動。請改用 `ctx.get('remote.hostFiles')` 來讀取，這是 Cordis mixin 的進入點，可直接從共用儲存區取用 service：

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   隨附發佈的 plugin 能寫出 `inject: ['remote.agentPresets']`，是因為另有其他 package 掛載了那些 namespace，這樣一來使用端才能自由宣告該相依性。

2. **client 那一半不依賴任何 Harness client package。** 這個 plugin 只使用 `react` 與 `zod`，以 `--dsw-alias-*` 佈景 token 為自身樣式，且不從 `@deepseek-ai/dsh-client-ui-primitives` 或其同系列套件匯入任何東西。

## 權限與界限

- 這個 plugin 讀取 host 檔案系統時，**擁有 Harness 程序本身的權限**：它能讀取執行它的帳戶所能讀取的一切。這是 host 檔案瀏覽器固有的特性，因此只在你信任的機器與帳戶上啟用它。
- 外掛**唯讀，另外可以新增資料夾與上傳檔案**。它不會修改、刪除或重新命名既有的檔案，上傳也絕不會覆寫同名檔案。
- 一次清單最多回傳 2000 個項目，一次預覽最多讀取 256 KiB。
- 單次下載最多攜帶 Harness 附件位元組上限（預設 20 MiB）的內容；超限時面板會先說明原因。

## 開發

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

在本地開發期間，profile 會以 `link:` 指向工作目錄，因此重新整理瀏覽器後修改就會立即生效（client 模組以內容雜湊作為版本）。

## 授權

MIT，詳見 [LICENSE](LICENSE)。
