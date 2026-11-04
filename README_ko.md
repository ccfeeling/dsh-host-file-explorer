<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · **한국어** · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# DSH Host 파일 탐색기

### Harness가 실행 중인 컴퓨터의 파일 시스템 탐색을 위한 왼쪽 사이드바 항목을 추가하는 DeepSeek Harness plugin입니다.

[![MIT 라이선스](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![사이드바 항목](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#기능)
[![전송 방식](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#아키텍처)

</div>

---

Harness 안에서 호스트 컴퓨터의 파일 시스템을 탐색할 수 있습니다. 종류, 크기, 수정 시간이 표시되는 디렉터리 목록, 텍스트 파일 미리보기, 폴더 생성을 제공합니다. 모든 읽기 작업은 에이전트 자체의 파일 시스템 도구가 사용하는 것과 동일한 경계인 Host/Client Remote 채널을 거칩니다.파일은 브라우저로 다운로드할 수 있고, 이미지는 인라인으로 미리 볼 수 있습니다.

## 기능

| 기능 | 설명 |
| --- | --- |
| 파일 다운로드 | Harness가 제공하는 인증된 파일 경로를 통해 파일 이름을 그대로 브라우저로 넘긴다 |
| 이미지 미리 보기 | PNG, JPEG, GIF, WebP, AVIF, SVG 등의 이미지를 텍스트로 읽지 않고 인라인으로 보여준다 |
| 디렉터리 목록 | 디렉터리를 먼저, 그다음 파일을 나열하며 각 항목에 크기와 수정 시간을 함께 표시합니다. 숨김 항목은 흐리게 표시됩니다 |
| 경로 이동 | 절대 경로로 바로 이동하거나 상위 폴더로 이동할 수 있고, HOME, tmp, cwd, 파일 시스템 루트의 단축 경로를 사용할 수 있습니다 |
| 파일 미리보기 | 텍스트 파일의 처음 256 KiB를 읽어 렌더링합니다. 바이너리 파일은 잡음을 출력하는 대신 스스로를 알립니다 |
| 폴더 생성 | 현재 디렉터리 안의 단일 세그먼트 하위 디렉터리를 만듭니다 |
| 이중 언어 UI | 화면에 표시되는 모든 문자열은 `ctx.locale`을 거치므로 패널은 인터페이스 언어를 따릅니다 |

## 설치

### plugin 관리자 사용(권장)

이 저장소를 복제한 다음 Harness plugin 관리자에서 설치하세요:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

이에 대응하는 도구 호출은 `plugin_manager { action: 'install_bundle', target: '<local path>' }`입니다.

### 프로필 의존성으로 설치

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

설치 후에는 Plugins와 Schedules 다음 위치에 사이드바에 **폴더 아이콘**이 나타납니다. 이를 클릭하면 패널이 열립니다.

> **참고**: 프로필에 에이전트 스킬을 함께 제공하는 의존성(예: `dsh-answer-me-with-html`)이 있다면 pnpm 10.11+ 및 12.x는 스킬 디렉터리가 선언될 때까지 설치를 거부하며 `ERR_PNPM_NO_AGENT_SKILLS_DIR`로 실패합니다. 프로필의 `pnpm-workspace.yaml`에 단 한 구절만 추가하면 pnpm 자체의 스킬 연결을 끌 수 있습니다:
>
> ```yaml
> skills:
>   dirs: []
> ```

## 아키텍처

이 plugin은 Host 절반과 Client 절반으로 이루어진 표준 DSH bundle입니다:

```
index.js   (Host)    ctx.hostFiles  ——  six verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

**Host 절반**은 `ctx.hostFiles` 서비스를 제공하고, prototype 마커 `@deepseek-ai/dsh-typert-protocol/remote-methods`로 자신의 verb에 Remote 전송을 표시하여 게이트웨이가 SRC 모드에서 이를 찾을 수 있게 합니다:

| 메서드 | 매개변수 | 반환값 |
| --- | --- | --- |
| `roots()` | — | 잘 알려진 위치(HOME, tmp, cwd, 파일 시스템 루트) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `limits()` | — | 한 번의 다운로드가 담을 수 있는 최대 파일 크기 |

`signal`은 반드시 마지막 매개변수여야 합니다: 게이트웨이는 `Function.prototype.toString()`으로 메서드 시그니처를 파싱해 와이어 매개변수를 도출하며, 시그니처가 깨져 있으면 호출이 실패합니다.

### 파일이 브라우저에 닿는 방식

페이지는 파일의 바이트를 Remote 채널로 옮기지 않는다. Harness가 제공하는 인증된 파일 경로에서 그 파일의 주소를 Host에 물어보고, 브라우저는 페이지가 이미 가지고 있는 세션으로 가져온다. 바로 공식 문서 미리 보기가 Markdown 안의 이미지를 읽을 때 쓰는 경로다. 덕분에 다운로드는 파일 이름을 그대로 유지하고, 미리 보기는 파일 자체의 콘텐츠 형식을 받아 PNG는 PNG로 그려진다.

한 번의 응답은 Harness의 첨부 바이트 한도(기본 20 MiB)로 제한된다. 페이지는 이 숫자를 Host에서 읽어, 한도를 넘는 다운로드는 실패할 전송을 시작하는 대신 이유를 알려주며 거절한다.

**Client 절반**은 Typert Remote 기여를 직접 작성하고 `ctx.remote.$mount(...)`로 마운트한 다음, 두 개의 슬롯을 등록합니다:

- `sidebar.panellist`: id `host-files`, 순서 `30`, 자체 폴더 아이콘 포함;
- `main`: key `host-files`, 사이드바 버튼이 여는 패널.

### 알아 둘 만한 두 가지 함정

1. **네임스페이스를 plugin 자신의 inject로 선언할 수는 없습니다.** 마운트된 `remote.hostFiles`는 그 자체로 하나의 서비스이며, 이 plugin의 마운트가 실행된 뒤에야 나타나기 때문에 — 이를 기다리는 fiber는 영원히 깨어나지 않아 plugin이 시작되지 않습니다. 대신 공유 스토어에서 서비스를 직접 읽어 오는 Cordis mixin 진입점인 `ctx.get('remote.hostFiles')`로 읽으세요:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   배포된 plugin들이 `inject: ['remote.agentPresets']`라고 쓸 수 있는 것은 다른 패키지가 해당 네임스페이스를 마운트하기 때문이며, 덕분에 소비자가 의존성을 자유롭게 선언할 수 있습니다.

2. **client 절반은 어떤 Harness client 패키지에도 의존하지 않습니다.** 이 plugin은 `react`와 `zod`만 사용하고, `--dsw-alias-*` 테마 토큰으로 자체 스타일을 지정하며, `@deepseek-ai/dsh-client-ui-primitives`나 그 형제 패키지에서는 아무것도 가져오지 않습니다.

## 권한과 경계

- 이 plugin은 **Harness 프로세스 자체의 권한**으로 호스트 파일 시스템을 읽습니다: 즉, 실행 중인 계정이 읽을 수 있는 모든 내용을 읽을 수 있습니다. 이는 호스트 파일 탐색기 본연의 성질이므로 신뢰할 수 있는 컴퓨터와 계정에서만 활성화하세요.
- 이 plugin은 **읽기 전용에 더해 폴더 생성만** 할 수 있습니다. 파일 쓰기, 삭제, 이름 변경, 권한 변경은 할 수 없습니다.
- 한 번의 목록 조회로 최대 2000개의 항목이 반환되며, 한 번의 미리보기는 최대 256 KiB를 읽습니다.
- 한 번의 다운로드가 담는 크기는 Harness의 첨부 바이트 한도(기본 20 MiB)까지이며, 넘으면 패널이 먼저 이유를 알려준다.

## 개발

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

로컬 개발 중에는 프로필이 `link:`로 작업 디렉터리를 가리키므로, 브라우저를 새로 고치면 수정이 바로 반영됩니다(client 모듈은 콘텐츠 해시로 버전이 관리됩니다).

## 라이선스

MIT, [LICENSE](LICENSE)를 참고하세요.
