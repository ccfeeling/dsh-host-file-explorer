<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · **Tiếng Việt** · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host Trình duyệt tệp

### Một plugin DeepSeek Harness bổ sung một mục ở thanh bên trái để duyệt hệ thống tệp của máy đang chạy Harness.

[![Giấy phép MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Mục trên thanh bên](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#tính-năng)
[![Truyền tải Host/Client Remote](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#kiến-trúc)

</div>

---

Duyệt hệ thống tệp của máy host từ bên trong Harness: danh sách thư mục kèm loại, kích thước và thời gian sửa đổi, xem trước tệp văn bản và tạo thư mục. Mọi lượt đọc đều đi qua kênh Host/Client Remote, cùng ranh giới mà các công cụ hệ thống tệp của chính agent sử dụng. Tệp có thể tải xuống trình duyệt, và hình ảnh được xem trước ngay tại chỗ. Tệp cũng có thể được tải lên thư mục đang mở.

![Bảng tệp máy chủ](assets/screenshot-1.png)

## Tính năng

| Tính năng | Mô tả |
| --- | --- |
| Tải tệp xuống | Đưa tệp tới trình duyệt qua tuyến tệp có xác thực của Harness, giữ nguyên tên tệp |
| Xem trước hình ảnh | Hiển thị trực tiếp PNG, JPEG, GIF, WebP, AVIF hoặc SVG thay vì đọc như văn bản |
| Danh sách thư mục | Thư mục trước, rồi đến tệp, mỗi mục kèm kích thước và thời gian sửa đổi; các mục ẩn được hiển thị mờ |
| Điều hướng đường dẫn | Nhảy đến một đường dẫn tuyệt đối, lên thư mục cha, hoặc dùng các phím tắt cho HOME, tmp, cwd và thư mục gốc của hệ thống tệp |
| Xem trước tệp | Đọc 256 KiB đầu tiên của một tệp văn bản và hiển thị nội dung đó; tệp nhị phân sẽ báo rõ thay vì in ra dữ liệu rác |
| Tạo thư mục | Tạo một thư mục con chỉ gồm một phần tên bên trong thư mục hiện tại |
| Giao diện đa ngôn ngữ | Mọi chuỗi hiển thị đều đi qua `ctx.locale`; bảng điều khiển có mười hai ngôn ngữ và theo ngôn ngữ của giao diện |
| Tải tệp lên | Gửi một tệp từ trình duyệt tới thư mục đang mở, trong một lệnh Remote mang theo byte |

## Cài đặt

### Bằng trình quản lý plugin (khuyến nghị)

Clone kho lưu trữ này, rồi cài đặt từ trình quản lý plugin của Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

Lệnh gọi công cụ tương ứng là `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Từ chợ plugin

Plugin này đã có trong danh sách [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin), nên chợ có thể cài nó thẳng từ GitHub:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### Như một phụ thuộc của profile

```jsonc Tệp tải lên đi theo kênh Remote như mọi lệnh khác: byte của tệp nằm trong chính lệnh đó, chứ không đi qua tuyến tệp của trình duyệt.
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Sau khi cài đặt, một **biểu tượng thư mục** xuất hiện trên thanh bên, ở sau Plugins và Schedules. Nhấn vào nó để mở bảng điều khiển.

> **Lưu ý**: nếu profile của bạn có một phụ thuộc đi kèm agent skills (ví dụ `dsh-answer-me-with-html`), pnpm 10.11+ và 12.x sẽ từ chối cài đặt cho đến khi thư mục skills được khai báo, và thất bại với `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Tắt tính năng skill linking của chính pnpm bằng một đoạn khai báo trong `pnpm-workspace.yaml` của profile:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Kiến trúc

Plugin này là một bundle DSH tiêu chuẩn, gồm một nửa Host và một nửa Client:

```
index.js   (Host)    ctx.hostFiles  ——  seven verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Nửa Host** cung cấp một service `ctx.hostFiles` và đánh dấu các verb của nó cho transport Remote bằng prototype marker `@deepseek-ai/dsh-typert-protocol/remote-methods`, để gateway có thể phát hiện nó ở chế độ SRC:

| Phương thức | Tham số | Trả về |
| --- | --- | --- |
| `roots()` | — | Các vị trí quen thuộc (HOME, tmp, cwd, thư mục gốc của hệ thống tệp) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `upload(path, name, data, signal)` | `path`, `name`, `data` | `{ path, size }` |
| `limits()` | — | Kích thước tệp lớn nhất mà một lần tải xuống có thể mang |

`signal` phải là tham số cuối cùng: gateway phân tích chữ ký của phương thức bằng `Function.prototype.toString()` để suy ra các tham số trên wire, và một chữ ký sai lệch sẽ khiến lời gọi thất bại.

### Tệp đến với trình duyệt bằng cách nào

Trang không bao giờ mang byte tệp qua kênh Remote. Nó hỏi Host địa chỉ của tệp trên tuyến tệp có xác thực của chính Harness — cùng tuyến mà bộ xem trước tài liệu đi kèm dùng cho các hình ảnh bên trong tài liệu Markdown — rồi trình duyệt tải tệp bằng phiên làm việc mà trang đã có. Nhờ vậy, lần tải xuống giữ nguyên tên tệp, còn phần xem trước nhận đúng kiểu nội dung của tệp, nên một tệp PNG được hiển thị đúng như PNG.

Một câu trả lời bị giới hạn bởi giới hạn byte đính kèm của Harness (mặc định 20 MiB). Trang đọc con số này từ Host và từ chối lần tải xuống quá lớn kèm lời giải thích, thay vì bắt đầu một lần truyền chắc chắn thất bại.

**Nửa Client** tự viết một contribution Remote của Typert, mount nó bằng `ctx.remote.$mount(...)`, rồi đăng ký hai slot:

- `sidebar.panellist`: id `host-files`, order `30`, kèm biểu tượng thư mục riêng;
- `main`: key `host-files`, bảng điều khiển mà nút trên thanh bên mở ra.

### Hai cái bẫy đáng lưu tâm

1. **Namespace không thể được khai báo là inject của chính plugin.** Namespace `remote.hostFiles` đã mount là một service độc lập, và nó chỉ xuất hiện sau khi mount của plugin này chạy xong — một fiber chờ namespace đó sẽ không bao giờ thức dậy, nên plugin sẽ không bao giờ khởi động. Hãy đọc nó bằng `ctx.get('remote.hostFiles')`, entry point của mixin Cordis đọc service trực tiếp từ store dùng chung:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Plugin được phát hành có thể viết `inject: ['remote.agentPresets']` chỉ vì một package khác đã mount các namespace đó, điều này để cho bên sử dụng tự do khai báo phụ thuộc.

2. **Nửa Client không phụ thuộc vào bất kỳ client package nào của Harness.** Plugin này chỉ dùng `react` và `zod`, tự tạo kiểu bằng các theme token `--dsw-alias-*`, và không import gì từ `@deepseek-ai/dsh-client-ui-primitives` hay các package cùng nhóm.

## Quyền hạn và ranh giới

- Plugin đọc hệ thống tệp của host với **quyền của chính tiến trình Harness**: nó có thể đọc mọi thứ mà tài khoản đang chạy nó có quyền đọc. Điều này là đặc tính cố hữu của một trình duyệt tệp trên host, vì vậy chỉ hãy bật nó trên những máy và tài khoản mà bạn tin tưởng.
- Plugin này **chỉ đọc, kèm tạo thư mục và tải tệp lên**. Nó không sửa, xóa hay đổi tên một tệp đã có, và một lần tải lên không bao giờ ghi đè tệp cũ.
- Một lần liệt kê trả về nhiều nhất 2000 mục, và một lần xem trước đọc nhiều nhất 256 KiB.
- Một lần tải xuống chỉ mang tối đa giới hạn byte đính kèm của Harness (mặc định 20 MiB); nếu vượt quá, bảng điều khiển sẽ nói rõ lý do trước.

## Phát triển

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Trong quá trình phát triển cục bộ, profile trỏ tới thư mục làm việc bằng `link:`, nên một thay đổi sẽ có hiệu lực sau khi làm mới trình duyệt (client module được đánh phiên bản theo content hash).

## Giấy phép

MIT, xem [LICENSE](LICENSE).
