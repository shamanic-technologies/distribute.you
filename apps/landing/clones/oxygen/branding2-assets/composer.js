import { setupComposerPopover } from './composer-popover.js';

/** Public landing controls are local previews; only submitting navigates to signup. */
export function setupComposer() {
  const form = document.getElementById('chat-form');
  // Once the visitor starts working, the entrance stays complete after blur.
  form.addEventListener('focusin', () => form.setAttribute('data-interacted', ''), { once: true });
  const prompt = document.getElementById('prompt');
  const approve = document.getElementById('composer-approve');
  const trigger = document.getElementById('composer-model');
  const label = document.getElementById('composer-model-label');
  const menu = document.getElementById('composer-model-menu');
  const options = [...menu.querySelectorAll('[data-model]')];
  function resizeInput() {
    prompt.style.height = '0px';
    prompt.style.height = `${Math.min(prompt.scrollHeight, parseFloat(getComputedStyle(prompt).maxHeight))}px`;
  }
  prompt.addEventListener('input', resizeInput);
  new ResizeObserver(resizeInput).observe(form);
  resizeInput();
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') form.setAttribute('data-keyboard-focus', '');
  });
  document.addEventListener('pointerdown', () => form.removeAttribute('data-keyboard-focus'));
  prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  approve.hidden = false;
  approve.addEventListener('click', () => {
    approve.setAttribute('aria-pressed', String(approve.getAttribute('aria-pressed') !== 'true'));
  });
  const modelPopover = setupComposerPopover(trigger, menu);
  options.forEach(option => option.addEventListener('click', () => {
    options.forEach(item => item.setAttribute('aria-checked', String(item === option)));
    label.textContent = option.dataset.model;
    modelPopover?.close();
    trigger.focus();
  }));
  const attach = document.getElementById('composer-attach');
  const attachmentMenu = document.getElementById('composer-attachment-menu');
  const attachmentPopover = setupComposerPopover(attach, attachmentMenu);
  const fileInput = document.getElementById('composer-file');
  const attachment = document.getElementById('composer-attachment');
  const filename = document.getElementById('composer-attachment-name');
  document.getElementById('composer-choose-file').addEventListener('click', () => {
    attachmentPopover?.close();
    attach.focus();
    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    // Show the local filename only. This public preview never reads or uploads file contents.
    filename.textContent = file.name;
    filename.title = file.name;
    attachment.hidden = false;
    attach.focus();
  });
  document.getElementById('composer-remove-attachment').addEventListener('click', () => {
    fileInput.value = '';
    filename.textContent = '';
    filename.removeAttribute('title');
    attachment.hidden = true;
    attach.focus();
  });
}
