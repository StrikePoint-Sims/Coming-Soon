const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../interest.js'), 'utf8');
function setup(fetch, valid = true) {
  let submit;
  const button = { disabled: false };
  const status = { dataset: {}, textContent: '' };
  const form = {
    dataset: {},
    elements: { company: { value: '' }, email: { value: ' golfer@example.com ' } },
    reportValidity: () => valid,
    querySelector: () => button,
    reset() { this.resetCalled = true; },
    addEventListener: (_, listener) => { submit = listener; },
  };
  vm.runInNewContext(source, {
    document: { getElementById: (id) => id === 'interest-form' ? form : status },
    fetch, crypto: { randomUUID: () => 'test-id' }, AbortSignal, Date,
  });
  return { form, button, status, submit: () => submit({ preventDefault() {} }) };
}

test('only submits email and no-card metadata after a valid form; confirms acknowledged saves', async () => {
  let calls = 0;
  const page = setup(async (_, options) => {
    calls++;
    const data = JSON.parse(options.body);
    assert.equal(data.email, 'golfer@example.com');
    assert.equal(data.path, 'no_card');
    assert.equal(data.founding_20, 'No');
    assert.equal(data.payment_status, 'none');
    assert.equal(data.status, 'lead_completed');
    assert.equal(data.source, '2027_interest');
    assert.equal(data.action, undefined);
    assert.equal(data.stripe_customer, undefined);
    assert.equal(data.membership_tier, undefined);
    assert.notEqual(options.mode, 'no-cors');
    return { ok: true, json: async () => ({ status: 'ok' }) };
  });
  await page.submit();
  assert.match(page.status.textContent, /Thanks/);
  assert.equal(page.form.resetCalled, true);
  assert.equal(page.button.disabled, true);
  await page.submit();
  assert.equal(calls, 1);
});

for (const [name, fetch] of [
  ['HTTP failure', async () => ({ ok: false })],
  ['backend error', async () => ({ ok: true, json: async () => ({ error: 'unavailable' }) })],
  ['unacknowledged response', async () => ({ ok: true, json: async () => ({}) })],
  ['non-JSON response', async () => ({ ok: true, json: async () => { throw new Error('not JSON'); } })],
  ['network/CORS/timeout failure', async () => { throw new Error('network failure'); }],
]) test(name + ' keeps email available and offers retry/contact without false success', async () => {
  const page = setup(fetch);
  await page.submit();
  assert.equal(page.status.dataset.error, 'true');
  assert.match(page.status.textContent, /couldn’t confirm/);
  assert.equal(page.button.disabled, false);
  assert.equal(page.form.resetCalled, undefined);
});

test('invalid email or missing required consent does not submit', async () => {
  const page = setup(() => { throw new Error('must not call'); }, false);
  await page.submit();
  assert.equal(page.button.disabled, false);
});

test('honeypot prevents submission', async () => {
  const page = setup(() => { throw new Error('must not call'); });
  page.form.elements.company.value = 'bot';
  await page.submit();
  assert.equal(page.button.disabled, false);
});

test('archived homepages exactly match the prior commit', () => {
  const { execFileSync } = require('node:child_process');
  const root = path.join(__dirname, '..');
  for (const [original, archived] of [
    ['index.html', 'archive/homepage-before-pause.html'],
    ['src/app/page.tsx', 'archive/next-homepage-before-pause.tsx.txt'],
  ]) {
    assert.deepEqual(fs.readFileSync(path.join(root, archived)), execFileSync('git', ['show', 'b575dc21dc5a374e5529b9fd1842f37c2b1048ee:' + original], { cwd: root }));
  }
});
