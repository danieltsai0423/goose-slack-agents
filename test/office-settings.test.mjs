import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openOfficeSettings } from '../src/office-settings.mjs';

test('settings validate, save locally, override .env and fall back when cleared', () => {
  const dir = mkdtempSync(join(tmpdir(), 'office-settings-'));
  const file = join(dir, 'office-settings.json');
  const before = process.env.GOOSE_TURN_TIMEOUT_SECONDS;
  try {
    const settings = openOfficeSettings({ file });
    assert.throws(() => settings.save({ GOOSE_TURN_TIMEOUT_SECONDS: '5' }), /10 到 900/);
    assert.throws(() => settings.save({ OFFICE_ECONOMY_SYNC_SECONDS: '30' }), /0 或 60/);
    assert.throws(() => settings.save({ GOOSE_BIN: join(dir, 'missing.exe') }), /找不到/);
    assert.throws(() => settings.save({ GOOSE_WORK_DIR: file }), /找不到|資料夾/);
    assert.throws(() => settings.save({ GOOSE_CODEX_MODEL: 'gpt; rm -rf' }), /模型名稱/);
    assert.throws(() => settings.save({ SLACK_CODEX_BOT_TOKEN: 'xoxb-x' }), /未知/);

    const goose = join(dir, 'goose.exe');
    writeFileSync(goose, '');
    const saved = settings.save({ GOOSE_TURN_TIMEOUT_SECONDS: '240', GOOSE_BIN: goose, GOOSE_WORK_DIR: dir });
    assert.deepEqual(saved.changed.sort(), ['GOOSE_BIN', 'GOOSE_TURN_TIMEOUT_SECONDS', 'GOOSE_WORK_DIR']);
    assert.equal(saved.restart, true);
    assert.equal(process.env.GOOSE_TURN_TIMEOUT_SECONDS, '240');
    assert.equal(process.env.GOOSE_BIN, goose);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).values.GOOSE_TURN_TIMEOUT_SECONDS, '240');

    // A new process picks the saved values up again.
    const reopened = openOfficeSettings({ file }).snapshot().fields.find(field => field.key === 'GOOSE_BIN');
    assert.equal(reopened.saved, goose);
    assert.equal(reopened.exists, true);

    // Clearing a value falls back to what .env had.
    const cleared = settings.save({ GOOSE_TURN_TIMEOUT_SECONDS: '', GOOSE_BIN: '', GOOSE_WORK_DIR: '' });
    assert.equal(process.env.GOOSE_TURN_TIMEOUT_SECONDS, before);
    assert.equal(cleared.fields.find(field => field.key === 'GOOSE_BIN').saved, '');
  } finally {
    if (before === undefined) delete process.env.GOOSE_TURN_TIMEOUT_SECONDS; else process.env.GOOSE_TURN_TIMEOUT_SECONDS = before;
    rmSync(dir, { recursive: true, force: true });
  }
});
