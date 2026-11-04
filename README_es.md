<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · **Español** · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# Explorador de archivos del Host de DSH

### Un plugin de DeepSeek Harness que añade una entrada en la barra lateral para explorar el sistema de archivos de la máquina en la que se ejecuta el Harness.

[![Licencia MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Entrada en la barra lateral](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#funcionalidades)
[![Transporte](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#arquitectura)

</div>

---

Explora el sistema de archivos de la máquina del host desde dentro del Harness: listados de directorios con tipos, tamaños y horas de modificación, vistas previas de archivos de texto y creación de carpetas. Cada lectura pasa por el canal Remote Host/Client, el mismo límite que usan las propias herramientas de sistema de archivos del agente. Los archivos se pueden descargar al navegador y las imágenes se previsualizan en línea. Los archivos también se pueden subir al directorio abierto.

![Panel de archivos del host](assets/screenshot-1.png)

## Funcionalidades

| Característica | Descripción |
| --- | --- |
| Descarga de archivos | Entrega el archivo al navegador por la ruta de archivos autenticada del propio Harness, con su nombre original |
| Vista previa de imágenes | Muestra en línea imágenes PNG, JPEG, GIF, WebP, AVIF o SVG, en lugar de leerlas como texto |
| Listado de directorios | Primero los directorios, luego los archivos, cada uno con su tamaño y hora de modificación; las entradas ocultas se muestran atenuadas |
| Navegación por rutas | Ve a una ruta absoluta, al directorio superior o usa los atajos para HOME, tmp, cwd y la raíz del sistema de archivos |
| Vista previa de archivos | Lee los primeros 256 KiB de un archivo de texto y lo representa; los archivos binarios se identifican en lugar de imprimir contenido ilegible |
| Creación de carpetas | Crea un subdirectorio de un solo segmento dentro del directorio actual |
| Interfaz multilingüe | Todo el texto visible pasa por `ctx.locale`; el panel incluye doce idiomas y sigue el idioma de la interfaz |
| Subir archivo | Envía un archivo del navegador al directorio abierto, en una llamada Remote que lleva los bytes |

## Instalación

### Con el gestor de plugins (recomendado)

Clona este repositorio y luego instálalo desde el gestor de plugins del Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

La llamada de herramienta equivalente es `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Desde el mercado de plugins

El plugin figura en la lista [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin), así que el mercado puede instalarlo directamente desde GitHub:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### Como dependencia de un perfil

```jsonc Un archivo subido recorre el canal Remote como cualquier otro comando: sus bytes viajan dentro de esa llamada, no por la ruta de archivos del navegador.
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Tras la instalación aparece un **icono de carpeta** en la barra lateral, después de Plugins y Schedules. Haz clic en él para abrir el panel.

> **Nota**: si tu perfil tiene una dependencia que incluye agent skills (por ejemplo `dsh-answer-me-with-html`), pnpm 10.11+ y 12.x se niegan a instalarla hasta que se declare el directorio de skills y fallan con `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Desactiva el enlace de skills propio de pnpm con una entrada en el `pnpm-workspace.yaml` del perfil:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Arquitectura

El plugin es un bundle de DSH estándar con una mitad Host y una mitad Client:

```
index.js   (Host)    ctx.hostFiles  ——  seven verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

La **mitad Host** proporciona un servicio `ctx.hostFiles` y marca sus verbos para el transporte Remote con el marcador de prototipo `@deepseek-ai/dsh-typert-protocol/remote-methods`, de modo que el gateway pueda descubrirlo en modo SRC:

| Método | Parámetros | Devuelve |
| --- | --- | --- |
| `roots()` | — | Ubicaciones conocidas (HOME, tmp, cwd, raíz del sistema de archivos) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `upload(path, name, data, signal)` | `path`, `name`, `data` | `{ path, size }` |
| `limits()` | — | El archivo más grande que puede transportar una descarga |

`signal` tiene que ser el último parámetro: el gateway analiza la firma del método con `Function.prototype.toString()` para derivar los parámetros del cable, y una firma rota hace fallar la llamada.

### Cómo llegan los archivos al navegador

La página nunca transporta bytes de archivo por el canal Remote. Pregunta al Host por la dirección del archivo en la ruta de archivos autenticada del propio Harness —la misma que usa la vista previa de documentos incluida para las imágenes dentro de un documento Markdown— y el navegador lo descarga con la sesión que la página ya tiene. Así, una descarga conserva el nombre original del archivo y una vista previa recibe el tipo de contenido real, de modo que un PNG se dibuja como PNG.

Una respuesta está limitada por el límite de bytes de adjuntos del Harness (20 MiB por defecto). La página lee ese número del Host y rechaza una descarga demasiado grande con una explicación, en lugar de iniciar una transferencia que fallaría.

La **mitad Client** escribe a mano una contribución Typert Remote, la monta con `ctx.remote.$mount(...)` y luego registra dos slots:

- `sidebar.panellist`: id `host-files`, order `30`, con su propio icono de carpeta;
- `main`: key `host-files`, el panel que abre el botón de la barra lateral.

### Dos trampas que conviene conocer

1. **El namespace no puede declararse como el propio inject del plugin.** El `remote.hostFiles` montado es un servicio por derecho propio y solo aparece después de que se haya ejecutado el montaje de este plugin: un fiber que lo esperara nunca despertaría, así que el plugin nunca arrancaría. Léelo con `ctx.get('remote.hostFiles')`, el punto de entrada mixin de Cordis que lee un servicio directamente del almacén compartido:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Los plugins incluidos pueden escribir `inject: ['remote.agentPresets']` solo porque otro paquete monta esos namespaces, lo que deja a un consumidor libre de declarar la dependencia.

2. **La mitad Client no depende de ningún paquete de cliente del Harness.** Este plugin solo usa `react` y `zod`, se estiliza con los tokens de tema `--dsw-alias-*` y no importa nada de `@deepseek-ai/dsh-client-ui-primitives` ni de sus hermanos.

## Permisos y límites

- El plugin lee el sistema de archivos del host con los **privilegios del propio proceso del Harness**: puede leer todo lo que la cuenta que lo ejecuta puede leer. Eso es inherente a lo que es un explorador de archivos del host, así que actívalo solo en máquinas y cuentas de confianza.
- El plugin es **de solo lectura, además de crear carpetas y subir archivos**. No modifica, borra ni renombra un archivo que ya existe, y una subida nunca reemplaza uno.
- Un listado devuelve como máximo 2000 entradas y una vista previa lee como máximo 256 KiB.
- Una descarga transporta como máximo el límite de bytes de adjuntos del Harness (20 MiB por defecto); si se supera, el panel lo explica antes de empezar.

## Desarrollo

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Durante el desarrollo local, el perfil apunta al directorio de trabajo con `link:`, así que una edición se aplica tras recargar el navegador (el módulo de cliente se versiona por hash de contenido).

## Licencia

MIT, consulta [LICENSE](LICENSE).
