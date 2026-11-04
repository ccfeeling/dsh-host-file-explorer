/**
 * Browser half of the host file-explorer bundle.
 *
 * The page opens from a left-sidebar entry and shows the machine's filesystem:
 * a directory listing with the entries' kinds and sizes, a preview pane for
 * text files, and one action that creates a directory. Every read crosses the
 * Host/Client Remote boundary through the namespace this half mounts, so the
 * page never touches the filesystem itself.
 *
 * The module contributes two slot entries: the sidebar button that opens the
 * panel, and the panel itself. Both are named by one panel id, which is how
 * the sidebar knows which main panel a button opens.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-host-file-explorer',
  factory(require) {
    const React = require('react');
    const z = require('zod');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    /** The locale namespace this half's dictionary registers under. */
    const NS = 'hostFileExplorer';

    /** The panel id: the sidebar button and the main panel share it. */
    const PANEL_ID = 'host-files';

    /** The Remote namespace the Host half exposes. */
    const NAMESPACE = 'hostFiles';

    /**
     * The Cordis service key of that namespace.
     *
     * The mounted namespace is a service of its own, and the plugin that mounts
     * it cannot declare it as an inject: the service appears only after this
     * plugin's mount has run, so a fiber waiting for it would never wake up.
     * `ctx.get` reads a service straight from the shared store instead.
     */
    const NAMESPACE_KEY = `remote.${NAMESPACE}`;

    /** The strings the page shows, in English. */
    const en = {
      'panel': 'Files',
      'page.title': 'Host files',
      'page.intro': 'Browse the filesystem of the machine running this Harness.',
      'action.home': 'Home',
      'action.up': 'Up',
      'action.refresh': 'Refresh',
      'action.go': 'Open',
      'action.newFolder': 'New folder',
      'action.create': 'Create',
      'action.cancel': 'Cancel',
      'action.download': 'Download',
      'label.path': 'Path',
      'label.name': 'Name',
      'label.kind': 'Kind',
      'label.size': 'Size',
      'label.modified': 'Modified',
      'label.folderName': 'Folder name',
      'label.preview': 'Preview',
      'label.noPreview': 'Select a file to preview its contents.',
      'label.binary': 'This file is not text; no preview is available.',
      'label.truncated': 'Only the first part of this file is shown.',
      'label.imageFailed': 'This image could not be displayed.',
      'label.tooLarge': 'This file is larger than one download may carry.',
      'state.loading': 'Reading the directory…',
      'state.empty': 'This directory is empty.',
      'state.truncated': 'This directory holds more entries than are listed.',
      'error.title': 'The directory could not be read.',
      'error.create': 'The directory could not be created.',
    };

    /** The strings the page shows, in Simplified Chinese. */
    const zh = {
      'panel': '文件',
      'page.title': '宿主机文件',
      'page.intro': '浏览运行本 Harness 的机器上的文件系统。',
      'action.home': '主目录',
      'action.up': '上一级',
      'action.refresh': '刷新',
      'action.go': '打开',
      'action.newFolder': '新建文件夹',
      'action.create': '创建',
      'action.cancel': '取消',
      'action.download': '下载',
      'label.path': '路径',
      'label.name': '名称',
      'label.kind': '类型',
      'label.size': '大小',
      'label.modified': '修改时间',
      'label.folderName': '文件夹名称',
      'label.preview': '预览',
      'label.noPreview': '选择一个文件以预览其内容。',
      'label.binary': '该文件不是文本，无法预览。',
      'label.truncated': '仅显示了该文件的前一部分内容。',
      'label.imageFailed': '无法显示该图片。',
      'label.tooLarge': '该文件超过单次下载的大小上限。',
      'state.loading': '正在读取目录…',
      'state.empty': '该目录为空。',
      'state.truncated': '该目录的条目多于已列出的数量。',
      'error.title': '无法读取该目录。',
      'error.create': '无法创建该目录。',
    };

    /** One entry of a directory listing. */
    const entrySchema = z.object({
      name: z.string(),
      path: z.string(),
      kind: z.enum(['file', 'directory', 'other']),
      size: z.number().optional(),
      modified: z.number().optional(),
      mime: z.string().optional(),
      hidden: z.boolean(),
    });

    /** The result of one directory listing. */
    const listingSchema = z.object({
      path: z.string(),
      parent: z.string().nullable(),
      home: z.string(),
      entries: z.array(entrySchema),
      truncated: z.boolean(),
    });

    /**
     * The Remote contribution this half mounts: the Host service's verbs, with
     * the wire fields their arguments travel under.
     */
    const REMOTE = {
      package: '@local/dsh-host-file-explorer',
      descriptors: [
        {
          id: '@local/dsh-host-file-explorer#hostFiles/roots',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'roots',
          invocation: { kind: 'direct' },
          parameters: [],
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/roots:result',
            create: () => z.array(z.string()),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/list',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'list',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/list:path',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/list:result',
            create: () => listingSchema,
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/stat',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'stat',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/stat:path',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/stat:result',
            create: () => z.object({
              path: z.string(),
              kind: z.enum(['file', 'directory', 'other']),
              size: z.number().optional(),
              modified: z.number().optional(),
              mime: z.string().optional(),
            }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/read',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'read',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/read:path',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/read:result',
            create: () => z.object({
              path: z.string(),
              size: z.number(),
              modified: z.number().optional(),
              binary: z.boolean(),
              truncated: z.boolean(),
              text: z.string(),
            }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/mkdir',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'mkdir',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/mkdir:path',
                create: () => z.string(),
              },
            },
            {
              name: 'name',
              wire: 'name',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/mkdir:name',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/mkdir:result',
            create: () => z.object({ path: z.string() }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/limits',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'limits',
          invocation: { kind: 'direct' },
          parameters: [],
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/limits:result',
            create: () => z.object({ maxBytes: z.number() }),
          },
        },
      ],
    };

    /** One byte count, in the unit a reader expects. */
    function formatBytes(size) {
      if (typeof size !== 'number' || !Number.isFinite(size)) return '';
      if (size < 1024) return `${size} B`;
      const units = ['KiB', 'MiB', 'GiB', 'TiB'];
      let value = size / 1024;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
    }

    /** One modification time, in the reader's own locale. */
    function formatTime(modified) {
      if (typeof modified !== 'number' || !Number.isFinite(modified)) return '';
      return new Date(modified).toLocaleString();
    }

    /**
     * The address one host file is served under.
     *
     * The Harness serves host files to the page over its own authenticated
     * file route, so the browser may fetch the bytes with the same session the
     * page already holds. The route answers with the file's own content type,
     * which is what lets an image be shown and a download keep its name.
     *
     * @param path - the absolute host path.
     * @returns the file's URL, or undefined when the page has no address base.
     */
    function fileUrl(path) {
      if (typeof document === 'undefined') return undefined;
      const base = document.baseURI;
      if (typeof base !== 'string' || base.length === 0) return undefined;
      return new URL(`api/file?path=${encodeURIComponent(path)}`, base).href;
    }

    /**
     * Whether one file can be shown as an image.
     *
     * @param mime - the content type the host reported.
     * @returns true when the browser may render the file inline.
     */
    function isImage(mime) {
      return typeof mime === 'string' && mime.startsWith('image/');
    }

    /** The sidebar's button glyph: a folder, filled while its panel is open. */
    function FileExplorerIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18;
      const fill = props.active === true
        ? 'var(--dsw-alias-brand-primary)'
        : 'var(--dsw-alias-label-secondary)';
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      }, h('path', {
        d: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2c.4 0 .78.16 1.06.44L11.5 7.2h8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z',
        fill,
      }));
    }

    /** The panel: the directory listing beside the preview of one file. */
    function FileExplorerPage(props) {
      const t = props.t;
      const api = props.api;
      const [directory, setDirectory] = useState('');
      const [input, setInput] = useState('');
      const [listing, setListing] = useState(null);
      const [status, setStatus] = useState('loading');
      const [error, setError] = useState('');
      const [roots, setRoots] = useState([]);
      const [selected, setSelected] = useState(null);
      const [preview, setPreview] = useState(null);
      const [previewStatus, setPreviewStatus] = useState('idle');
      const [folderName, setFolderName] = useState('');
      const [creating, setCreating] = useState(false);
      const [createError, setCreateError] = useState('');
      const [revision, setRevision] = useState(0);
      const [maxBytes, setMaxBytes] = useState(null);
      const [imageFailed, setImageFailed] = useState(false);
      const listingRequest = useRef(0);
      const previewRequest = useRef(0);

      useEffect(() => {
        let cancelled = false;
        api.roots().then((paths) => {
          if (!cancelled) setRoots(paths);
        }).catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [api]);

      useEffect(() => {
        let cancelled = false;
        api.limits().then((result) => {
          if (!cancelled) setMaxBytes(result.maxBytes);
        }).catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [api]);

      useEffect(() => {
        const request = ++listingRequest.current;
        setStatus('loading');
        setError('');
        api.list(directory).then((result) => {
          if (request !== listingRequest.current) return;
          setListing(result);
          setInput(result.path);
          setStatus('ready');
        }).catch((cause) => {
          if (request !== listingRequest.current) return;
          setListing(null);
          setStatus('error');
          setError(cause?.message ?? String(cause));
        });
      }, [api, directory, revision]);

      const open = useCallback((path) => {
        setDirectory(path);
        setSelected(null);
        setPreview(null);
        setPreviewStatus('idle');
      }, []);

      const refresh = useCallback(() => {
        setRevision((value) => value + 1);
      }, []);

      const select = useCallback((entry) => {
        setSelected(entry);
        setPreview(null);
        setImageFailed(false);
        if (entry.kind !== 'file') {
          setPreviewStatus('idle');
          return;
        }
        const request = ++previewRequest.current;
        if (isImage(entry.mime)) {
          setPreviewStatus('image');
          return;
        }
        setPreviewStatus('loading');
        api.read(entry.path).then((result) => {
          if (request !== previewRequest.current) return;
          setPreview(result);
          setPreviewStatus('ready');
        }).catch((cause) => {
          if (request !== previewRequest.current) return;
          setPreview(null);
          setPreviewStatus('error');
          setError(cause?.message ?? String(cause));
        });
      }, [api]);

      const createFolder = useCallback(() => {
        const name = folderName.trim();
        if (name === '') return;
        setCreating(true);
        setCreateError('');
        api.mkdir(directory, name).then(() => {
          setFolderName('');
          setCreating(false);
          refresh();
        }).catch((cause) => {
          setCreating(false);
          setCreateError(cause?.message ?? String(cause));
        });
      }, [api, directory, folderName, refresh]);

      /**
       * Hand one file to the browser as a download.
       *
       * The bytes travel over the Harness's own authenticated file route, so
       * the browser saves them under the name the listing shows.
       */
      const download = useCallback((entry) => {
        const url = fileUrl(entry.path);
        if (url === undefined) return;
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = entry.name;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }, []);

      /** Whether one file is larger than a single download may carry. */
      const tooLarge = useCallback((entry) => {
        if (maxBytes === null || typeof entry.size !== 'number') return false;
        return entry.size > maxBytes;
      }, [maxBytes]);

      const current = listing?.path ?? directory;
      const rows = listing?.entries ?? [];

      const toolbar = h('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
      },
        h('input', {
          type: 'text',
          value: input,
          'aria-label': t('label.path'),
          placeholder: t('label.path'),
          onChange: (event) => setInput(event.target.value),
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            open(input);
          },
          style: {
            flex: '1 1 260px',
            minWidth: 0,
            padding: '6px 10px',
            font: 'inherit',
            color: 'var(--dsw-alias-label-primary)',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 8,
          },
        }),
        h('button', { type: 'button', onClick: () => open(input), style: buttonStyle }, t('action.go')),
        h('button', {
          type: 'button',
          onClick: () => open(listing?.home ?? ''),
          style: buttonStyle,
        }, t('action.home')),
        h('button', {
          type: 'button',
          onClick: () => listing?.parent && open(listing.parent),
          disabled: !listing?.parent,
          style: buttonStyle,
        }, t('action.up')),
        h('button', { type: 'button', onClick: refresh, style: buttonStyle }, t('action.refresh')),
      );

      const quickPaths = useMemo(() => roots.map((path) => h('button', {
        key: path,
        type: 'button',
        onClick: () => open(path),
        title: path,
        style: {
          padding: '2px 8px',
          font: 'inherit',
          fontSize: 12,
          color: 'var(--dsw-alias-label-secondary)',
          background: 'transparent',
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 999,
          cursor: 'pointer',
          maxWidth: 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }, path)), [roots, open]);

      const header = h('header', {
        style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px 12px' },
      },
        h('h1', {
          style: { margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        }, t('page.title')),
        h('p', {
          style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' },
        }, t('page.intro')),
        toolbar,
        quickPaths.length > 0 ? h('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: 6 },
        }, quickPaths) : null,
      );

      const listBody = h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' },
      },
        status === 'loading'
          ? h('div', { style: noteStyle }, t('state.loading'))
          : null,
        status === 'error'
          ? h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } },
            `${t('error.title')} ${error}`)
          : null,
        status === 'ready' && rows.length === 0
          ? h('div', { style: noteStyle }, t('state.empty'))
          : null,
        rows.map((entry) => h('button', {
          key: entry.path,
          type: 'button',
          onClick: () => (entry.kind === 'directory' ? open(entry.path) : select(entry)),
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 90px 160px',
            gap: 12,
            alignItems: 'center',
            padding: '6px 8px',
            font: 'inherit',
            fontSize: 13,
            textAlign: 'left',
            color: 'var(--dsw-alias-label-primary)',
            background: selected?.path === entry.path
              ? 'var(--dsw-alias-bg-layer-2)'
              : 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            cursor: 'pointer',
          },
        },
          h('span', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: entry.hidden ? 'var(--dsw-alias-label-secondary)' : undefined,
            },
          },
            h('span', {
              'aria-hidden': true,
              style: { flex: 'none', width: 14, color: entry.kind === 'directory'
                ? 'var(--dsw-alias-brand-primary)'
                : 'var(--dsw-alias-label-secondary)' },
            }, entry.kind === 'directory' ? '📁' : entry.kind === 'file' ? '📄' : '•'),
            h('span', {
              style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            }, entry.name)),
          h('span', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', textAlign: 'right' },
          }, entry.kind === 'file' ? formatBytes(entry.size) : ''),
          h('span', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
          }, formatTime(entry.modified)),
        )),
        listing?.truncated
          ? h('div', { style: noteStyle }, t('state.truncated'))
          : null,
      );

      const previewPane = h('div', {
        style: {
          flex: '1 1 320px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 16,
          borderLeft: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-layer-1)',
          overflow: 'auto',
        },
      },
        h('h2', {
          style: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        }, t('label.preview')),
        selected === null
          ? h('div', { style: noteStyle }, t('label.noPreview'))
          : h('div', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' },
          }, selected.path),
        selected !== null && selected.kind === 'file'
          ? h('div', {
            style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
          },
            h('button', {
              type: 'button',
              onClick: () => download(selected),
              disabled: tooLarge(selected),
              style: buttonStyle,
            }, t('action.download')),
            tooLarge(selected)
              ? h('span', { style: { ...noteStyle, padding: 0 } }, `${t('label.tooLarge')} (${formatBytes(maxBytes)})`)
              : null)
          : null,
        previewStatus === 'loading'
          ? h('div', { style: noteStyle }, t('state.loading'))
          : null,
        previewStatus === 'error'
          ? h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } }, error)
          : null,
        previewStatus === 'image'
          ? h('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-start',
            },
          },
            h('img', {
              src: fileUrl(selected?.path ?? '') ?? '',
              alt: selected?.name ?? '',
              onError: () => setImageFailed(true),
              style: {
                maxWidth: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-layer-2)',
              },
            }),
            imageFailed
              ? h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } }, t('label.imageFailed'))
              : null)
          : null,
        preview?.binary
          ? h('div', { style: noteStyle }, t('label.binary'))
          : null,
        preview?.truncated
          ? h('div', { style: noteStyle }, t('label.truncated'))
          : null,
        preview && !preview.binary
          ? h('pre', {
            style: {
              margin: 0,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--dsw-alias-label-primary)',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l1)',
              borderRadius: 8,
            },
          }, preview.text)
          : null,
      );

      const createRow = h('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
      },
        h('input', {
          type: 'text',
          value: folderName,
          'aria-label': t('label.folderName'),
          placeholder: t('label.folderName'),
          onChange: (event) => setFolderName(event.target.value),
          style: {
            flex: '1 1 200px',
            minWidth: 0,
            padding: '6px 10px',
            font: 'inherit',
            fontSize: 13,
            color: 'var(--dsw-alias-label-primary)',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 8,
          },
        }),
        h('button', {
          type: 'button',
          onClick: createFolder,
          disabled: creating || folderName.trim() === '',
          style: buttonStyle,
        }, t('action.create')),
        h('button', {
          type: 'button',
          onClick: () => {
            setFolderName('');
            setCreateError('');
          },
          style: buttonStyle,
        }, t('action.cancel')),
        createError
          ? h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, createError)
          : null,
      );

      return h('section', {
        'aria-label': t('page.title'),
        'data-testid': 'host-file-explorer-page',
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          color: 'var(--dsw-alias-label-primary)',
          background: 'var(--dsw-alias-bg-base)',
        },
      },
        header,
        h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            padding: '0 20px 12px',
          },
        }, createRow),
        h('div', {
          style: {
            display: 'flex',
            flex: '1 1 auto',
            flexWrap: 'wrap',
            minHeight: 0,
            borderTop: '1px solid var(--dsw-alias-border-l1)',
          },
        },
          h('div', {
            style: { flex: '1 1 380px', minWidth: 0, padding: 12, overflow: 'auto' },
          }, listBody),
          previewPane,
        ),
        h('footer', {
          style: {
            padding: '8px 20px',
            fontSize: 12,
            color: 'var(--dsw-alias-label-secondary)',
            borderTop: '1px solid var(--dsw-alias-border-l1)',
            wordBreak: 'break-all',
          },
        }, current),
      );
    }

    /** The shared look of the page's plain buttons. */
    const buttonStyle = {
      padding: '6px 12px',
      font: 'inherit',
      fontSize: 13,
      color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-bg-layer-2)',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 8,
      cursor: 'pointer',
    };

    /** The shared look of the page's inline notes. */
    const noteStyle = {
      padding: '8px 4px',
      fontSize: 13,
      color: 'var(--dsw-alias-label-secondary)',
    };

    /** The Client services this half contributes through. */
    const inject = ['slots', 'locale', 'remote'];

    /**
     * Register the sidebar entry, the panel it opens, and the Remote namespace
     * the page reads the host through.
     *
     * @param ctx - the browser services used by these contributions.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'host-file-explorer: dictionaries');
      const t = ctx.locale.bind(NS);

      let release = null;
      let disposed = false;
      const ready = ctx.remote.$mount(REMOTE).then((dispose) => {
        if (disposed) dispose();
        else release = dispose;
      });

      const call = async (method, args) => {
        await ready;
        if (disposed) throw new Error('the host file service is not available');
        const namespace = ctx.get(NAMESPACE_KEY);
        if (namespace === undefined) throw new Error('the host file service is not available');
        const result = await namespace[method](...args);
        if (result?.ok !== true) throw new Error(result?.error?.message ?? 'the host file service failed');
        return result.value;
      };

      const api = {
        roots: () => call('roots', []),
        list: (path) => call('list', [path]),
        stat: (path) => call('stat', [path]),
        read: (path) => call('read', [path]),
        mkdir: (path, name) => call('mkdir', [path, name]),
        limits: () => call('limits', []),
      };

      ctx.effect(() => () => {
        disposed = true;
        release?.();
        release = null;
      }, 'host-file-explorer: remote namespace');

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        locale: NS,
        label: () => t('panel'),
      }, FileExplorerIcon));

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ api }),
      }, FileExplorerPage));
    }

    return { inject, apply };
  },
});
