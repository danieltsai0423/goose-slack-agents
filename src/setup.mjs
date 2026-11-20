import { spawn } from 'node:child_process';
import { agentConfig, gooseBin } from './config.mjs';
import { prepareAgent, runAgent } from './goose.mjs';

const [, , action, id] = process.argv;
if (!['codex', 'claude'].includes(id) || !['configure', 'smoke'].includes(action)) {
  console.error('用法：npm run configure -- codex，或 npm run smoke -- claude。');
  process.exitCode = 1;
} else if (action === 'configure') {
  const { provider } = agentConfig[id];
  console.log(`請為 ${id} 選擇 ${provider}。請在自己的瀏覽器完成帳號登入。`);
  const child = spawn(gooseBin, ['configure'], { ...prepareAgent(id), stdio: 'inherit' });
  child.on('error', () => {
    console.error('無法啟動 Goose CLI，請確認 GOOSE_BIN 或 PATH。');
    process.exitCode = 1;
  });
  child.on('close', (code) => { process.exitCode = code ?? 1; });
} else {
  try {
    const result = await runAgent({
      id, request: '請將 JSON 的 reply 欄位填上 READY。', messages: [],
      required: true, canDelegate: false, timeoutMs: 60000
    });
    if (result.reply !== 'READY') throw new Error('unexpected_reply');
    console.log(`${id} (${agentConfig[id].provider}) smoke test: READY`);
  } catch (error) {
    console.error(`${id} (${agentConfig[id].provider}) smoke test: ${error.message}`);
    process.exitCode = 1;
  }
}
