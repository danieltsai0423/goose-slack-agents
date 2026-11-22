export function toolInfo(call) {
  const name = String(call.name || 'tool').slice(0, 120);
  const args = call.arguments || {};
  const command = typeof args.command === 'string' ? args.command : '';
  const detail = (command || args.path || args.file_path || args.url || args.description || '');
  const subject = name + ' ' + command;
  const kind = /screenshot|screen.?capture|takeScreenshot|capture.page/i.test(subject) ? 'screenshot'
    : /ffmpeg|record.?video|render.?video|remotion|video.export/i.test(subject) ? 'video'
    : command || /(?:^|__)bash|shell|terminal|exec_command/i.test(name) ? 'command'
    : /web|browser|navigate/i.test(name) ? 'web'
    : /read|write|edit|patch|glob|grep/i.test(name) ? 'file'
    : /summon|subagent|^agent$|task/i.test(name) ? 'task' : 'tool';
  const safeDetail = typeof detail === 'string' ? detail
    .replace(/((?:[\w-]*(?:token|secret|password|api[_-]?key)|authorization)(?:\s*[:=]\s*|\s+))(?:"[^"]*"|'[^']*'|[^\s;]+)/gi, '$1[已隱藏]')
    .replace(/\b(?:sk-[\w-]{12,}|xox[abprs]-[\w-]+|gh[pousr]_[\w]{12,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g, '[已隱藏]')
    .slice(0, 700) : '';
  return { kind, name, detail: safeDetail };
}

// goose run --output-format stream-json writes message envelopes mixed with startup text.
export function createGooseStream(onProgress) {
  let pending = '';
  let answer = '';
  let completed = '';
  const external = new Set();
  function publishText(text) {
    onProgress({ type: 'text', text: text.slice(0, 24000) });
  }
  function line(value) {
    let event;
    try { event = JSON.parse(value); } catch { return; }
    const message = event?.type === 'message' ? event.message : null;
    if (!Array.isArray(message?.content)) {
      if (event?.type === 'complete') completed = answer;
      return;
    }
    for (const part of message.content) {
      if (message.role === 'assistant' && part.type === 'text' && typeof part.text === 'string') {
        answer += part.text;
        publishText(answer);
      } else if (part.type === 'toolRequest' && typeof part.id === 'string' && part.toolCall?.value?.name) {
        answer = '';
        publishText('');
        if (part._meta?.['goose.external_dispatch']) external.add(part.id);
        onProgress({ type: 'tool', id: part.id, status: 'running', ...toolInfo(part.toolCall.value) });
      } else if (part.type === 'toolResponse' && typeof part.id === 'string') {
        const value = part.toolResult?.value;
        if (value?.resultType === 'pending') continue;
        const exitCode = value?.structuredContent?.exit_code;
        const failed = part.toolResult?.status === 'error' || value?.isError === true ||
          (typeof exitCode === 'number' && exitCode !== 0);
        const title = external.has(part.id) && value?.content?.[0]?.text;
        const summary = typeof title === 'string' && value.content.length > 1 && title.length < 180 && !title.includes('\n')
          ? toolInfo({ arguments: { description: title } }).detail : '';
        onProgress({ type: 'tool', id: part.id, status: failed ? 'failed' : 'done',
          detail: typeof exitCode === 'number' ? `結束代碼 ${exitCode}` : summary });
      }
    }
  }
  return {
    feed(chunk) {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      for (const value of lines) line(value);
    },
    finish() {
      if (pending.trim()) line(pending);
      return (completed || answer).trim();
    }
  };
}
