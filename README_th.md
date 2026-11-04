<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · **ไทย** · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH ตัวสำรวจไฟล์ Host

### plugin ของ DeepSeek Harness ที่เพิ่มรายการในแถบด้านซ้ายเพื่อเลือกดูระบบไฟล์ของเครื่องที่ Harness ทำงานอยู่

[![ใบอนุญาต MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![รายการในแถบด้านข้าง](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#คุณสมบัติ)
[![การขนส่ง Host/Client Remote](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#สถาปัตยกรรม)

</div>

---

เลือกดูระบบไฟล์ของเครื่อง host ได้จากภายใน Harness: รายการไดเรกทอรีพร้อมชนิด ขนาด และเวลาแก้ไขล่าสุด ตัวอย่างไฟล์ข้อความ และการสร้างโฟลเดอร์ การอ่านทุกครั้งผ่านช่องทาง Host/Client Remote ซึ่งเป็นขอบเขตเดียวกับที่เครื่องมือระบบไฟล์ของเอเจนต์ใช้เอง

## คุณสมบัติ

| คุณสมบัติ | คำอธิบาย |
| --- | --- |
| การแสดงรายการไดเรกทอรี | แสดงไดเรกทอรีก่อน ตามด้วยไฟล์ แต่ละรายการมีขนาดและเวลาแก้ไขล่าสุด รายการที่ซ่อนอยู่จะถูกทำให้จาง |
| การนำทางตามพาธ | ข้ามไปยังพาธแบบสัมบูรณ์ ไปยังไดเรกทอรีระดับบน หรือใช้ทางลัดสำหรับ HOME, tmp, cwd และรากของระบบไฟล์ |
| ตัวอย่างไฟล์ | อ่านข้อมูล 256 KiB แรกของไฟล์ข้อความแล้วแสดงผล ไฟล์ไบนารีจะรายงานสถานะของตัวเองแทนการพิมพ์ข้อมูลที่อ่านไม่ออก |
| การสร้างโฟลเดอร์ | สร้างไดเรกทอรีย่อยที่มีชื่อเดียวภายในไดเรกทอรีปัจจุบัน |
| UI สองภาษา | ข้อความที่มองเห็นทุกสตริงผ่าน `ctx.locale` ดังนั้นแผงนี้จะเปลี่ยนตามภาษาของส่วนติดต่อผู้ใช้ |

## การติดตั้ง

### ด้วย plugin manager (แนะนำ)

โคลน repository นี้ แล้วติดตั้งจาก plugin manager ของ Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

การเรียก tool ที่ตรงกันคือ `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### ในฐานะ dependency ของ profile

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

หลังติดตั้ง **ไอคอนโฟลเดอร์** จะปรากฏในแถบด้านข้าง ต่อจาก Plugins และ Schedules คลิกที่ไอคอนเพื่อเปิดแผงนี้

> **หมายเหตุ**: หาก profile ของคุณมี dependency ที่แจกจ่าย agent skills (ตัวอย่างเช่น `dsh-answer-me-with-html`) pnpm 10.11+ และ 12.x จะปฏิเสธการติดตั้งจนกว่าจะได้ประกาศไดเรกทอรี skills และจะล้มเหลวด้วย `ERR_PNPM_NO_AGENT_SKILLS_DIR` ปิดการเชื่อมโยง skill ของ pnpm เองได้ด้วย stanza เดียวใน `pnpm-workspace.yaml` ของ profile:
>
> ```yaml
> skills:
>   dirs: []
> ```

## สถาปัตยกรรม

plugin นี้เป็น DSH bundle มาตรฐานที่มีครึ่งหนึ่งเป็น Host และอีกครึ่งเป็น Client:

```
index.js   (Host)    ctx.hostFiles  ——  five verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

ครึ่ง **Host** จัดให้มี service `ctx.hostFiles` และทำเครื่องหมาย verb ของมันสำหรับการขนส่งผ่าน Remote ด้วย prototype marker `@deepseek-ai/dsh-typert-protocol/remote-methods` เพื่อให้ gateway ค้นพบได้ในโหมด SRC:

| เมธอด | พารามิเตอร์ | ค่าที่ส่งกลับ |
| --- | --- | --- |
| `roots()` | — | ตำแหน่งที่เป็นที่รู้จักดี (HOME, tmp, cwd, รากของระบบไฟล์) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |

`signal` ต้องเป็นพารามิเตอร์สุดท้าย: gateway จะอ่านลายเซ็นของเมธอดด้วย `Function.prototype.toString()` เพื่อหาพารามิเตอร์บนสาย และหากลายเซ็นผิดพลาดการเรียกนี้จะล้มเหลว

ครึ่ง **Client** เขียน Typert Remote contribution ด้วยมือ mount ด้วย `ctx.remote.$mount(...)` แล้วจึงลงทะเบียนสองสล็อต:

- `sidebar.panellist`: id `host-files`, order `30`, พร้อมไอคอนโฟลเดอร์ของตัวเอง;
- `main`: key `host-files`, แผงที่ปุ่มในแถบด้านข้างเปิดขึ้นมา

### กับดักสองข้อที่ควรรู้

1. **namespace ไม่สามารถประกาศเป็น inject ของ plugin เองได้** `remote.hostFiles` ที่ถูก mount เป็น service ในตัวมันเอง และจะปรากฏก็ต่อเมื่อการ mount ของ plugin นี้ได้ทำงานแล้วเท่านั้น — fiber ที่รอมันอยู่จะไม่มีวันตื่นขึ้นมา ดังนั้น plugin จะไม่มีวันเริ่มทำงาน ให้อ่านด้วย `ctx.get('remote.hostFiles')` แทน ซึ่งเป็นจุดเข้า mixin ของ Cordis ที่อ่าน service จาก shared store โดยตรง:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   plugin ที่แจกจ่ายมาสามารถเขียน `inject: ['remote.agentPresets']` ได้ก็เพราะมีแพ็กเกจอื่น mount namespace เหล่านั้น ซึ่งเปิดให้ผู้ใช้ประกาศ dependency ได้อย่างอิสระ

2. **ครึ่ง client ไม่ได้พึ่งพาแพ็กเกจ client ของ Harness เลย** plugin นี้ใช้เพียง `react` และ `zod` จัดสไตล์ตัวเองด้วย theme token แบบ `--dsw-alias-*` และไม่ได้ import อะไรจาก `@deepseek-ai/dsh-client-ui-primitives` หรือพี่น้องของมัน

## สิทธิ์และขอบเขต

- plugin อ่านระบบไฟล์ของ host ด้วย **สิทธิ์ของกระบวนการ Harness เอง**: มันสามารถอ่านทุกอย่างที่บัญชีผู้ใช้งานอยู่อ่านได้ นี่เป็นสิ่งที่ตัวสำรวจไฟล์ของ host ต้องเป็นอยู่โดยธรรมชาติ ดังนั้นจึงควรเปิดใช้งานเฉพาะบนเครื่องและบัญชีที่คุณเชื่อถือเท่านั้น
- plugin เป็นแบบ **อ่านอย่างเดียวบวกกับการสร้างโฟลเดอร์** เท่านั้น มันเขียนไฟล์ ลบ เปลี่ยนชื่อ หรือเปลี่ยนสิทธิ์ไม่ได้
- การแสดงรายการหนึ่งครั้งคืนรายการได้มากสุด 2000 รายการ และการแสดงตัวอย่างหนึ่งครั้งอ่านได้มากสุด 256 KiB

## การพัฒนา

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

ในระหว่างการพัฒนาในเครื่อง profile จะชี้ไปยังไดเรกทอรีที่กำลังทำงานด้วย `link:` ดังนั้นหลังรีเฟรชเบราว์เซอร์ การแก้ไขก็จะมีผลทันที (โมดูล client มีเวอร์ชันตาม content hash)

## สัญญาอนุญาต

MIT ดูที่ [LICENSE](LICENSE).
