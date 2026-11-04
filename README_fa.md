<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · **فارسی** · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# مرورگر فایل DSH Host

### یک plugin از DeepSeek Harness که یک ورودی در نوار کناری چپ اضافه می‌کند تا بتوانید فایل‌سیستم ماشینی را که Harness روی آن اجرا می‌شود مرور کنید.

[![مجوز MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![ورودی نوار کناری](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#امکانات)
[![انتقال](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#معماری)

</div>

---

از داخل Harness فایل‌سیستم ماشین Host را مرور کنید: فهرست پوشه‌ها همراه با نوع، اندازه و زمان ویرایش، پیش‌نمایش فایل‌های متنی و ساخت پوشه. هر خواندن از کانال Host/Client Remote عبور می‌کند؛ همان مرزی که ابزارهای فایل‌سیستم خودِ agent هم از آن استفاده می‌کنند. فایل‌ها را می‌توان در مرورگر دانلود کرد و تصاویر به‌صورت درون‌خطی پیش‌نمایش می‌شوند.

## امکانات

| قابلیت | توضیح |
| --- | --- |
| دانلود فایل | فایل را از راه مسیر فایل احرازهویت‌شدهٔ خود Harness با همان نام اصلی به مرورگر می‌سپارد |
| پیش‌نمایش تصویر | تصاویر PNG، JPEG، GIF، WebP، AVIF یا SVG را درون‌خطی نشان می‌دهد، به‌جای خواندن آن‌ها به‌صورت متن |
| فهرست پوشه‌ها | ابتدا پوشه‌ها و سپس فایل‌ها، هر کدام با اندازه و زمان ویرایش؛ ورودی‌های پنهان کم‌رنگ نمایش داده می‌شوند |
| پیمایش مسیر | پرش به یک مسیر مطلق، رفتن به پوشه بالادست، یا استفاده از میان‌بُرهای HOME، tmp، cwd و ریشه فایل‌سیستم |
| پیش‌نمایش فایل | نخستین 256 KiB یک فایل متنی را می‌خواند و نمایش می‌دهد؛ فایل‌های دودویی به‌جای چاپ خروجی بی‌معنا، خودشان را گزارش می‌کنند |
| ساخت پوشه | یک زیرپوشه تک‌بخشی درون پوشه جاری می‌سازد |
| رابط کاربری دوزبانه | هر رشته قابل‌مشاهده از `ctx.locale` می‌گذرد، بنابراین پنل از زبان رابط کاربری پیروی می‌کند |

## نصب

### با مدیر plugin (توصیه‌شده)

این مخزن را clone کنید، سپس آن را از مدیر plugin در Harness نصب کنید:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

فراخوانی متناظر ابزار این است: `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### از فروشگاه افزونه‌ها

این افزونه در فهرست [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) ثبت شده است، بنابراین فروشگاه می‌تواند آن را مستقیماً از GitHub نصب کند:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### به‌عنوان وابستگی profile

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

پس از نصب، یک **آیکون پوشه** در نوار کناری ظاهر می‌شود، بعد از Plugins و Schedules. برای باز کردن پنل روی آن کلیک کنید.

> **توجه**: اگر profile شما وابستگی‌ای داشته باشد که agent skills را همراه داشته باشد (برای مثال `dsh-answer-me-with-html`)، نسخه‌های pnpm 10.11+ و 12.x تا زمانی که پوشه skills اعلام نشده است از نصب خودداری می‌کنند و با `ERR_PNPM_NO_AGENT_SKILLS_DIR` شکست می‌خورند. با یک بند در `pnpm-workspace.yaml` پروفایل، پیوندسازی skill خودِ pnpm را غیرفعال کنید:
>
> ```yaml
> skills:
>   dirs: []
> ```

## معماری

این plugin یک bundle استاندارد DSH است که یک نیمه Host و یک نیمه Client دارد:

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**نیمه Host** سرویس `ctx.hostFiles` را فراهم می‌کند و فعل‌های آن را با نشانگر prototype یعنی `@deepseek-ai/dsh-typert-protocol/remote-methods` برای انتقال Remote علامت‌گذاری می‌کند تا gateway بتواند آن را در حالت SRC پیدا کند:

| متد | پارامترها | مقدار بازگشتی |
| --- | --- | --- |
| `roots()` | — | مکان‌های شناخته‌شده (HOME، tmp، cwd، ریشه فایل‌سیستم) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | بزرگ‌ترین فایلی که یک بار دانلود می‌تواند حمل کند |

`signal` باید آخرین پارامتر باشد: gateway امضای متد را با `Function.prototype.toString()` تجزیه می‌کند تا پارامترهای روی شبکه را به دست آورد و امضای خراب باعث شکست فراخوانی می‌شود.

### چگونه فایل‌ها به مرورگر می‌رسند

صفحه هرگز بایت‌های فایل را از کانال Remote عبور نمی‌دهد. از Host نشانی فایل را روی مسیر فایل احرازهویت‌شدهٔ خود Harness می‌پرسد — همان مسیری که پیش‌نمایش اسناد همراه Harness برای تصاویر درون سند Markdown به کار می‌برد — و مرورگر آن را با نشستی که صفحه از پیش دارد می‌گیرد. بنابراین دانلود نام اصلی فایل را نگه می‌دارد و پیش‌نمایش نوع محتوای واقعی فایل را دریافت می‌کند، پس یک PNG هم‌چون PNG ترسیم می‌شود.

هر پاسخ با سقف بایت پیوست‌های Harness محدود است (به‌طور پیش‌فرض ۲۰ MiB). صفحه این عدد را از Host می‌خواند و دانلود بیش از حد را با توضیح رد می‌کند، به‌جای آنکه انتقالی را آغاز کند که ناگزیر شکست می‌خورد.

**نیمه Client** یک مشارکت Typert Remote را دستی می‌نویسد، آن را با `ctx.remote.$mount(...)` mount می‌کند و سپس دو slot را ثبت می‌کند:

- `sidebar.panellist`: id برابر `host-files`، order برابر `30`، با آیکون پوشه مخصوص خودش؛
- `main`: key برابر `host-files`، پنلی که دکمه نوار کناری باز می‌کند.

### دو دام که باید بدانید

1. **namespace را نمی‌توان به‌عنوان inject خودِ plugin اعلام کرد.** `remote.hostFiles` که mount شده، خودش یک سرویس است و تنها پس از اجرای mount این plugin ظاهر می‌شود — fiber‌ای که منتظر آن بماند هرگز بیدار نمی‌شود، پس plugin هرگز اجرا نخواهد شد. به‌جای آن، آن را با `ctx.get('remote.hostFiles')` بخوانید؛ این نقطه ورود mixin در Cordis است که یک سرویس را مستقیم از انبار مشترک می‌خواند:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   pluginهای منتشرشده تنها به این دلیل می‌توانند `inject: ['remote.agentPresets']` بنویسند که package دیگری آن namespaceها را mount می‌کند و به این ترتیب مصرف‌کننده آزاد است که وابستگی را اعلام کند.

2. **نیمه Client به هیچ package کلاینت Harness وابسته نیست.** این plugin فقط از `react` و `zod` استفاده می‌کند، خودش را با tokenهای تم `--dsw-alias-*` استایل می‌دهد و هیچ چیزی از `@deepseek-ai/dsh-client-ui-primitives` یا هم‌خانواده‌های آن را وارد نمی‌کند.

## دسترسی‌ها و مرزها

- این plugin فایل‌سیستم ماشین Host را با **دسترسی‌های خودِ فرایند Harness** می‌خواند: هر چیزی را که حساب کاربریِ اجراکننده‌اش می‌تواند بخواند، می‌تواند بخواند. این ویژگیِ ذاتیِ یک مرورگر فایل میزبان است، بنابراین آن را فقط روی ماشین‌ها و حساب‌هایی فعال کنید که به آن‌ها اعتماد دارید.
- این plugin **فقط‌خواندنی است به‌علاوهٔ ساخت پوشه**. نمی‌تواند فایل بنویسد، حذف کند، تغییر نام دهد یا دسترسی‌ها را تغییر دهد.
- یک فهرست حداکثر 2000 ورودی برمی‌گرداند و یک پیش‌نمایش حداکثر 256 KiB می‌خواند.
- یک دانلود حداکثر سقف بایت پیوست‌های Harness را حمل می‌کند (به‌طور پیش‌فرض ۲۰ MiB)؛ در صورت تجاوز، پنل نخست دلیل را می‌گوید.

## توسعه

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

در طول توسعهٔ محلی، profile با `link:` به پوشهٔ کاری اشاره می‌کند، بنابراین پس از تازه‌سازی مرورگر تغییرات بی‌درنگ اعمال می‌شود (ماژول client بر پایهٔ hash محتوا نسخه‌بندی می‌شود).

## مجوز

MIT، ببینید [LICENSE](LICENSE).
