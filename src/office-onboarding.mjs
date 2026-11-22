import { agentNames } from './config.mjs';
import { authenticateOfficeManager } from './office-auth.mjs';
import { ensureOfficeGoose } from './office-install.mjs';

const names = { claude: 'Claude', codex: 'Codex' };

function message(error, fallback) {
  return error?.name === 'Error' && !error.code ? error.message : fallback;
}

export function createOfficeOnboarding({ check, install = ensureOfficeGoose, authenticate = authenticateOfficeManager }) {
  let current = { state: 'idle', detail: '', managers: {} };
  let controller;
  let running = Promise.resolve();
  const snapshot = () => current;
  const update = patch => { current = { ...current, ...patch }; };
  const setManager = (id, state, detail) => {
    update({ managers: { ...current.managers, [id]: { state, detail } } });
  };

  async function onboard(signal) {
    try {
      await install({
        signal,
        onInstall: () => update({ detail: '正在下載並安裝 Goose CLI…' })
      });
      let backend = await check();
      for (const id of agentNames) {
        signal.throwIfAborted();
        if (backend.managers[id]) {
          setManager(id, 'ready', '已找到本機登入設定。');
          continue;
        }
        update({ detail: `正在開啟 ${names[id]} 的授權頁面…` });
        try {
          await authenticate(id, {
            signal,
            onInstall: () => {
              const detail = `正在下載並安裝 ${names[id]} 元件…`;
              setManager(id, 'installing', detail);
              update({ detail });
            },
            onAuthorize: () => {
              const detail = `請在瀏覽器完成 ${names[id]} 授權，完成後會自動更新。`;
              setManager(id, 'authorizing', detail);
              update({ detail });
            }
          });
          signal.throwIfAborted();
          backend = await check();
          if (!backend.managers[id]) throw new Error(backend.connections?.[id]?.detail || '尚未找到登入設定。');
          setManager(id, 'ready', '已完成本機登入。');
        } catch (error) {
          signal.throwIfAborted();
          setManager(id, 'failed', message(error, `${names[id]} 授權失敗，請重試。`));
        }
      }
      signal.throwIfAborted();
      if (agentNames.every(id => current.managers[id]?.state === 'ready')) {
        update({ state: 'done', detail: 'Claude 和 Codex 已就緒。' });
      } else {
        update({ state: 'failed', detail: '部分設定未完成。可以重試或使用手動登入。' });
      }
    } catch (error) {
      if (signal.aborted) {
        for (const id of agentNames.filter(id => ['authorizing', 'installing'].includes(current.managers[id]?.state))) {
          setManager(id, 'cancelled', '已取消這次授權。');
        }
        update({ state: 'cancelled', detail: '已取消設定。下次會沿用已完成的步驟。' });
      } else {
        update({ state: 'failed', detail: message(error, '無法完成本機設定。請重試或參考手動登入。') });
      }
    }
  }

  function start() {
    if (controller) return snapshot();
    controller = new AbortController();
    current = { state: 'running', detail: '正在檢查本機安裝與登入設定…', managers: {} };
    running = onboard(controller.signal).finally(() => { controller = undefined; });
    return snapshot();
  }
  function cancel() {
    if (controller && current.state === 'running') {
      update({ state: 'cancelling', detail: '正在取消設定…' });
      controller.abort();
    }
    return snapshot();
  }
  async function close() {
    cancel();
    await running;
  }
  return { snapshot, start, cancel, close };
}
