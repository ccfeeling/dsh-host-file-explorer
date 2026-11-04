<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · **Українська** · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host Оглядач файлів

### Plugin для DeepSeek Harness, який додає пункт у лівій бічній панелі для перегляду файлової системи машини, на якій працює Harness.

[![Ліцензія MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Пункт у бічній панелі](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#функції)
[![Транспорт](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#архітектура)

</div>

---

Переглядайте файлову систему Host-машини просто з Harness: списки каталогів із типами, розмірами та часом зміни, попередження текстових файлів і створення папок. Кожне читання проходить через канал Host/Client Remote — ту саму межу, яку використовують власні файлові інструменти агента. Файли можна завантажити в браузер, а зображення переглядаються просто на місці.

## Функції

| Функція | Опис |
| --- | --- |
| Завантаження файлу | Передає файл браузеру через власний автентифікований файловий маршрут Harness, зберігаючи початкову назву |
| Перегляд зображення | Показує PNG, JPEG, GIF, WebP, AVIF або SVG просто на місці, замість читання їх як тексту |
| Список каталогів | Спершу каталоги, потім файли, кожен із розміром та часом зміни; приховані записи виділяються тьмяно |
| Навігація шляхами | Перейдіть до абсолютного шляху, до батьківського каталогу або скористайтеся переходами для HOME, tmp, cwd і кореня файлової системи |
| Попередження файлів | Читає перші 256 KiB текстового файлу та показує їх; бінарні файли повідомляють про себе замість друкування нерозбірного вмісту |
| Створення папки | Створює підкаталог з одним сегментом усередині поточного каталогу |
| Двомовний інтерфейс | Кожен видимий рядок проходить через `ctx.locale`, тому панель відповідає мові інтерфейсу |

## Встановлення

### За допомогою plugin-менеджера (рекомендовано)

Клонуйте цей репозиторій, а потім установіть його з plugin-менеджера Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

Відповідний виклик інструмента — `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Як залежність профілю

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Після встановлення в бічній панелі з'являється **піктограма папки** після Plugins і Schedules. Натисніть на неї, щоб відкрити панель.

> **Примітка**: якщо ваш профіль має залежність, яка постачає agent skills (наприклад `dsh-answer-me-with-html`), pnpm 10.11+ і 12.x відмовляються встановлювати, доки не буде оголошено каталог skills, і завершуються помилкою `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Вимкніть власне зв'язування skill з боку pnpm одним рядком у `pnpm-workspace.yaml` профілю:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Архітектура

Plugin є стандартним DSH bundle з половиною Host та половиною Client:

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Host-половина** надає сервіс `ctx.hostFiles` і позначає його методи для Remote-транспорту прототипним маркером `@deepseek-ai/dsh-typert-protocol/remote-methods`, щоб шлюз міг виявити його в режимі SRC:

| Метод | Параметри | Повертає |
| --- | --- | --- |
| `roots()` | — | Відомі місця (HOME, tmp, cwd, корінь файлової системи) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | Найбільший файл, який можна завантажити за один раз |

`signal` має бути останнім параметром: шлюз розбирає сигнатуру методу за допомогою `Function.prototype.toString()`, щоб вивести параметри, що передаються, і пошкоджена сигнатура робить виклик невдалими.

### Як файли потрапляють у браузер

Сторінка ніколи не переносить байти файлу через Remote-канал. Вона питає в Host адресу файлу на власному автентифікованому файловому маршруті Harness — саме тому, що використовує штатний переглядач документів для зображень усередині Markdown — а браузер забирає файл за сесією, яка в сторінки вже є. Завдяки цьому завантаження зберігає початкову назву файлу, а перегляд отримує справжній тип вмісту, тож PNG малюється як PNG.

Одна відповідь обмежена лімітом байтів вкладень Harness (типово 20 MiB). Сторінка читає це число в Host і відхиляє завелике завантаження з поясненням, а не починає передачу, яка все одно провалиться.

**Client-половина** вручну описує внесок Typert Remote, монтує його через `ctx.remote.$mount(...)`, а потім реєструє два слоти:

- `sidebar.panellist`: id `host-files`, order `30`, з власною піктограмою папки;
- `main`: key `host-files`, панель, яку відкриває кнопка в бічній панелі.

### Дві пастки, про які варто знати

1. **Простір імен не можна оголосити як власний inject plugin-а.** Змонтований `remote.hostFiles` є самостійним сервісом і з'являється лише після того, як виконано mount цього plugin-а — fiber, що чекає на нього, ніколи не прокинеться, тож plugin ніколи не запуститься. Читайте його за допомогою `ctx.get('remote.hostFiles')` — це точка входу mixin-у Cordis, яка читає сервіс прямо зі спільного сховища:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Постачальні plugin-и можуть писати `inject: ['remote.agentPresets']` лише тому, що ці простори імен монтує інший package, що залишає споживачеві свободу оголосити залежність.

2. **Client-половина не залежить від жодного Harness client package.** Цей plugin використовує лише `react` і `zod`, стилює себе токенами теми `--dsw-alias-*` і нічого не імпортує з `@deepseek-ai/dsh-client-ui-primitives` чи його сусідів.

## Дозволи та межі

- Plugin читає файлову систему Host із **правами самого процесу Harness**: він може прочитати все, що може прочитати обліковий запис, від імені якого він запущений. Це неминуча властивість host-оглядача файлів, тому вмикайте його лише на машинах і в облікових записах, яким довіряєте.
- Plugin є **лише для читання, плюс створення папок**. Він не може записувати файли, видаляти, перейменовувати чи змінювати дозволи.
- Один список повертає щонайбільше 2000 записів, а одне попередження читає щонайбільше 256 KiB.
- Одне завантаження переносить не більше за ліміт байтів вкладень Harness (типово 20 MiB); у разі перевищення панель спершу пояснює причину.

## Розробка

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Під час локальної розробки профіль вказує на робочий каталог через `link:`, тому зміна стає активною після оновлення браузера (client-модуль версіонується за хешем вмісту).

## Ліцензія

MIT, див. [LICENSE](LICENSE).
