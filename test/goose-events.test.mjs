import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGooseStream } from '../src/goose-events.mjs';

test('Goose streaming emits real tool lifecycle and preserves the final Markdown reply', () => {
  const progress = [];
  const stream = createGooseStream(event => progress.push(event));
  const events = [
    { type: 'message', message: { role: 'assistant', content: [
      { type: 'text', text: '檢查資料' },
      { type: 'toolRequest', id: 'tool-1', toolCall: { status: 'success', value: {
        name: 'shell', arguments: { command: 'ffmpeg -i in.mp4 out.mp4; API_KEY=hidden' }
      } } }
    ] } },
    { type: 'message', message: { role: 'user', content: [
      { type: 'toolResponse', id: 'tool-1', toolResult: { status: 'success', value: {
        resultType: 'complete', isError: false, structuredContent: { exit_code: 1 }
      } } }
    ] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: '**轉檔失敗**' }] } },
    { type: 'complete' }
  ];
  const output = 'Goose startup\n' + events.map(event => JSON.stringify(event)).join('\r\n');
  for (let i = 0; i < output.length; i += 17) stream.feed(output.slice(i,i+17));
  assert.equal(stream.finish(), '**轉檔失敗**');
  const [started, finished] = progress.filter(event => event.type === 'tool');
  assert.equal(started.status, 'running');
  assert.equal(started.kind, 'video');
  assert.ok(started.detail.includes('out.mp4'));
  assert.ok(!started.detail.includes('=hidden'));
  assert.equal(finished.status, 'failed');
});
