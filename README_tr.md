<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · **Türkçe** · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host Dosya Gezgini

### Harness'in çalıştığı makinede dosya sistemini gezebilmek için sol kenar çubuğuna bir giriş ekleyen DeepSeek Harness plugin'ı.

[![MIT lisansı](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![kenar çubuğu girişi](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#özellikler)
[![aktarım](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#mimari)

</div>

---

Harness'in içinden host makinesinin dosya sisteminde gezin: türleri, boyutları ve değiştirilme zamanlarıyla birlikte dizin listeleri, metin dosyası önizlemeleri ve klasör oluşturma. Her okuma, agent'ın kendi dosya sistemi araçlarının kullandığı sınır olan Host/Client Remote kanalından geçer.Dosyalar tarayıcıya indirilebilir, görseller satır içinde önizlenebilir.

![Host dosyaları paneli](assets/screenshot-1.png)

## Özellikler

| Özellik | Açıklama |
| --- | --- |
| Dosya indirme | Dosyayı, Harness'ın kimlik doğrulamalı dosya rotası üzerinden, kendi adıyla tarayıcıya verir |
| Görsel önizleme | PNG, JPEG, GIF, WebP, AVIF veya SVG görsellerini metin olarak okumadan satır içinde gösterir |
| Dizin listeleme | Önce dizinler, sonra dosyalar; her biri boyut ve değiştirilme zamanıyla birlikte; gizli girdiler soluk gösterilir |
| Yol gezinme | Mutlak bir yola atla, üst dizine git veya HOME, tmp, cwd ve dosya sistemi kökü için kısayolları kullan |
| Dosya önizleme | Bir metin dosyasının ilk 256 KiB'sini okur ve işler; ikili dosyalar gürültü yazdırmak yerine kendilerini bildirir |
| Klasör oluşturma | Geçerli dizin içinde tek parçalı bir alt dizin oluşturur |
| İki dilli arayüz | Görünür her metin `ctx.locale` üzerinden geçer, böylece panel arayüz dilini izler |

## Kurulum

### Plugin yöneticisi ile (önerilir)

Bu depoyu klonlayın, ardından Harness plugin yöneticisinden kurun:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

Buna karşılık gelen araç çağrısı `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Plugin pazarından

Bu eklenti [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) listesinde yer alıyor; pazar doğrudan GitHub üzerinden kurabilir:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### Bir profil bağımlılığı olarak

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Kurulumdan sonra kenar çubuğunda, Plugins ve Schedules öğelerinden sonra bir **klasör simgesi** görünür. Paneli açmak için simgeye tıklayın.

> **Not**: profiliniz agent becerileri sunan bir bağımlılığa sahipse (örneğin `dsh-answer-me-with-html`), pnpm 10.11+ ve 12.x, beceriler dizini tanımlanana kadar kurulumu reddeder ve `ERR_PNPM_NO_AGENT_SKILLS_DIR` hatasıyla başarısız olur. Profilin `pnpm-workspace.yaml` dosyasına tek bir stanza ekleyerek pnpm'nin kendi beceri bağlamasını kapatın:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Mimari

Plugin, bir Host yarısı ve bir Client yarısı olan standart bir DSH bundle'ıdır:

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Host yarısı**, `ctx.hostFiles` servisini sağlar ve verb'lerini Remote aktarımı için, prototip işareti `@deepseek-ai/dsh-typert-protocol/remote-methods` ile işaretler; böylece gateway bunu SRC modunda keşfedebilir:

| Metot | Parametreler | Dönüş değerleri |
| --- | --- | --- |
| `roots()` | — | Bilinen konumlar (HOME, tmp, cwd, dosya sistemi kökü) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | Tek bir indirmenin taşıyabileceği en büyük dosya |

`signal` son parametre olmak zorunda: gateway, wire parametrelerini türetmek için metot imzasını `Function.prototype.toString()` ile ayrıştırır ve bozuk bir imza, çağrının başarısız olmasına neden olur.

### Dosyalar tarayıcıya nasıl ulaşır

Sayfa dosya baytlarını hiçbir zaman Remote kanalı üzerinden taşımaz. Dosyanın Harness'ın kendi kimlik doğrulamalı dosya rotasındaki adresini Host'tan sorar; gönderilmiş belge önizlemesinin Markdown içindeki görseller için kullandığı rota da budur. Tarayıcı dosyayı sayfanın zaten sahip olduğu oturumla çeker. Böylece indirme dosyanın kendi adını korur, önizleme ise dosyanın kendi içerik türünü alır; bir PNG PNG olarak çizilir.

Tek bir yanıt, Harness'ın ek bayt sınırıyla sınırlıdır (varsayılan 20 MiB). Sayfa bu sayıyı Host'tan okur ve sınırı aşan bir indirmeyi, başarısız olacak bir aktarımı başlatmak yerine açıklamayla reddeder.

**Client yarısı**, bir Typert Remote katkısını elle yazar, `ctx.remote.$mount(...)` ile mount eder ve ardından iki slot kaydeder:

- `sidebar.panellist`: id `host-files`, order `30`, kendi klasör simgesiyle;
- `main`: key `host-files`, kenar çubuğu düğmesinin açtığı panel.

### Bilinmesi gereken iki tuzak

1. **Namespace, plugin'ın kendi inject'i olarak tanımlanamaz.** Mount edilen `remote.hostFiles` kendi başına bir servistir ve yalnızca bu plugin'ın mount'u çalıştıktan sonra ortaya çıkar — onu bekleyen bir fiber asla uyanmaz, dolayısıyla plugin asla başlamaz. Bunun yerine, paylaşılan store'dan doğrudan bir servis okuyan Cordis mixin giriş noktası olan `ctx.get('remote.hostFiles')` ile okuyun:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Dağıtılan plugin'lar `inject: ['remote.agentPresets']` yazabilir, çünkü o namespace'leri başka bir paket mount eder; bu da bir tüketicinin bağımlılığı kendi isteğiyle tanımlamasına izin verir.

2. **Client yarısı hiçbir Harness client paketine bağımlı değildir.** Bu plugin yalnızca `react` ve `zod` kullanır, stilini `--dsw-alias-*` tema token'larıyla belirler ve `@deepseek-ai/dsh-client-ui-primitives` ya da kardeşlerinden hiçbir şey içe aktarmaz.

## İzinler ve sınırlar

- Plugin, host dosya sistemini **Harness sürecinin kendi ayrıcalıklarıyla** okur: onu çalıştıran hesabın okuyabildiği her şeyi okuyabilir. Bu, bir host dosya gezgininin doğasında yer alan bir durumdur; bu yüzden yalnızca güvendiğiniz makinelerde ve hesaplarda etkinleştirin.
- Plugin **salt okunurdur ve klasör oluşturma yeteneğine sahiptir**. Dosya yazamaz, silemez, yeniden adlandıramaz veya izinleri değiştiremez.
- Tek bir liste en fazla 2000 girdi döndürür ve tek bir önizleme en fazla 256 KiB okur.
- Tek bir indirme en fazla Harness'ın ek bayt sınırını (varsayılan 20 MiB) taşır; sınır aşılırsa panel önce nedenini söyler.

## Geliştirme

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Yerel geliştirme sırasında profil, `link:` ile çalışma dizinini gösterir; bu nedenle bir düzenleme tarayıcı yenilendikten sonra geçerli olur (client modülü içerik karmaşıyla sürümlenir).

## Lisans

MIT, bkz. [LICENSE](LICENSE).
