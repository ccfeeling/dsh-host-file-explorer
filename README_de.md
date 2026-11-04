<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · **Deutsch** · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host Dateiexplorer

### Ein DeepSeek Harness plugin, das einen Eintrag in der linken Seitenleiste hinzufügt, um das Dateisystem des Rechners zu durchsuchen, auf dem der Harness läuft.

[![MIT-Lizenz](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Eintrag in der Seitenleiste](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#funktionen)
[![Transport-Host/Client_Remote](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#architektur)

</div>

---

Durchsuchen Sie das Dateisystem des Host-Rechners direkt aus dem Harness heraus: Verzeichnislisten mit Arten, Größen und Änderungszeiten, Vorschauen von Textdateien und das Anlegen von Ordnern. Jeder Lesezugriff läuft über den Host/Client Remote-Kanal – dieselbe Grenze, die auch die eigenen Dateisystem-Tools des Agenten verwenden. Dateien lassen sich in den Browser herunterladen, Bilder werden direkt in der Leiste angezeigt.

## Funktionen

| Funktion | Beschreibung |
| --- | --- |
| Datei-Download | Übergibt die Datei über die authentifizierte Dateiroute des Harness an den Browser, unter ihrem eigenen Namen |
| Bildvorschau | Zeigt PNG, JPEG, GIF, WebP, AVIF oder SVG direkt an, statt sie als Text zu lesen |
| Verzeichnisliste | Verzeichnisse zuerst, dann Dateien, jede mit Größe und Änderungszeit; verborgene Einträge sind abgeblendet |
| Pfadnavigation | Springen Sie zu einem absoluten Pfad, wechseln Sie zum übergeordneten Verzeichnis oder nutzen Sie die Sprünge für HOME, tmp, cwd und das Wurzelverzeichnis des Dateisystems |
| Dateivorschau | Liest die ersten 256 KiB einer Textdatei und stellt sie dar; Binärdateien melden sich selbst, statt Unleserliches auszugeben |
| Ordneranlage | Erstellt ein einstufiges Unterverzeichnis im aktuellen Verzeichnis |
| Zweisprachige Oberfläche | Jede sichtbare Zeichenkette läuft durch `ctx.locale`, sodass das Panel der Oberflächensprache folgt |

## Installation

### Mit der plugin-Verwaltung (empfohlen)

Klonen Sie dieses Repository und installieren Sie es anschließend über die plugin-Verwaltung des Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

Der passende Tool-Aufruf lautet `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Aus dem Plugin-Markt

Das Plugin ist in der [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)-Liste eingetragen, der Markt kann es also direkt von GitHub installieren:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### Als Profil-Abhängigkeit

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Nach der Installation erscheint ein **Ordnersymbol** in der Seitenleiste, hinter Plugins und Schedules. Klicken Sie darauf, um das Panel zu öffnen.

> **Hinweis**: Wenn Ihr Profil eine Abhängigkeit hat, die agent skills mitbringt (zum Beispiel `dsh-answer-me-with-html`), verweigern pnpm 10.11+ und 12.x die Installation, solange das skills-Verzeichnis nicht deklariert ist, und scheitern mit `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Deaktivieren Sie die eigene Skill-Verknüpfung von pnpm mit einem Eintrag in der `pnpm-workspace.yaml` Ihres Profils:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Architektur

Das plugin ist ein Standard-DSH-Bundle mit einer Host-Hälfte und einer Client-Hälfte:

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

Die **Host-Hälfte** stellt einen `ctx.hostFiles`-Service bereit und markiert dessen Verben für den Remote-Transport mit der Prototyp-Markierung `@deepseek-ai/dsh-typert-protocol/remote-methods`, sodass das Gateway sie im SRC-Modus finden kann:

| Methode | Parameter | Rückgabe |
| --- | --- | --- |
| `roots()` | — | Bekannte Orte (HOME, tmp, cwd, Wurzelverzeichnis des Dateisystems) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | Die größte Datei, die ein Download tragen darf |

`signal` muss der letzte Parameter sein: Das Gateway parst die Methodensignatur mit `Function.prototype.toString()`, um die Wire-Parameter abzuleiten, und eine fehlerhafte Signatur lässt den Aufruf scheitern.

### Wie Dateien in den Browser gelangen

Die Seite transportiert Dateibytes nie über den Remote-Kanal. Sie fragt den Host nach der Adresse der Datei auf der eigenen authentifizierten Dateiroute des Harness — dieselbe, die die mitgelieferte Dokumentvorschau für Bilder in Markdown-Dokumenten nutzt — und der Browser lädt sie mit der Sitzung, die die Seite bereits hält. So behält ein Download den eigenen Dateinamen, und eine Vorschau erhält den eigentlichen Inhaltstyp: ein PNG wird als PNG gezeichnet.

Eine Antwort ist durch das Anhangs-Byte-Limit des Harness begrenzt (standardmäßig 20 MiB). Die Seite liest diese Zahl beim Host ab und lehnt einen zu großen Download mit einer Erklärung ab, statt eine Übertragung zu starten, die ohnehin scheitern würde.

Die **Client-Hälfte** schreibt einen Typert-Remote-Beitrag von Hand, bindet ihn mit `ctx.remote.$mount(...)` ein und registriert anschließend zwei Slots:

- `sidebar.panellist`: id `host-files`, Reihenfolge `30`, mit eigenem Ordnersymbol;
- `main`: key `host-files`, das Panel, das die Schaltfläche in der Seitenleiste öffnet.

### Zwei Fallstricke, die man kennen sollte

1. **Der Namespace lässt sich nicht als eigenes inject des plugins deklarieren.** Der eingebundene `remote.hostFiles` ist ein Service für sich genommen und erscheint erst, nachdem der Mount dieses plugins ausgeführt wurde – eine Fiber, die darauf wartet, würde nie aufwachen, sodass das plugin nie starten würde. Lesen Sie ihn stattdessen mit `ctx.get('remote.hostFiles')`, dem Einstiegspunkt des Cordis-Mixins, der einen Service direkt aus dem gemeinsamen Store liest:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Ausgelieferte plugins können `inject: ['remote.agentPresets']` nur deshalb angeben, weil ein anderes Paket diese Namespaces einbindet, was es einem Konsumenten freistellt, die Abhängigkeit zu deklarieren.

2. **Die Client-Hälfte hängt von keinem Harness-Client-Paket ab.** Dieses plugin verwendet nur `react` und `zod`, stylt sich mit `--dsw-alias-*`-Theme-Tokens und importiert nichts aus `@deepseek-ai/dsh-client-ui-primitives` oder dessen Geschwistern.

## Berechtigungen und Grenzen

- Das plugin liest das Dateisystem des Hosts mit den **Rechten des Harness-Prozesses selbst**: Es kann alles lesen, was das Konto, das ihn ausführt, lesen kann. Das liegt im Wesen eines Host-Dateiexplorers, aktivieren Sie ihn daher nur auf Rechnern und Konten, denen Sie vertrauen.
- Das plugin ist **nur lesend, ergänzt um das Anlegen von Ordnern**. Es kann keine Dateien schreiben, löschen, umbenennen oder deren Rechte ändern.
- Eine Liste liefert höchstens 2000 Einträge, und eine Vorschau liest höchstens 256 KiB.
- Ein Download trägt höchstens das Anhangs-Byte-Limit des Harness (standardmäßig 20 MiB); bei Überschreitung erklärt die Leiste zuerst den Grund.

## Entwicklung

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Während der lokalen Entwicklung verweist das Profil mit `link:` auf das Arbeitsverzeichnis, sodass eine Änderung nach einem Browser-Refresh live ist (das Client-Modul wird über einen Inhalts-Hash versioniert).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
