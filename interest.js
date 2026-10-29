(() => {
  'use strict';
  const form = document.getElementById('interest-form');
  if (!form || form.dataset.ready) return;
  form.dataset.ready = 'true';
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('interest-status');
  // Existing email lead handler; never invoke its payment actions.
  const endpoint = 'https://script.google.com/macros/s/AKfycbyF8v2plGz3zU75BzMTEXzvR0hTsYJwzxSBvTN4ma4D-83lolHMdwJABVTwaeGyHFqk7g/exec';
  let pending = false;
  let rowId;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    if (form.elements.company.value) return;
    pending = true;
    button.disabled = true;
    status.dataset.error = 'false';
    status.textContent = 'Sending your request…';
    rowId ||= 'sp_interest_' + crypto.randomUUID();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          row_id: rowId,
          email: form.elements.email.value.trim(),
          updates: 'Yes, keep me in the loop',
          founding_20: 'No',
          path: 'no_card',
          payment_status: 'none',
          status: 'lead_completed',
          source: '2027_interest',
          consent_version: '2026-10-29',
          submitted: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Request failed');
      const result = await response.json();
      if (result.error || !(result.status === 'ok' || result.status === 'success' || result.success === true)) {
        throw new Error('Save not confirmed');
      }
      status.textContent = 'Thanks for your interest. We’ll email you when there’s news to share.';
      form.reset();
      button.textContent = 'You’re on the update list';
      // Disable repeat submissions in this page session, without storing the email locally.
      pending = true;
    } catch {
      status.dataset.error = 'true';
      status.textContent = 'We couldn’t confirm your signup. Please try again, or email info@strikepointsims.com to request updates.';
      button.disabled = false;
      pending = false;
    }
  });
})();
