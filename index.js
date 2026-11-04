/**
 * Host half of the host file-explorer bundle.
 *
 * The service this file registers, `ctx.hostFiles`, answers the five questions
 * the browser page asks of the machine it runs on: which places are worth a
 * one-click jump, what one directory holds, what one file contains, what one
 * new directory was called, and where one uploaded file landed. Every method
 * crosses the same Host/Client Remote boundary the rest of the application
 * uses, so the page reads and writes the host exactly the way the agent's own
 * filesystem tools do.
 *
 * The Gateway learns which of these methods are remotely callable from the
 * marker the protocol package keeps on the service prototype. This file writes
 * that marker itself instead of importing the package, so the bundle installs
 * with no dependency of its own and the marker shape stays pinned to the
 * protocol version this Harness runs.
 */
import { mkdir as makeDirectory, open, readdir, stat as statPath, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';

/**
 * The slot `@deepseek-ai/dsh-typert-protocol` keeps the Remote markers on.
 * The Gateway reads this exact descriptor to learn that a Service method may
 * be called by a remote client; the descriptor's version is the protocol's.
 */
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods';

/** The Cordis service key, and the Remote namespace the Gateway exposes it under. */
const NAMESPACE = 'hostFiles';

/** The largest directory level one listing materializes. */
const MAX_ENTRIES = 2000;

/** The largest file prefix one preview reads. */
const MAX_PREVIEW_BYTES = 256 * 1024;

/**
 * The byte limit the browser's file route enforces, when no attachment
 * service states one.
 *
 * The route the page downloads through is served by the Harness itself, and
 * it bounds one response with the attachment image limit. The page learns the
 * real number from {@link HostFiles.limits} so it can refuse an oversized
 * download before the browser starts one.
 */
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * The content types the page tells images apart by.
 *
 * The browser's file route decides the served type by extension, so the page
 * reads the same table to know in advance which files can be shown as an
 * image. Anything unknown is served as a plain byte stream.
 */
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/plain',
  '.css': 'text/css',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/plain',
  '.csv': 'text/csv',
  '.log': 'text/plain',
  '.sh': 'text/x-shellscript',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/** The file kind a directory entry carries over the wire. */
const KIND_FILE = 'file';
const KIND_DIRECTORY = 'directory';
const KIND_OTHER = 'other';

/**
 * The content type one file name implies.
 *
 * @param name - the file name or path.
 * @returns the content type, or undefined when the extension is unknown.
 */
function mimeFor(name) {
  const extension = parse(String(name)).ext.toLowerCase();
  return MIME_TYPES[extension];
}

/**
 * The host filesystem service.
 *
 * Every method keeps the plain signature the Gateway reads from the source:
 * business parameters first, an optional `signal` last.
 */
class HostFiles {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * The places the page offers as one-click jumps.
   *
   * @returns the absolute paths worth jumping to.
   */
  async roots() {
    const seen = new Set();
    const paths = [];
    const add = (value) => {
      if (typeof value !== 'string' || value.length === 0) return;
      const absolute = resolve(value);
      if (seen.has(absolute)) return;
      seen.add(absolute);
      paths.push(absolute);
    };
    add(homedir());
    add(tmpdir());
    add(process.cwd());
    add(parse(process.cwd()).root);
    return paths;
  }

  /**
   * The direct children of one directory, with the metadata the page lists.
   *
   * @param path - the directory to list; absent or empty lists the home directory.
   * @param signal - caller lifetime.
   * @returns the directory's children, its parent, and whether the level was cut.
   */
  async list(path, signal) {
    const target = await this.resolveDirectory(path);
    const dirents = await readdir(target, { withFileTypes: true });
    const entries = [];
    let truncated = false;
    for (const dirent of dirents) {
      if (signal?.aborted === true) throw new Error('the listing was cancelled');
      if (entries.length >= MAX_ENTRIES) {
        truncated = true;
        break;
      }
      const child = join(target, dirent.name);
      let kind = KIND_OTHER;
      let size;
      let modified;
      try {
        const info = await statPath(child);
        kind = info.isDirectory() ? KIND_DIRECTORY : info.isFile() ? KIND_FILE : KIND_OTHER;
        size = info.size;
        modified = info.mtimeMs;
      } catch {
        kind = KIND_OTHER;
      }
      entries.push({
        name: dirent.name,
        path: child,
        kind,
        size,
        modified,
        mime: kind === KIND_FILE ? mimeFor(dirent.name) : undefined,
        hidden: dirent.name.startsWith('.'),
      });
    }
    entries.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === KIND_DIRECTORY ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    const parent = dirname(target);
    return {
      path: target,
      parent: parent === target ? null : parent,
      home: homedir(),
      entries,
      truncated,
    };
  }

  /**
   * The metadata of one path, without its contents.
   *
   * @param path - the file or directory to describe.
   * @param signal - caller lifetime.
   * @returns the path's kind, size, and modification time.
   */
  async stat(path, signal) {
    const target = this.resolve(path);
    if (signal?.aborted === true) throw new Error('the probe was cancelled');
    const info = await statPath(target);
    const kind = info.isDirectory() ? KIND_DIRECTORY : info.isFile() ? KIND_FILE : KIND_OTHER;
    return {
      path: target,
      kind,
      size: info.size,
      modified: info.mtimeMs,
      mime: kind === KIND_FILE ? mimeFor(parse(target).base) : undefined,
    };
  }

  /**
   * The limits the page has to respect when it hands a file to the browser.
   *
   * The browser downloads through the Harness's own file route, and that route
   * bounds one response. The attachment service owns the number; the page
   * reads it here so it can refuse an oversized file instead of starting a
   * download that would fail halfway.
   *
   * @returns the largest file one download may carry.
   */
  async limits() {
    const attachments = this.ctx.get('attachments');
    const stated = attachments?.imageLimits?.maxImageBytes;
    return { maxBytes: typeof stated === 'number' && stated > 0 ? stated : DEFAULT_MAX_BYTES };
  }

  /**
   * The leading bytes of one text file, decoded for the preview pane.
   *
   * @param path - the file to preview.
   * @param signal - caller lifetime.
   * @returns the decoded prefix, whether the file is binary, and whether it was cut.
   */
  async read(path, signal) {
    const target = this.resolve(path);
    const info = await statPath(target);
    if (!info.isFile()) throw new Error(`"${target}" is not a regular file`);
    if (signal?.aborted === true) throw new Error('the preview was cancelled');
    const handle = await open(target, 'r');
    try {
      const buffer = Buffer.alloc(MAX_PREVIEW_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, MAX_PREVIEW_BYTES, 0);
      const prefix = buffer.subarray(0, bytesRead);
      const binary = prefix.includes(0);
      return {
        path: target,
        size: info.size,
        modified: info.mtimeMs,
        binary,
        truncated: info.size > bytesRead,
        text: binary ? '' : new TextDecoder('utf-8').decode(prefix),
      };
    } finally {
      await handle.close();
    }
  }

  /**
   * Create one directory inside another.
   *
   * @param path - the parent directory.
   * @param name - the new directory's single path segment.
   * @param signal - caller lifetime.
   * @returns the created directory's absolute path.
   */
  async mkdir(path, name, signal) {
    const parent = await this.resolveDirectory(path);
    if (typeof name !== 'string' || name.trim() === '' || name === '.' || name === '..' || /[/\\]/.test(name)) {
      throw new Error(`"${String(name)}" is not a single path segment`);
    }
    if (signal?.aborted === true) throw new Error('the creation was cancelled');
    const target = join(parent, name);
    await makeDirectory(target);
    return { path: target };
  }

  /**
   * Write one file the browser handed over into a directory.
   *
   * The bytes travel as canonical base64 — the wire form the Harness's own
   * attachment endpoints admit — so one upload is one Remote call. The name
   * has to be a single path segment, which keeps the target inside the
   * directory the page is showing, and a file that already exists is never
   * replaced: the upload fails instead of overwriting what is there.
   *
   * @param path - the parent directory.
   * @param name - the new file's single path segment.
   * @param data - the file's bytes, canonical base64.
   * @param signal - caller lifetime.
   * @returns the written file's absolute path and its size in bytes.
   */
  async upload(path, name, data, signal) {
    const parent = await this.resolveDirectory(path);
    if (typeof name !== 'string' || name.trim() === '' || name === '.' || name === '..' || /[/\\]/.test(name)) {
      throw new Error(`"${String(name)}" is not a single path segment`);
    }
    if (typeof data !== 'string') throw new Error('the upload carries no data');
    const bytes = Buffer.from(data, 'base64');
    if (bytes.toString('base64') !== data) throw new Error('the upload is not canonical base64');
    const { maxBytes } = await this.limits();
    if (bytes.length > maxBytes) throw new Error(`the upload is larger than ${maxBytes} bytes`);
    if (signal?.aborted === true) throw new Error('the upload was cancelled');
    const target = join(parent, name);
    await writeFile(target, bytes, { flag: 'wx' });
    return { path: target, size: bytes.length };
  }

  /**
   * One absolute path: a relative one resolves against the process's directory.
   *
   * @param path - the path the caller named.
   * @returns the absolute path.
   */
  resolve(path) {
    if (typeof path !== 'string' || path.trim() === '') return resolve(homedir());
    return resolve(path);
  }

  /**
   * One absolute directory path; a file is not a directory to list.
   *
   * @param path - the directory the caller named.
   * @returns the absolute directory path.
   */
  async resolveDirectory(path) {
    const target = this.resolve(path);
    const info = await statPath(target);
    if (!info.isDirectory()) throw new Error(`"${target}" is not a directory`);
    return target;
  }
}

/**
 * Mark the service's methods as remotely callable.
 *
 * The descriptor is the one the protocol package writes for its own `@Remote`
 * decorator: the method names, and the fact that each is a direct invocation.
 */
Object.defineProperty(HostFiles.prototype, REMOTE_METHODS, {
  configurable: true,
  value: Object.freeze({
    version: 1,
    methods: Object.freeze(
      ['roots', 'list', 'stat', 'read', 'mkdir', 'upload', 'limits'].map((method) =>
        Object.freeze({ method, invocation: Object.freeze({ kind: 'direct' }) }),
      ),
    ),
  }),
});

/**
 * Register the host filesystem service and its Remote binding.
 *
 * @param ctx - the plugin's Host context.
 */
export function apply(ctx) {
  const service = new HostFiles(ctx);
  service.typertRemote = Object.freeze({ service, serviceKey: NAMESPACE, namespace: NAMESPACE });
  ctx.provide(NAMESPACE, service);
}
