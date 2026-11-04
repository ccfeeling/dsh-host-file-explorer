<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · **Français** · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# Explorateur de fichiers DSH Host

### Un plugin DeepSeek Harness qui ajoute une entrée dans la barre latérale gauche pour parcourir le système de fichiers de la machine sur laquelle le Harness s'exécute.

[![Licence MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Entrée de barre latérale](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#fonctionnalités)
[![transport](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#architecture)

</div>

---

Parcourez le système de fichiers de la machine Host depuis le Harness : listes de répertoires avec types, tailles et dates de modification, aperçus de fichiers texte et création de dossiers. Chaque lecture passe par le canal Remote Host/Client, la même frontière que celle qu'utilisent les outils de système de fichiers de l'agent lui-même. Les fichiers peuvent être téléchargés dans le navigateur, et les images sont prévisualisées directement.

![Panneau des fichiers de l’hôte](assets/screenshot-1.png)

## Fonctionnalités

| Fonctionnalité | Description |
| --- | --- |
| Téléchargement | Confie le fichier au navigateur par la route de fichiers authentifiée du Harness, sous son propre nom |
| Aperçu des images | Affiche en ligne une image PNG, JPEG, GIF, WebP, AVIF ou SVG, au lieu de la lire comme du texte |
| Liste des répertoires | Les répertoires d'abord, puis les fichiers, chacun avec sa taille et sa date de modification ; les entrées cachées sont grisées |
| Navigation par chemin | Accédez à un chemin absolu, remontez au parent, ou utilisez les raccourcis pour HOME, tmp, cwd et la racine du système de fichiers |
| Aperçu de fichier | Lit les 256 premiers KiB d'un fichier texte et l'affiche ; les fichiers binaires signalent leur nature au lieu d'afficher du bruit |
| Création de dossier | Crée un sous-répertoire à un seul niveau dans le répertoire courant |
| Interface bilingue | Chaque chaîne visible passe par `ctx.locale`, si bien que le panneau suit la langue de l'interface |

## Installation

### Avec le gestionnaire de plugins (recommandé)

Clonez ce dépôt, puis installez-le depuis le gestionnaire de plugins du Harness :

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

L'appel d'outil correspondant est `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Depuis la place de marché

Le plugin figure dans la liste [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) : la place de marché peut donc l’installer directement depuis GitHub :

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### Comme dépendance d'un profil

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Après l'installation, une **icône de dossier** apparaît dans la barre latérale, après Plugins et Schedules. Cliquez dessus pour ouvrir le panneau.

> **Note** : si votre profil possède une dépendance qui embarque des agent skills (par exemple `dsh-answer-me-with-html`), pnpm 10.11+ et 12.x refusent l'installation tant que le répertoire des skills n'est pas déclaré, et échouent avec `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Désactivez la liaison de skills propre à pnpm avec une seule strophe dans le `pnpm-workspace.yaml` du profil :
>
> ```yaml
> skills:
>   dirs: []
> ```

## Architecture

Le plugin est un bundle DSH standard avec une moitié Host et une moitié Client :

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

La **moitié Host** fournit un service `ctx.hostFiles` et marque ses verbes pour le transport Remote avec le marqueur de prototype `@deepseek-ai/dsh-typert-protocol/remote-methods`, afin que la passerelle puisse le découvrir en mode SRC :

| Méthode | Paramètres | Retour |
| --- | --- | --- |
| `roots()` | — | Emplacements connus (HOME, tmp, cwd, racine du système de fichiers) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | Le plus grand fichier qu'un téléchargement peut transporter |

`signal` doit être le dernier paramètre : la passerelle analyse la signature de la méthode avec `Function.prototype.toString()` pour en déduire les paramètres transmis, et une signature incorrecte fait échouer l'appel.

### Comment les fichiers parviennent au navigateur

La page ne transporte jamais d'octets de fichier par le canal Remote. Elle demande à l'Host l'adresse du fichier sur la route de fichiers authentifiée du Harness lui-même — celle que l'aperçu de documents livré utilise pour les images d'un document Markdown — et le navigateur la récupère avec la session que la page possède déjà. Un téléchargement garde donc le nom du fichier, et un aperçu reçoit le type de contenu réel : un PNG s'affiche en PNG.

Une réponse est bornée par la limite d'octets des pièces jointes du Harness (20 Mio par défaut). La page lit cette valeur chez l'Host et refuse un téléchargement trop volumineux en l'expliquant, au lieu de lancer un transfert qui échouerait.

La **moitié Client** écrit à la main une contribution Remote Typert, la monte avec `ctx.remote.$mount(...)`, puis enregistre deux slots :

- `sidebar.panellist` : id `host-files`, ordre `30`, avec sa propre icône de dossier ;
- `main` : key `host-files`, le panneau que le bouton de la barre latérale ouvre.

### Deux pièges à connaître

1. **L'espace de noms ne peut pas être déclaré comme l'inject du plugin lui-même.** Le `remote.hostFiles` monté est un service à part entière, et il n'apparaît qu'après l'exécution du montage de ce plugin — une fiber qui l'attend ne se réveillerait jamais, donc le plugin ne démarrerait jamais. Lisez-le plutôt avec `ctx.get('remote.hostFiles')`, le point d'entrée du mixin Cordis qui lit un service directement depuis le store partagé :

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Les plugins publiés ne peuvent écrire `inject: ['remote.agentPresets']` que parce qu'un autre package monte ces espaces de noms, ce qui laisse un consommateur libre de déclarer la dépendance.

2. **La moitié Client ne dépend d'aucun package client du Harness.** Ce plugin utilise uniquement `react` et `zod`, se stylise avec les jetons de thème `--dsw-alias-*`, et n'importe rien de `@deepseek-ai/dsh-client-ui-primitives` ni de ses frères.

## Permissions et limites

- Le plugin lit le système de fichiers de la machine Host avec les **privilèges du processus Harness lui-même** : il peut lire tout ce que le compte qui l'exécute peut lire. C'est inhérent à ce qu'est un explorateur de fichiers Host, donc ne l'activez que sur les machines et les comptes de confiance.
- Le plugin est **en lecture seule, plus la création de dossiers**. Il ne peut pas écrire de fichiers, supprimer, renommer ni modifier les permissions.
- Un listage renvoie au plus 2000 entrées, et un aperçu lit au plus 256 KiB.
- Un téléchargement transporte au plus la limite d'octets des pièces jointes du Harness (20 Mio par défaut) ; au-delà, le panneau explique d'abord pourquoi.

## Développement

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Pendant le développement local, le profil pointe vers le répertoire de travail avec `link:`, si bien qu'une modification est prise en compte après un rafraîchissement du navigateur (le module client est versionné par empreinte de contenu).

## Licence

MIT, voir [LICENSE](LICENSE).
