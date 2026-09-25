import { copy } from '../copy.js';
import { escapeHtml } from './html.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function renderKeyDialogMarkup() {
  return `
    <dialog id="key-dialog" class="key-dialog" aria-labelledby="key-dialog-title" aria-describedby="key-dialog-warning">
      <form class="key-form" novalidate>
        <h2 id="key-dialog-title">${escapeHtml(copy.keyDialogTitle)}</h2>
        <p id="key-dialog-warning" class="key-warning">${escapeHtml(copy.keyDialogWarning)}</p>
        <label for="openrouter-key">${escapeHtml(copy.keyLabel)}</label>
        <div class="key-input-row">
          <input id="openrouter-key" name="openrouter-key" type="password" autocomplete="off"
            autocapitalize="off" spellcheck="false" aria-describedby="key-error" />
          <button type="button" class="button" data-dialog-action="toggle-visibility" aria-pressed="false">${escapeHtml(copy.showKey)}</button>
        </div>
        <p id="key-error" class="key-error" aria-live="polite"></p>
        <div class="dialog-actions">
          <button type="submit" class="button button-primary">${escapeHtml(copy.useAiDecision)}</button>
          <button type="button" class="button" data-dialog-action="skip">${escapeHtml(copy.skipAi)}</button>
          <button type="button" class="button button-quiet" data-dialog-action="forget" hidden>${escapeHtml(copy.forgetKey)}</button>
        </div>
      </form>
    </dialog>`;
}

// Wires the dialog. The typed key goes straight to onSubmit and is then wiped
// from the input; it is never kept in the DOM.
export function createKeyDialog(dialog, { onSubmit, onSkip, onForget, onCancel = () => {}, hasKey }) {
  const form = dialog.querySelector('form');
  const input = dialog.querySelector('#openrouter-key');
  const error = dialog.querySelector('#key-error');
  const toggle = dialog.querySelector('[data-dialog-action="toggle-visibility"]');
  const forget = dialog.querySelector('[data-dialog-action="forget"]');
  // Stored by id: the trigger may be re-rendered while the dialog is open.
  let returnFocusId = null;

  const setVisible = (visible) => {
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.textContent = visible ? copy.hideKey : copy.showKey;
  };

  const reset = () => {
    input.value = '';
    error.textContent = '';
    setVisible(false);
  };

  const isOpen = () => dialog.open || dialog.hasAttribute('open');

  function close() {
    reset();
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    dialog.removeAttribute('open');
    if (returnFocusId) dialog.ownerDocument.getElementById(returnFocusId)?.focus();
    returnFocusId = null;
  }

  function open(trigger = document.activeElement) {
    returnFocusId = trigger?.id || null;
    reset();
    forget.hidden = !hasKey();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    input.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      error.textContent = copy.keyRequired;
      input.focus();
      return;
    }
    close();
    onSubmit(value);
  });

  dialog.addEventListener('click', (event) => {
    const action = event.target.closest('[data-dialog-action]')?.dataset.dialogAction;
    if (action === 'toggle-visibility') setVisible(input.type === 'password');
    else if (action === 'skip') {
      close();
      onSkip();
    } else if (action === 'forget') {
      close();
      onForget();
    }
  });

  // Escape closes without saving a partial key.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
    onCancel();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    // Keep focus inside the dialog (also covers the non-modal fallback).
    const focusable = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  return { open, close, isOpen };
}
