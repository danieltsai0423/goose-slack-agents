import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectDir } from './config.mjs';

const appIdFormat = /^A[A-Z0-9]+$/;

export async function createSlackApps({ token, directory, request = fetch, print = console.log }) {
  if (!token) throw new Error('請在本機 .env.slack-setup 設定 SLACK_MANIFEST_TOKEN。');

  async function call(method, args) {
    const response = await request(`https://slack.com/api/apps.manifest.${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(15000),
      redirect: 'error'
    });
    const data = await response.json();
    if (response.ok && data.ok === true) return data;

    const code = /^[a-z0-9_]+$/i.test(data.error) ? data.error : `HTTP ${response.status}`;
    const error = new Error(`Slack ${method} 失敗（${code}）。`);
    error.rejectedBySlack = response.status < 500 && data.ok === false;
    throw error;
  }

  const apps = ['codex', 'claude'].map((id) => ({
    id,
    file: join(directory, `${id}.app`),
    manifest: JSON.stringify(JSON.parse(readFileSync(join(projectDir, 'slack', `${id}.json`), 'utf8')))
  }));
  for (const app of apps) {
    app.appId = existsSync(app.file) ? readFileSync(app.file, 'utf8').trim() : '';
    if (app.appId && !appIdFormat.test(app.appId)) {
      throw new Error(`${app.id} 的前一次建立結果待確認。先在 Slack App 管理頁核對，再更新 ${app.file}。`);
    }
  }

  // Check both manifests before creating either app.
  await Promise.all(apps.map((app) => app.appId
    ? call('export', { app_id: app.appId })
    : call('validate', { manifest: app.manifest })));
  mkdirSync(directory, { recursive: true });
  for (const app of apps) {
    if (!app.appId) {
      writeFileSync(app.file, 'pending\n', { flag: 'wx' });
      try {
        const result = await call('create', { manifest: app.manifest });
        if (!appIdFormat.test(result.app_id)) throw new Error('Slack 未回傳可辨識的 App ID。');
        app.appId = result.app_id;
        writeFileSync(app.file, `${app.appId}\n`);
      } catch (error) {
        if (error.rejectedBySlack) unlinkSync(app.file);
        else throw new Error(`${app.id} 的建立結果未知。請先在 https://api.slack.com/apps 查詢，避免建立重複 App。`);
        throw error;
      }
    }
    print(`Goose-${app.id === 'codex' ? 'Codex' : 'Claude'}  https://api.slack.com/apps/${app.appId}/oauth`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  createSlackApps({
    token: process.env.SLACK_MANIFEST_TOKEN?.trim(),
    directory: join(projectDir, '.data', 'slack-setup')
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
