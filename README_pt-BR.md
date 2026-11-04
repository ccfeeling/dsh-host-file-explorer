<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · **Português (Brasil)** · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host Explorador de Arquivos

### Um plugin do DeepSeek Harness que adiciona uma entrada na barra lateral para navegar pelo sistema de arquivos da máquina em que o Harness é executado.

[![Licença MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![entrada na barra lateral](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#recursos)
[![transporte](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#arquitetura)

</div>

---

Navegue pelo sistema de arquivos da máquina host de dentro do Harness: listagens de diretórios com tipos, tamanhos e horários de modificação, prévias de arquivos de texto e criação de pastas. Toda leitura passa pelo canal Remote Host/Client, o mesmo limite que as ferramentas de sistema de arquivos do próprio agente usam. Os arquivos podem ser baixados para o navegador e as imagens são pré-visualizadas na própria página.

![Painel de arquivos do host](assets/screenshot-1.png)

## Recursos

| Recurso | Descrição |
| --- | --- |
| Download de arquivo | Entrega o arquivo ao navegador pela rota de arquivos autenticada do próprio Harness, com o nome original |
| Pré-visualização de imagem | Mostra imagens PNG, JPEG, GIF, WebP, AVIF ou SVG na própria página, em vez de lê-las como texto |
| Listagem de diretórios | Diretórios primeiro, depois os arquivos, cada um com tamanho e horário de modificação; entradas ocultas ficam esmaecidas |
| Navegação por caminhos | Ir para um caminho absoluto, subir para o diretório pai ou usar os atalhos de HOME, tmp, cwd e da raiz do sistema de arquivos |
| Prévia de arquivo | Lê os primeiros 256 KiB de um arquivo de texto e os renderiza; arquivos binários se identificam em vez de imprimir ruído |
| Criação de pastas | Cria um subdiretório de um único segmento dentro do diretório atual |
| Interface bilíngue | Toda string visível passa por `ctx.locale`, então o painel acompanha o idioma da interface |

## Instalação

### Com o gerenciador de plugins (recomendado)

Clone este repositório e instale-o pelo gerenciador de plugins do Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

A chamada de ferramenta correspondente é `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### Do mercado de plugins

O plugin está na lista [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin), então o mercado pode instalá-lo direto do GitHub:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### Como dependência do perfil

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

Após a instalação, um **ícone de pasta** aparece na barra lateral, depois de Plugins e Schedules. Clique nele para abrir o painel.

> **Nota**: se o seu perfil tiver uma dependência que traz agent skills (por exemplo `dsh-answer-me-with-html`), o pnpm 10.11+ e o 12.x se recusam a instalar até que o diretório de skills seja declarado e falham com `ERR_PNPM_NO_AGENT_SKILLS_DIR`. Desative o skill linking do próprio pnpm com uma seção no `pnpm-workspace.yaml` do perfil:
>
> ```yaml
> skills:
>   dirs: []
> ```

## Arquitetura

O plugin é um bundle DSH padrão com uma metade Host e uma metade Client:

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

A **metade Host** fornece um serviço `ctx.hostFiles` e marca seus verbos para o transporte Remote com o marcador de protótipo `@deepseek-ai/dsh-typert-protocol/remote-methods`, para que o gateway possa descobri-lo no modo SRC:

| Método | Parâmetros | Retorno |
| --- | --- | --- |
| `roots()` | — | Locais conhecidos (HOME, tmp, cwd, raiz do sistema de arquivos) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | O maior arquivo que um download pode transportar |

`signal` precisa ser o último parâmetro: o gateway analisa a assinatura do método com `Function.prototype.toString()` para derivar os parâmetros do fio, e uma assinatura quebrada faz a chamada falhar.

### Como os arquivos chegam ao navegador

A página nunca transporta bytes de arquivo pelo canal Remote. Ela pergunta ao Host o endereço do arquivo na rota de arquivos autenticada do próprio Harness — a mesma que a pré-visualização de documentos usa para as imagens dentro de um documento Markdown — e o navegador o busca com a sessão que a página já tem. Assim, um download preserva o nome original do arquivo e uma pré-visualização recebe o tipo de conteúdo real, de modo que um PNG é desenhado como PNG.

Uma resposta é limitada pelo limite de bytes de anexos do Harness (20 MiB por padrão). A página lê esse número do Host e recusa um download grande demais com uma explicação, em vez de iniciar uma transferência que falharia.

A **metade Client** escreve à mão uma contribuição Remote do Typert, a monta com `ctx.remote.$mount(...)` e então registra dois slots:

- `sidebar.panellist`: id `host-files`, order `30`, com seu próprio ícone de pasta;
- `main`: key `host-files`, o painel que o botão da barra lateral abre.

### Duas armadilhas que vale conhecer

1. **O namespace não pode ser declarado como o próprio inject do plugin.** O `remote.hostFiles` montado é um serviço por si só e só aparece depois que o mount deste plugin é executado — uma fiber que esperasse por ele nunca acordaria, então o plugin nunca iniciaria. Leia-o com `ctx.get('remote.hostFiles')`, o ponto de entrada de mixin do Cordis que lê um serviço diretamente do repositório compartilhado:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   Plugins publicados podem escrever `inject: ['remote.agentPresets']` apenas porque outro pacote monta esses namespaces, o que deixa um consumidor livre para declarar a dependência.

2. **A metade Client não depende de nenhum pacote client do Harness.** Este plugin usa apenas `react` e `zod`, se estiliza com tokens de tema `--dsw-alias-*` e não importa nada de `@deepseek-ai/dsh-client-ui-primitives` nem de seus irmãos.

## Permissões e limites

- O plugin lê o sistema de arquivos do host com os **privilégios do próprio processo do Harness**: ele pode ler tudo o que a conta que o executa consegue ler. Isso é inerente ao que é um explorador de arquivos do host, portanto habilite-o apenas em máquinas e contas em que você confia.
- O plugin é **somente leitura, mais a criação de pastas**. Ele não pode gravar arquivos, excluir, renomear nem alterar permissões.
- Uma listagem retorna no máximo 2000 entradas, e uma prévia lê no máximo 256 KiB.
- Um download transporta no máximo o limite de bytes de anexos do Harness (20 MiB por padrão); ao ultrapassar, o painel explica o motivo antes.

## Desenvolvimento

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

Durante o desenvolvimento local o perfil aponta para o diretório de trabalho com `link:`, então uma alteração entra no ar depois de recarregar o navegador (o módulo client é versionado por hash de conteúdo).

## Licença

MIT, veja [LICENSE](LICENSE).
