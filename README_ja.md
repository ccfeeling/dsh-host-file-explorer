<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · **日本語** · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host ファイルエクスプローラー

### Harness が実行されているマシンのファイルシステムを閲覧できる左サイドバー項目を追加する DeepSeek Harness plugin。

[![MIT ライセンス](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![サイドバー項目](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#機能)
[![トランスポート](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#アーキテクチャ)

</div>

---

Harness の中から Host マシンのファイルシステムを閲覧できます。種類・サイズ・更新日時付きのディレクトリ一覧、テキストファイルのプレビュー、フォルダ作成に対応しています。すべての読み取りは Host/Client Remote チャネルを通り、これはエージェント自身のファイルシステムツールが使うのと同じ境界です。ファイルはブラウザーにダウンロードでき、画像はインラインでプレビューできます。 開いているディレクトリには、ファイルをアップロードできます。

![ホストファイルパネル](assets/screenshot-1.png)

## 機能

| 機能 | 説明 |
| --- | --- |
| ファイルのダウンロード | Harness 自身のも認証済みファイルルート経由で、ファイル名のままブラウザーに渡す |
| 画像プレビュー | PNG、JPEG、GIF、WebP、AVIF、SVG などの画像を、テキストとして読まずに表示する |
| ディレクトリ一覧 | ディレクトリを先に、ファイルを後に表示し、各項目にサイズと更新日時を付す。隠し項目は淡く表示される |
| パス移動 | 絶対パスへの移動、親ディレクトリへの移動、または HOME、tmp、cwd、ファイルシステムルートへのショートカット的使用 |
| ファイルプレビュー | テキストファイルの先頭 256 KiB を読み取って描画する。バイナリファイルはノイズを出力する代わりに、バイナリであることを報告する |
| フォルダ作成 | 現在のディレクトリ内に単一セグメントのサブディレクトリを作成する |
| 多言語 UI | 見える文字列はすべて `ctx.locale` を通り、パネルは 12 言語を同梱して表示中の言語に追従する |
| ファイルのアップロード | ブラウザーのファイルを開いているディレクトリへ、バイトを運ぶ 1 回の Remote 呼び出しとして送る |

## インストール

### plugin マネージャーから（推奨）

このリポジトリを clone してから、Harness の plugin マネージャーからインストールします：

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

対応するツール呼び出しは `plugin_manager { action: 'install_bundle', target: '<local path>' }` です。

### プラグインマーケットから

このプラグインは [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) に登録済みで、マーケットから直接 GitHub 経由でインストールできます：

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### profile の依存関係として

```jsonc アップロードされたファイルは他のコマンドと同じ Remote チャネルを通ります。バイトはブラウザーのファイルルートではなく、その呼び出し自体に含まれます。
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

インストール後、サイドバーの Plugins と Schedules の後ろに **フォルダアイコン** が表示されます。クリックするとパネルが開きます。

> **注意**: profile が agent skills を同梱する依存関係（たとえば `dsh-answer-me-with-html`）を持っている場合、skills ディレクトリを宣言するまで pnpm 10.11+ と 12.x はインストールを拒否し、`ERR_PNPM_NO_AGENT_SKILLS_DIR` で失敗します。profile の `pnpm-workspace.yaml` に 1 つの節を追加すれば、pnpm 自身の skill linking を無効にできます：
>
> ```yaml
> skills:
>   dirs: []
> ```

## アーキテクチャ

この plugin は標準の DSH bundle で、Host 半分と Client 半分から構成されています：

```
index.js   (Host)    ctx.hostFiles  ——  seven verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Host 半分**は `ctx.hostFiles` サービスを提供し、その verb に Remote transport 用の prototype marker `@deepseek-ai/dsh-typert-protocol/remote-methods` を付けます。こうして gateway は SRC モードでそれを検出できます：

| メソッド | パラメータ | 戻り値 |
| --- | --- | --- |
| `roots()` | — | よく知られた場所（HOME、tmp、cwd、ファイルシステムルート） |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `upload(path, name, data, signal)` | `path`, `name`, `data` | `{ path, size }` |
| `limits()` | — | 1 回のダウンロードが運べる最大ファイルサイズ |

`signal` は最後のパラメータでなければなりません。gateway はメソッドのシグネチャを `Function.prototype.toString()` で解析して wire パラメータを導出するため、シグネチャが壊れると呼び出しは失敗します。

### ファイルがブラウザーに届く仕組み

ページはファイルの中身を Remote チャンネルに載せて運ばせることはありません。Host に尋ねるのは、Harness 自身のも認証済みファイルルート上のファイルのアドレスです。公式のドキュメントプレビューが Markdown 内の画像に使うのと同じルートで、ブラウザーはページが既に保持しているセッションで取得します。ダウンロードはファイル名のまま届き、プレビューはファイル自身の内容型を受け取るので、PNG は PNG として描かれます。

1 回の応答は Harness の添付バイト上限（既定 20 MiB）に制限されます。ページはこの数字を Host から読み取り、上限を超えるダウンロードは失敗する転送を始める代わりに、理由を説明して拒否します。

**Client 半分**は Typert の Remote contribution を手書きし、`ctx.remote.$mount(...)` で mount してから、2 つの slot を登録します：

- `sidebar.panellist`: id `host-files`、order `30`、独自のフォルダアイコン付き；
- `main`: key `host-files`、サイドバーのボタンが開くパネル。

### 知っておくべき 2 つの落とし穴

1. **名前空間を plugin 自身の inject として宣言できません。** mount された `remote.hostFiles` はそれ自体が 1 つの service であり、この plugin の mount が実行された後にしか現れません。この service を待つ fiber は決して起動しないため、plugin は開始できません。代わりに `ctx.get('remote.hostFiles')` で読み取ってください。これは共有 store から service を直接読み取る Cordis mixin の entry point です：

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   同梱の plugin が `inject: ['remote.agentPresets']` と書けるのは、別の package がその名前空間を mount しているからです。これにより利用側では依存関係を自由に宣言できます。

2. **Client 半分は Harness の client package に依存しません。** この plugin は `react` と `zod` だけを使い、`--dsw-alias-*` の theme token でスタイルし、`@deepseek-ai/dsh-client-ui-primitives` やその姉妹 package からは何も import しません。

## 権限と境界

- この plugin は **Harness プロセス自身の権限** で Host ファイルシステムを読み取ります。実行しているアカウントが読み取れるものはすべて読み取れます。これは Host ファイルエクスプローラーとして本質的な性質なので、信頼できるマシンとアカウントでのみ有効にしてください。
- このプラグインは**読み取り専用で、フォルダーの作成とファイルのアップロードだけができます**。既存ファイルを書き換えたり削除したり名前を変更することはせず、アップロードが既存のファイルを置き換えることもありません。
- 1 回の listing で返る項目は最大 2000 件、1 回の preview で読み取るのは最大 256 KiB です。
- 1 回のダウンロードが運べるのは Harness の添付バイト上限（既定 20 MiB）までで、超える場合はパネルが先に理由を示します。

## 開発

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

ローカル開発中は profile が `link:` によって作業ディレクトリを指すため、編集すればブラウザの更新だけで反映されます（client module は content hash でバージョン付けされます）。

## ライセンス

MIT です。[ライセンス](LICENSE) を参照してください。
