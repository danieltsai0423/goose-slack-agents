// Short confirmations in the corner: a purchase, a gift, a move, saved settings, a sent task. They read out to
// screen readers (role="status"), pause while hovered or focused, can be closed, and leave on their own.
// Errors stay next to the thing that failed; this is only for "that worked".
let region;
function ensureRegion() {
  if (region?.isConnected) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.append(region);
  return region;
}

// Motion follows the office animation switch (app.js keeps data-motion on <html> in step with it).
export const motionOn = () => document.documentElement.dataset.motion === 'on';

const MAX = 3;
export function toast(text, { tone = 'ok', duration = 4200 } = {}) {
  if (!text || typeof document === 'undefined') return;
  const host = ensureRegion();
  const node = document.createElement('div');
  node.className = 'toast ' + tone;
  const label = document.createElement('span');
  label.className = 'toast-text';
  label.textContent = text;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', '關閉通知');
  close.textContent = '×';
  node.append(Object.assign(document.createElement('i'), { className: 'toast-mark', ariaHidden: 'true' }), label, close);
  host.append(node);
  while (host.children.length > MAX) host.firstElementChild.remove();

  let left = duration, started = performance.now(), timer;
  const leave = () => {
    clearTimeout(timer);
    node.classList.add('leaving');
    setTimeout(() => node.remove(), motionOn() ? 180 : 0);
  };
  const run = () => { started = performance.now(); timer = setTimeout(leave, left); };
  const pause = () => { clearTimeout(timer); left = Math.max(800, left - (performance.now() - started)); };
  node.addEventListener('pointerenter', pause);
  node.addEventListener('pointerleave', run);
  node.addEventListener('focusin', pause);
  node.addEventListener('focusout', run);
  close.addEventListener('click', leave);
  run();
}
