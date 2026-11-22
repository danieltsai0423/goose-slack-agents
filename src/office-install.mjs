import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { getGooseBin, gooseVersion, officeClaudeBin, officeGooseBin, officeToolsDir } from './config.mjs';

const exec = promisify(execFile);
// Checksums of the CLI archives published with the Goose release.
const archives = {
  'win32-x64': ['x86_64-pc-windows-msvc.zip', '5b838ab498f7a6b121fab621b99d39a480458c373f16be7f7ce7869e9bc54888'],
  'darwin-arm64': ['aarch64-apple-darwin.tar.gz', '3a317d80997f40bba4c6bd9edbe9a3381e88badea7ff5064fe9d757512006511'],
  'darwin-x64': ['x86_64-apple-darwin.tar.gz', '82d9f11c2ee6d4021a05a9471c5112ebc67dc77519d77cce0cc12953affe3ed1'],
  'linux-arm64': ['aarch64-unknown-linux-gnu.tar.gz', '7e74d796e93b89df374715dc669149cb634f74d778de0b87bb7c031b5b093731'],
  'linux-x64': ['x86_64-unknown-linux-gnu.tar.gz', '5f6e463621a8428617ae4870eecee7a00a253e9bbfccb6340dfaa4f0ec2aaf32'],
  'linux-arm64-musl': ['aarch64-unknown-linux-musl.tar.gz', '7445e977a9465189000d92c227c906d55833a6892f5999aadc97f0c6b0d15604'],
  'linux-x64-musl': ['x86_64-unknown-linux-musl.tar.gz', '20844fb828b43090bdf1c6f5931028695922843884e4f01083175dbdba0bd99f'],
};

function platformKey() {
  const { platform, arch } = process;
  const musl = platform === 'linux' && !process.report.getReport().header.glibcVersionRuntime;
  return `${platform}-${arch}${musl ? '-musl' : ''}`;
}

async function installBinary(source, destination, signal) {
  if (process.platform !== 'win32') await chmod(source, 0o755);
  await exec(source, ['--version'], { signal, timeout: 15000, windowsHide: true });
  await mkdir(dirname(destination), { recursive: true });
  signal.throwIfAborted();
  await rename(source, destination);
}

async function downloadArchive(name, expectedHash, destination, signal) {
  const url = `https://github.com/aaif-goose/goose/releases/download/v${gooseVersion}/goose-${name}`;
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error('無法從官方發行頁下載 Goose CLI。請檢查網路後再試。');
  const hash = createHash('sha256');
  let bytes = 0;
  const checksum = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      if (bytes > 160 * 1024 * 1024) return done(new Error('下載檔案超過預期大小。'));
      hash.update(chunk);
      done(null, chunk);
    }
  });
  await pipeline(res.body, checksum, createWriteStream(destination, { flags: 'wx' }), { signal });
  if (hash.digest('hex') !== expectedHash) throw new Error('Goose CLI 下載檔案的校驗值不符。請重新下載。');
}

export async function ensureOfficeGoose({ signal, onInstall }) {
  try {
    await exec(getGooseBin(), ['--version'], { signal, timeout: 15000, windowsHide: true });
    return;
  } catch (error) {
    signal.throwIfAborted();
    if (error.code !== 'ENOENT' || process.env.GOOSE_BIN) {
      throw new Error('目前設定的 Goose CLI 無法啟動。請確認安裝或 GOOSE_BIN 的路徑。');
    }
  }
  const asset = archives[platformKey()];
  if (!asset) throw new Error('這個系統需要依官方指南安裝 Goose CLI。');
  onInstall();
  const installSignal = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
  await mkdir(officeToolsDir, { recursive: true });
  const staging = await mkdtemp(join(officeToolsDir, 'goose-download-'));
  try {
    const [name, checksum] = asset;
    const archive = join(staging, name);
    await downloadArchive(name, checksum, archive, installSignal);
    const useZip = process.platform === 'win32';
    try {
      await exec('tar', ['-xf', archive, '-C', staging], { signal: installSignal, windowsHide: true });
    } catch (error) {
      installSignal.throwIfAborted();
      if (error.code === 'ENOENT') throw new Error('找不到 tar。請安裝系統的解壓縮工具，或依官方指南安裝 Goose CLI。');
      throw new Error('無法解開官方 Goose CLI 發行檔。請再試一次。');
    }
    const source = join(staging, useZip ? 'goose-package/goose.exe' : 'goose');
    try {
      await installBinary(source, officeGooseBin, installSignal);
    } catch {
      installSignal.throwIfAborted();
      throw new Error('下載的 Goose CLI 無法在這個系統啟動。請使用官方安裝指南。');
    }
  } catch (error) {
    if (installSignal.aborted && !signal.aborted) throw new Error('下載或安裝 Goose CLI 逾時。請再試一次。');
    if (error.code || error instanceof TypeError) throw new Error('安裝 Goose CLI 失敗。請確認網路與本機目錄可寫入。');
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

export async function installOfficeClaude(sdk, signal) {
  const name = '@anthropic-ai/claude-agent-sdk-' + platformKey();
  const version = sdk.optionalDependencies?.[name];
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('這個系統需要依官方指南安裝 Claude Code。');
  await mkdir(officeToolsDir, { recursive: true });
  const staging = await mkdtemp(join(officeToolsDir, 'claude-download-'));
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
  try {
    const npmCli = process.env.npm_execpath ?? (process.platform === 'win32' ? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js') : null);
    await exec(npmCli ? process.execPath : 'npm', [
      ...(npmCli ? [npmCli] : []), 'install', '--no-save', '--no-audit', '--no-fund',
      '--ignore-scripts', '--registry=https://registry.npmjs.org', `${name}@${version}`
    ], { cwd: staging, signal: deadline, windowsHide: true });
    await installBinary(join(staging, 'node_modules', name, basename(officeClaudeBin)), officeClaudeBin, deadline);
  } catch {
    signal.throwIfAborted();
    if (deadline.aborted) throw new Error('下載或安裝 Claude Code 逾時。請再試一次。');
    throw new Error('無法安裝 Claude Code。請確認 npm 和網路可用，或使用手動登入。');
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}
