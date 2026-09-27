import assert from 'node:assert/strict';

const keys = {
  Enter: { code: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', keyCode: 27 },
  Tab: { code: 'Tab', keyCode: 9 },
};

async function pressKey(call, key, shift = false) {
  const value = keys[key];
  const common = {
    key, code: value.code, windowsVirtualKeyCode: value.keyCode,
    nativeVirtualKeyCode: value.keyCode, modifiers: shift ? 8 : 0,
    ...(key === 'Enter' && { text: '\r', unmodifiedText: '\r' }),
  };
  await call('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', ...common });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}

export async function verifyTaskDialogKeyboard({ call, evaluate, waitFor }) {
  const openerReady = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find(value => value.textContent.trim() === 'Ny oppgave');
    if (!button) return false;
    button.dataset.keyboardOpener = 'task';
    button.focus();
    return document.activeElement === button;
  })()`);
  assert.equal(openerReady, true, 'Task-dialog opener could not receive focus');
  await pressKey(call, 'Enter');
  await waitFor('document.querySelector("#task-title") !== null', 'keyboard-opened task dialog');
  await waitFor(`document.querySelector('[role="dialog"]')?.contains(document.activeElement) === true`,
    'focus inside task dialog');

  const semantics = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const label = dialog && document.getElementById(dialog.getAttribute('aria-labelledby'));
    return { modal: dialog?.getAttribute('aria-modal'), label: label?.textContent?.trim() };
  })()`);
  assert.deepEqual(semantics, { modal: 'true', label: 'Registrer oppgave' });
  await call('Accessibility.enable');
  const tree = await call('Accessibility.getFullAXTree');
  assert.ok(tree.nodes.some(node => node.role?.value === 'dialog' &&
    node.name?.value === 'Registrer oppgave'), 'Named task dialog missing from accessibility tree');

  const focusableCount = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const values = [...dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])')]
      .filter(value => !value.hidden && value.getClientRects().length > 0);
    values.forEach((value, index) => value.dataset.keyboardIndex = String(index));
    values[0].focus();
    return values.length;
  })()`);
  assert.ok(focusableCount > 2, `Task dialog exposed only ${focusableCount} focusable controls`);
  await pressKey(call, 'Tab', true);
  assert.equal(await evaluate('document.activeElement.dataset.keyboardIndex'),
    String(focusableCount - 1), 'Shift+Tab escaped the beginning of the dialog');
  await pressKey(call, 'Tab');
  assert.equal(await evaluate('document.activeElement.dataset.keyboardIndex'), '0',
    'Tab escaped the end of the dialog');
  await pressKey(call, 'Tab');
  const visibleFocus = await evaluate(`(() => {
    const style = getComputedStyle(document.activeElement);
    return document.activeElement.matches(':focus-visible') && style.outlineStyle !== 'none' &&
      parseFloat(style.outlineWidth) >= 2;
  })()`);
  assert.equal(visibleFocus, true, 'Keyboard focus was not visibly indicated');

  await pressKey(call, 'Escape');
  await waitFor('document.querySelector("#task-title") === null', 'Escape-closed task dialog');
  assert.equal(await evaluate(`document.activeElement?.dataset.keyboardOpener === 'task'`), true,
    'Focus did not return to the task-dialog opener');
  await pressKey(call, 'Enter');
  await waitFor('document.querySelector("#task-title") !== null', 'reopened task dialog');
  return { keyboardModalNavigation: true, accessibleDialogTree: true, visibleKeyboardFocus: true };
}
