const $ = id => document.getElementById(id);
const stepLabels = {
  ready: '可執行', waiting: '等候前置工序', running: '執行中', done: '已完成',
  failed: '失敗', interrupted: '中斷待確認', blocked: '前置工序未完成'
};

async function json(path, { body, signal } = {}) {
  const response = await fetch(path, {
    cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    ...(body === undefined ? {} : { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '請稍後再試。');
  return value;
}

export function mountWorkspaceTools({ el, people, getDraftKey, getStore, putStore, getChoice, setChoice,
  canEdit, openThread, openTask, openNew, onDraftChange, when }) {
  const byId = new Map(people.map(person => [person.id, person]));
  const nameFor = id => byId.get(id)?.name || (id === 'user' ? '你' : id);
  const referenceDialog = $('reference-dialog');
  const workflowDialog = $('workflow-dialog');
  const draftWrap = $('composer-references');
  const actorPicker = $('knowledge-actor');
  const statusPicker = $('knowledge-status');
  const knowledgeForm = $('knowledge-form');
  let view = '', boardThread = '', lastLoaded = 0, paneRequest, paneSignature = '', draftSignature = '';
  let searchRequest, searchTimer, searchEpoch = 0, editSteps = [];
  let changes = false;

  for (const person of people) {
    const option = el('option', '', person.name);
    option.value = person.id;
    actorPicker.append(option);
  }

  function draft(key = getDraftKey()) {
    const data = getStore('tools:' + key);
    return { references: Array.isArray(data?.references) ? data.references : [],
      workflow: Array.isArray(data?.workflow) ? data.workflow : [] };
  }
  function saveDraft(value) {
    putStore('tools:' + getDraftKey(), value.references.length || value.workflow.length ? value : null);
    onDraftChange();
  }
  function action(label, callback, className = 'small-action') {
    const button = el('button', className, label);
    button.type = 'button';
    button.onclick = callback;
    return button;
  }
  function renderDraft() {
    const { references, workflow } = draft();
    const key = JSON.stringify([getDraftKey(), references, workflow, canEdit()]);
    if (key === draftSignature) return;
    draftSignature = key;
    $('reference-open').disabled = $('workflow-open').disabled = !canEdit();
    const cards = references.map(ref => {
      const card = el('div', 'draft-chip');
      const caption = el('span', '', '引用 · ' + nameFor(ref.author) + ' · ' + ref.excerpt.slice(0, 30));
      caption.title = ref.excerpt;
      const remove = action('×', () => {
        const current = draft();
        saveDraft({ ...current, references: current.references.filter(item => item.id !== ref.id) });
        $('reference-open').focus();
      });
      remove.disabled = !canEdit();
      remove.setAttribute('aria-label', '移除引用');
      card.append(caption, remove);
      return card;
    });
    if (workflow.length) {
      const card = el('div', 'draft-chip workflow-chip');
      const edit = action(`${workflow.length} 項工序`, showWorkflow);
      const remove = action('×', () => { saveDraft({ ...draft(), workflow: [] }); $('workflow-open').focus(); });
      remove.setAttribute('aria-label', '移除分工');
      edit.disabled = remove.disabled = !canEdit();
      card.append(edit, remove);
      cards.push(card);
    }
    draftWrap.hidden = !cards.length;
    draftWrap.replaceChildren(...cards);
  }

  function loadReferences() {
    clearTimeout(searchTimer);
    searchRequest?.abort();
    const epoch = ++searchEpoch;
    searchTimer = setTimeout(async () => {
      const controller = new AbortController();
      searchRequest = controller;
      const query = $('reference-search').value.trim();
      $('reference-note').textContent = '正在查詢本機紀錄…';
      try {
        const data = await json('/api/history/search?' + new URLSearchParams({ q: query }), { signal: controller.signal });
        if (epoch !== searchEpoch || !referenceDialog.open) return;
        const selected = new Set(draft().references.map(item => item.id));
        $('reference-note').textContent = data.results.length ? '' : '沒有符合的任務紀錄。';
        $('reference-results').replaceChildren(...data.results.map(result => {
          const item = el('article', 'reference-result');
          const head = el('header');
          head.append(el('strong', '', nameFor(result.author)), el('time', 'meta', when(result.createdAt, true)));
          const excerpt = el('p', '', result.excerpt);
          const add = action(selected.has(result.id) ? '已引用' : '加入引用', () => {
            const current = draft();
            if (!canEdit() || current.references.length >= 4 || current.references.some(row => row.id === result.id)) return;
            saveDraft({ ...current, references: [...current.references, result] });
            referenceDialog.close();
            $('message').focus();
          }, 'login-trigger');
          add.disabled = selected.has(result.id) || selected.size >= 4;
          if (selected.size >= 4) $('reference-note').textContent = '已達 4 則引用上限。';
          item.append(head, excerpt, add);
          return item;
        }));
      } catch (error) {
        if (epoch === searchEpoch && !controller.signal.aborted) {
          $('reference-results').replaceChildren();
          $('reference-note').textContent = error.message;
        }
      }
    }, 180);
  }
  $('reference-open').onclick = () => {
    if (!canEdit()) return;
    $('reference-results').replaceChildren();
    referenceDialog.showModal();
    $('reference-search').focus();
    loadReferences();
  };
  $('reference-search').oninput = loadReferences;
  referenceDialog.onclose = () => { searchEpoch++; clearTimeout(searchTimer); searchRequest?.abort(); };

  function showWorkflow() {
    if (!canEdit()) return;
    editSteps = structuredClone(draft().workflow);
    if (!editSteps.length) editSteps.push({ key: 's1', worker: '', assignment: '', dependsOn: [] });
    $('workflow-manager').value = getChoice() === 'both' ? '' : getChoice();
    $('workflow-note').textContent = '';
    renderWorkflowEditor();
    workflowDialog.showModal();
  }

  function renderWorkflowEditor() {
    $('workflow-add').disabled = editSteps.length >= 6;
    $('workflow-steps').replaceChildren(...editSteps.map((step, index) => {
      const field = el('fieldset', 'workflow-step-editor');
      field.append(el('legend', '', '工序 ' + (index + 1)));
      const label = el('label', '', '負責人');
      const owner = el('select');
      owner.required = true;
      owner.setAttribute('aria-label', `工序 ${index + 1} 負責人`);
      owner.append(el('option', '', '請選擇成員'));
      owner.options[0].value = '';
      for (const person of people.filter(item => item.kind === 'worker')) {
        const option = el('option', '', person.name + ' · ' + nameFor(person.manager));
        option.value = person.id;
        owner.append(option);
      }
      owner.value = step.worker;
      owner.onchange = () => { step.worker = owner.value; };
      label.append(owner);
      const assignmentLabel = el('label', '', '工作說明');
      const assignment = el('textarea');
      assignment.required = true;
      assignment.maxLength = 1600;
      assignment.rows = 2;
      assignment.value = step.assignment;
      assignment.setAttribute('aria-label', `工序 ${index + 1} 工作說明`);
      assignment.oninput = () => { step.assignment = assignment.value; };
      assignmentLabel.append(assignment);
      field.append(label, assignmentLabel);
      if (editSteps.length > 1) {
        const choices = el('fieldset', 'dependency-choices');
        choices.append(el('legend', '', '前置工序'));
        for (const [position, candidate] of editSteps.entries()) {
          if (candidate.key === step.key) continue;
          const checkbox = el('input');
          checkbox.type = 'checkbox';
          checkbox.checked = step.dependsOn.includes(candidate.key);
          checkbox.onchange = () => {
            step.dependsOn = checkbox.checked ? [...step.dependsOn, candidate.key] : step.dependsOn.filter(key => key !== candidate.key);
          };
          const checkLabel = el('label');
          checkLabel.append(checkbox, document.createTextNode('工序 ' + (position + 1)));
          choices.append(checkLabel);
        }
        field.append(choices, action('移除工序 ' + (index + 1), () => {
          editSteps = editSteps.filter(item => item.key !== step.key).map(item => ({
            ...item, dependsOn: item.dependsOn.filter(key => key !== step.key)
          }));
          renderWorkflowEditor();
        }));
      }
      return field;
    }));
  }
  $('workflow-open').onclick = showWorkflow;
  $('board-new').onclick = () => { if (canEdit()) { openNew(); showWorkflow(); } };
  $('workflow-add').onclick = () => {
    let next = 1;
    while (editSteps.some(step => step.key === 's' + next)) next++;
    editSteps.push({ key: 's' + next, worker: '', assignment: '', dependsOn: [] });
    renderWorkflowEditor();
    $('workflow-steps').lastElementChild.querySelector('select').focus();
  };
  $('workflow-form').onsubmit = event => {
    event.preventDefault();
    if (!canEdit()) return;
    const done = new Set();
    while (done.size < editSteps.length) {
      const next = editSteps.filter(step => !done.has(step.key) && step.dependsOn.every(key => done.has(key)));
      if (!next.length) { $('workflow-note').textContent = '工序不能循環依賴。'; return; }
      for (const step of next) done.add(step.key);
    }
    if (editSteps.some(step => !step.assignment.trim())) { $('workflow-note').textContent = '每個工序都需要工作說明。'; return; }
    setChoice($('workflow-manager').value);
    saveDraft({ ...draft(), workflow: editSteps });
    workflowDialog.close();
    $('message').focus();
  };

  function renderBoard(items) {
    const lanes = [
      ['待處理', item => item.status === 'queued'],
      ['進行中', item => !['queued', 'done', 'failed'].includes(item.status)],
      ['結案', item => ['done', 'failed'].includes(item.status)]
    ];
    $('board-cards').replaceChildren(...lanes.map(([label, match]) => {
      const lane = el('section', 'board-lane');
      const list = items.filter(match);
      lane.append(el('h3', '', label + ' ' + list.length));
      if (!list.length) lane.append(el('p', 'meta', '沒有分工'));
      for (const workflow of list) {
        const card = el('article', 'board-card');
        const head = action(workflow.text || '開啟分工', () => openThread(workflow.threadId), 'board-title');
        const numbers = new Map(workflow.steps.map((step, index) => [step.key, index + 1]));
        card.append(head, el('p', 'meta', '審閱 · ' + nameFor(workflow.manager)));
        const steps = el('ol', 'board-steps');
        for (const step of workflow.steps) {
          const row = el('li', 'board-step');
          const title = el('div', 'board-step-head');
          const status = el('span', 'board-status', stepLabels[step.status] || step.status);
          status.dataset.state = step.status;
          title.append(el('strong', '', nameFor(step.worker)), status);
          row.append(title, el('p', '', step.assignment));
          if (step.dependsOn.length) row.append(el('p', 'meta', '前置 · ' + step.dependsOn.map(key => '工序 ' + numbers.get(key)).join('、')));
          if (step.error) row.append(el('p', 'board-error', step.error));
          if (step.result) {
            const details = el('details');
            details.dataset.resultKey = workflow.id + ':' + step.key;
            details.append(el('summary', '', '成果'), el('p', 'board-result', step.result));
            row.append(details);
          }
          steps.append(row);
        }
        card.append(steps);
        const hostInterrupted = (workflow.access ? workflow.access !== 'chat' : /^(?:執行|execute)\s*[:：]/iu.test(workflow.text)) && workflow.steps.some(step => step.status === 'interrupted');
        if (hostInterrupted) card.append(el('p', 'board-error', '重試前請先確認工作目錄是否已有變更。'));
        if (workflow.status === 'failed') card.append(action(hostInterrupted ? '重試中斷的本機工序' : '重試未完成工序', async event => {
          const button = event.currentTarget;
          button.disabled = true;
          try { await mutate('/api/workflows/' + workflow.id + '/retry', {}, '已加入重試佇列。', $('board-note')); }
          finally { button.disabled = false; }
        }, 'login-trigger'));
        lane.append(card);
      }
      return lane;
    }));
  }

  function renderKnowledge(entries) {
    $('knowledge-entries').replaceChildren(...entries.map(entry => {
      const card = el('article', 'knowledge-card');
      card.append(el('h3', '', entry.title), el('p', 'meta', [entry.kind === 'skill' ? '技能' : '記憶', ...entry.keywords].join(' · ')),
        el('p', 'knowledge-body', entry.body));
      const actions = el('div', 'knowledge-actions');
      if (entry.sourceTaskId) actions.append(action('查看來源', () => openTask(entry.sourceTaskId)));
      const choices = entry.status === 'pending' ? [['approve','核准'], ['reject','退回']]
        : entry.status === 'approved' ? [['archive','封存']] : [];
      for (const [move, label] of choices) actions.append(action(label, async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await mutate('/api/knowledge/' + entry.id + '/' + move, {}, '已更新審核狀態。', $('knowledge-note')); }
        finally { button.disabled = false; }
      }, 'login-trigger'));
      if (actions.childElementCount) card.append(actions);
      return card;
    }));
  }

  async function refreshPane(force = false) {
    if (!['board','knowledge'].includes(view) || document.hidden || (!force && (paneRequest || Date.now() - lastLoaded < 3000))) return;
    if (force) paneRequest?.abort();
    const controller = new AbortController();
    paneRequest = controller;
    const target = view;
    const status = target === 'board' ? $('board-note') : $('knowledge-note');
    const savedDetails = new Set([...$('board-cards').querySelectorAll('details[open]')].map(item => item.dataset.resultKey));
    lastLoaded = Date.now();
    try {
      const path = target === 'board' ? '/api/workflows?' + new URLSearchParams({thread:boardThread}) : '/api/knowledge?' + new URLSearchParams({
        actor: actorPicker.value, status: statusPicker.value
      });
      const data = await json(path, { signal: controller.signal });
      if (paneRequest !== controller || view !== target) return;
      const items = data.workflows || data.entries || [];
      const hash = JSON.stringify([target, boardThread, actorPicker.value, statusPicker.value, items]);
      if (hash === paneSignature) return;
      paneSignature = hash;
      status.textContent = items.length ? (target === 'board' && boardThread ? '目前任務的分工' : '')
        : (target === 'board' ? '尚無分工。' : '此成員沒有此狀態的提案。');
      if (target === 'board') {
        renderBoard(items);
        for (const item of $('board-cards').querySelectorAll('details')) item.open = savedDetails.has(item.dataset.resultKey);
      } else renderKnowledge(items);
    } catch (error) {
      if (!controller.signal.aborted && view === target) {
        paneSignature = '';
        status.textContent = error.message;
      }
    } finally {
      if (paneRequest === controller) paneRequest = null;
    }
  }

  async function mutate(path, body, success, status) {
    if (changes) return false;
    changes = true;
    try {
      await json(path, { body });
      await refreshPane(true);
      status.textContent = success;
      return true;
    } catch (error) {
      status.textContent = error.message;
      return false;
    } finally { changes = false; }
  }
  actorPicker.onchange = statusPicker.onchange = () => refreshPane(true);
  function setBoardThread(thread) {
    if (thread === boardThread) return;
    boardThread = thread;
    $('board-clear').hidden = !thread;
    if (view === 'board') refreshPane(true);
  }
  $('board-clear').onclick = () => setBoardThread('');
  knowledgeForm.elements.kind.onchange = () => {
    const skill = knowledgeForm.elements.kind.value === 'skill';
    $('knowledge-keywords').hidden = !skill;
    knowledgeForm.elements.keywords.required = skill;
    knowledgeForm.elements.body.maxLength = skill ? 2400 : 600;
  };
  knowledgeForm.onsubmit = async event => {
    event.preventDefault();
    const fields = new FormData(knowledgeForm);
    const keywords = fields.get('kind') === 'skill' ? fields.get('keywords').split(/[,，、]/u).map(word => word.trim()).filter(Boolean) : [];
    const ok = await mutate('/api/knowledge', {
      actor: actorPicker.value, kind: fields.get('kind'), title: fields.get('title'), body: fields.get('body'), keywords
    }, '已送審。', $('knowledge-note'));
    if (ok) {
      knowledgeForm.reset();
      knowledgeForm.elements.kind.onchange();
      $('knowledge-new').open = false;
      if (statusPicker.value !== 'pending') { statusPicker.value = 'pending'; refreshPane(true); }
    }
  };

  return {
    draft, renderDraft, refreshPane, setBoardThread,
    clearDraft: key => putStore('tools:' + key, null),
    setView(next) {
      if (view === next) return;
      view = next;
      paneSignature = '';
      $('board-view').hidden = view !== 'board';
      $('knowledge-view').hidden = view !== 'knowledge';
      $('history-list').hidden = view === 'board' || view === 'knowledge';
      paneRequest?.abort();
      paneRequest = null;
      refreshPane(true);
    }
  };
}
