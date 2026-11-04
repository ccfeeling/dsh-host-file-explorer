<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · **Italiano**

# DSH Host Esploratore di File

### Un plugin DeepSeek Harness che aggiunge una voce nella barra laterale sinistra per sfogliare il file system della macchina su cui è in esecuzione l'Harness.

[![Licenza MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Voce nella barra laterale](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#funzionalità)
[![Trasporto](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#architettura)

</div>

---

Sfoglia il file system della macchina host dall'interno dell'Harness: elenchi di directory con tipo, dimensione e data di modifica, anteprime dei file di testo e creazione di cartelle. Ogni lettura passa dal canale Remote Host/Client, lo stesso confine che usano gli strumenti del file system dell'agente stesso.

## Funzionalità

| Funzionalità | Descrizione |
| --- | --- |
| Elenco delle directory | Prima le directory, poi i file, ciascuno con dimensione e data di modifica; le voci nascoste sono attenuate |
| Navigazione nei percorsi | Salta a un percorso assoluto, sali alla directory superiore o usa le scorciatoie per HOME, tmp, cwd e la radice del file system |
| Anteprima dei file | Legge i primi 256 KiB di un file di testo e li visualizza; i file binari si dichiarano tali invece di stampare rumore |
| Creazione di cartelle | Crea una sottodirectory a un solo segmento dentro la directory corrente |
| UI bilingue | Ogni stringa visibile passa da `ctx.locale`, quindi il pannello segue la lingua dell'interfaccia |

## Installazione

### Con il gestore dei plugin (consigliato)

Clona questo repository, poi installalo dal gestore di plugin dell'Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

La chiamata corrispondente è `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Come dipendenza del profilo

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Dopo l'installazione compare una **icona di cartella** nella barra laterale, dopo Plugins e Schedules. Cliccala per aprire il pannello.

> **Nota**: se il tuo profilo ha una dipendenza che distribuisce agent skill (per esempio `dsh-answer-me-with-html`), pnpm 10.11+ e 12.x rifiutano di installare finché la directory delle skill non viene dichiarata, e falliscono con `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Disattiva il collegamento delle skill di pnpm con un'unica stanza nel `pnpm-workspace.yaml` del profilo:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Architettura

Il plugin è un bundle DSH standard con una metà Host e una metà Client:

```
index.js   (Host)    ctx.hostFiles  ——  five verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

La **metà Host** fornisce il servizio `ctx.hostFiles` e contrassegna i suoi verbi per il trasporto Remote con il marcatore di prototipo `@deepseek-ai/dsh-typert-protocol/remote-methods`, così il gateway può scoprirlo in modalità SRC:

| Metodo | Parametri | Restituisce |
| --- | --- | --- |
| `roots()` | — | Percorsi noti (HOME, tmp, cwd, radice del file system) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |

`signal` deve essere l'ultimo parametro: il gateway analizza la firma del metodo con `Function.prototype.toString()` per ricavare i parametri sul filo e una firma malformata fa fallire la chiamata.

La **metà Client** scrive a mano un contributo Typert Remote, lo monta con `ctx.remote.$mount(...)` e poi registra due slot:

- `sidebar.panellist`: id `host-files`, ordine `30`, con la propria icona di cartella;
- `main`: key `host-files`, il pannello che il pulsante nella barra laterale apre.

### Due trappole da conoscere

1. **Il namespace non può essere dichiarato come inject del plugin stesso.** Il `remote.hostFiles` montato è un servizio a sé stante e compare solo dopo che il montaggio di questo plugin è avvenuto — una fiber che lo attende non si risveglierebbe mai, quindi il plugin non partirebbe mai. Leggilo invece con `ctx.get('remote.hostFiles')`, il punto d'ingresso del mixin Cordis che legge un servizio direttamente dal magazzino condiviso:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   I plugin distribuiti possono scrivere `inject: ['remote.agentPresets']` solo perché un altro package monta quei namespace, il che lascia a un consumatore la libertà di dichiarare la dipendenza.

2. **La metà client non dipende da alcun package client dell'Harness.** Questo plugin usa solo `react` e `zod`, si stilizza con i token del tema `--dsw-alias-*` e non importa nulla da `@deepseek-ai/dsh-client-ui-primitives` o dai suoi fratelli.

## Permessi e confini

- Il plugin legge il file system dell'host con i **privilegi del processo Harness stesso**: può leggere tutto ciò che l'account che lo esegue è in grado di leggere. Questo è intrinseco a ciò che un esploratore di file dell'host è, quindi abilitalo solo su macchine e account di cui ti fidi.
- Il plugin è **in sola lettura più creazione di cartelle**. Non può scrivere file, eliminarli, rinominarli o cambiarne i permessi.
- Un elenco restituisce al massimo 2000 voci e un'anteprima legge al massimo 256 KiB.

## Sviluppo

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Durante lo sviluppo locale il profilo punta alla working directory con `link:`, quindi una modifica è attiva dopo un aggiornamento del browser (il modulo client è versionato in base all'hash del contenuto).

## Licenza

MIT, vedi [LICENSE](LICENSE).
