<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · **Bahasa Indonesia** · [Italiano](README_it.md)

# DSH Host Penjelajah File

### Plugin DeepSeek Harness yang menambahkan entri sidebar kiri untuk menjelajahi sistem berkas mesin tempat Harness berjalan.

[![Lisensi MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![entri sidebar](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#fitur)
[![transpor](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#arsitektur)

</div>

---

Jelajahi sistem berkas mesin host dari dalam Harness: daftar direktori beserta jenis, ukuran, dan waktu modifikasinya, pratinjau berkas teks, serta pembuatan folder. Setiap pembacaan melewati kanal Remote Host/Client, batas yang sama dengan yang dipakai oleh alat sistem berkas milik agent itu sendiri.

## Fitur

| Fitur | Deskripsi |
| --- | --- |
| Daftar direktori | Direktori ditampilkan lebih dahulu, lalu berkas; masing-masing dilengkapi ukuran dan waktu modifikasi; entri tersembunyi ditampilkan redup |
| Navigasi path | Lompat ke path absolut, naik ke direktori induk, atau gunakan pintasan untuk HOME, tmp, cwd, dan root sistem berkas |
| Pratinjau berkas | Membaca 256 KiB pertama dari berkas teks lalu menampilkannya; berkas biner melaporkan dirinya sendiri alih-alih mencetak keluaran berantakan |
| Pembuatan folder | Membuat subdirektori satu segmen di dalam direktori saat ini |
| UI dwibahasa | Setiap string yang terlihat melewati `ctx.locale`, sehingga panel mengikuti bahasa antarmuka |

## Instalasi

### Dengan plugin manager (disarankan)

Kloning repositori ini, lalu pasang dari plugin manager Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

Tool call yang setara adalah `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Sebagai dependensi profil

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Setelah pemasangan, sebuah **ikon folder** muncul di sidebar, setelah Plugins dan Schedules. Klik ikon tersebut untuk membuka panel.

> **Catatan**: jika profil Anda memiliki dependensi yang menyertakan agent skills (misalnya `dsh-answer-me-with-html`), pnpm 10.11+ dan 12.x menolak memasang sampai direktori skills dideklarasikan, dan gagal dengan `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Matikan skill linking bawaan pnpm dengan satu stanza di `pnpm-workspace.yaml` milik profil:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Arsitektur

Plugin ini adalah bundle DSH standar dengan separuh Host dan separuh Client:

```
index.js   (Host)    ctx.hostFiles  ——  five verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Separuh Host** menyediakan service `ctx.hostFiles` dan menandai verb-nya untuk transpor Remote dengan marker prototipe `@deepseek-ai/dsh-typert-protocol/remote-methods`, sehingga gateway dapat menemukannya dalam mode SRC:

| Metode | Parameter | Hasil |
| --- | --- | --- |
| `roots()` | — | Lokasi umum (HOME, tmp, cwd, root sistem berkas) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |

`signal` harus menjadi parameter terakhir: gateway mengurai tanda tangan method dengan `Function.prototype.toString()` untuk menurunkan parameter wire, dan tanda tangan yang rusak membuat pemanggilan gagal.

**Separuh Client** menulis secara manual sebuah kontribusi Typert Remote, memasangkannya dengan `ctx.remote.$mount(...)`, lalu mendaftarkan dua slot:

- `sidebar.panellist`: id `host-files`, urutan `30`, dengan ikon folder sendiri;
- `main`: key `host-files`, panel yang dibuka oleh tombol sidebar.

### Dua jebakan yang perlu diketahui

1. **Namespace tidak dapat dideklarasikan sebagai inject milik plugin itu sendiri.** `remote.hostFiles` yang terpasang adalah sebuah service tersendiri, dan ia baru muncul setelah mount plugin ini berjalan — fiber yang menunggunya tidak akan pernah terbangun, sehingga plugin tidak akan pernah mulai. Bacalah dengan `ctx.get('remote.hostFiles')` sebagai gantinya, titik masuk mixin Cordis yang membaca sebuah service langsung dari store bersama:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Plugin yang sudah dirilis dapat menulis `inject: ['remote.agentPresets']` hanya karena paket lain memasang namespace tersebut, sehingga konsumen bebas mendeklarasikan dependensinya.

2. **Separuh client tidak bergantung pada paket client Harness apa pun.** Plugin ini hanya menggunakan `react` dan `zod`, menata dirinya sendiri dengan token tema `--dsw-alias-*`, dan mengimpor apa pun dari `@deepseek-ai/dsh-client-ui-primitives` atau saudara-saudaranya.

## Izin dan batasan

- Plugin membaca sistem berkas host dengan **hak akses proses Harness itu sendiri**: ia dapat membaca semua yang dapat dibaca oleh akun yang menjalankannya. Hal ini melekat pada apa itu penjelajah file host, jadi hanya aktifkan di mesin dan akun yang Anda percaya.
- Plugin bersifat **hanya-baca ditambah pembuatan folder**. Ia tidak dapat menulis berkas, menghapus, mengganti nama, atau mengubah izin.
- Satu daftar mengembalikan paling banyak 2000 entri, dan satu pratinjau membaca paling banyak 256 KiB.

## Pengembangan

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Selama pengembangan lokal, profil menunjuk ke direktori kerja dengan `link:`, sehingga sebuah perubahan langsung aktif setelah penyegaran browser (modul client berversi berdasarkan hash konten).

## Lisensi

MIT, lihat [LICENSE](LICENSE).
