import { agentConfig, agentNames } from './config.mjs';

const claudeEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
const codexEfforts = ['medium', 'high'];
const codexExtendedEfforts = ['none', 'low', 'medium', 'high', 'xhigh'];
const nativeEfforts = ['xhigh', 'max'];
const officeDefaults = {
  claude: { model: 'claude-opus-5-5', effort: 'medium' },
  codex: { model: 'gpt-6.2-sol', effort: 'xhigh' }
};
const models = {
  claude: [
    { id: 'claude-opus-5-5', label: 'Opus 5.5', efforts: claudeEfforts },
    { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', efforts: claudeEfforts },
    { id: 'claude-haiku-5-5', label: 'Haiku 5.5', efforts: claudeEfforts },
    { id: 'claude-fable-5-2', label: 'Fable 5.2', efforts: claudeEfforts }
  ],
  codex: [
    { id: 'gpt-6.2-sol', label: 'GPT-6.2 Sol', efforts: codexEfforts },
    { id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra', efforts: codexEfforts },
    { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', efforts: codexEfforts },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', efforts: codexExtendedEfforts }
  ]
};

export function requiresNativeCodex(model, effort) {
  const gooseEfforts = models.codex.find(option => option.id === model)?.efforts ?? codexEfforts;
  return nativeEfforts.includes(effort) && !gooseEfforts.includes(effort);
}

function withNativeEfforts(model, efforts, supported) {
  return [...efforts, ...nativeEfforts.filter(effort =>
    requiresNativeCodex(model, effort) && supported?.[model]?.includes(effort))];
}

// The local Goose 1.60.2 provider accepts Medium and High for newer Codex models.
// Its recognized GPT-5.6 models expose the wider effort range.
export function officeModelCatalog(nativeCodexEfforts) {
  return Object.fromEntries(agentNames.map(id => {
    const choices = id === 'codex' ? models.codex.map(model => ({
      ...model, efforts: withNativeEfforts(model.id, model.efforts, nativeCodexEfforts)
    })) : models[id];
    const { model, effort } = officeDefaults[id];
    const { label, efforts } = choices.find(choice => choice.id === model);
    const defaultEffort = efforts.includes(effort) ? effort : 'high';
    return [id, {
      defaultModel: model, defaultLabel: label, defaultEffort, defaultEfforts: efforts, models: choices
    }];
  }));
}

function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function normalizeOfficeModels(input, managers, nativeCodexEfforts) {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(id => !managers.includes(id))) {
    throw invalid('模型設定必須對應這次交辦的主管。');
  }
  const options = officeModelCatalog(nativeCodexEfforts);
  const selected = {};
  for (const id of managers) {
    if (!Object.hasOwn(input, id)) continue;
    const item = input[id];
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(key => key !== 'model' && key !== 'effort')) {
      throw invalid('模型設定格式錯誤。');
    }
    const { model = '', effort = '' } = item;
    const { name, model: configuredModel } = agentConfig[id];
    const chosenModel = model === '' ? configuredModel : model;
    const match = options[id].models.find(option => option.id === chosenModel);
    if (model !== '' && !match) throw invalid(`${name} 無法使用這個模型。`);
    const allowed = match?.efforts ?? (id === 'codex' ? withNativeEfforts(configuredModel, codexEfforts, nativeCodexEfforts) : []);
    if (effort !== '' && !allowed.includes(effort)) {
      throw invalid(`${name} 的所選模型不支援這個推理強度。`);
    }
    if (model || effort) selected[id] = { model: chosenModel, effort: effort || null };
  }
  return selected;
}
