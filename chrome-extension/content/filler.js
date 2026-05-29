// IronVault filler — sets input/select values and dispatches native events
// so React/Vue/Angular all pick up the change. Lives at
// window.IronVaultAutofill.filler.

(() => {
  if (window.IronVaultAutofill && window.IronVaultAutofill.filler) return;
  const ns = (window.IronVaultAutofill = window.IronVaultAutofill || {});

  // Some frameworks intercept the prototype setter on HTMLInputElement /
  // HTMLTextAreaElement / HTMLSelectElement. To make sure the dispatched
  // events trigger their state machine, we go through the *native* descriptor.
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
  }

  function dispatch(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // Some sites listen for keyup/blur to validate.
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function fillInput(el, value) {
    if (!el || value == null) return false;
    el.focus({ preventScroll: true });
    setNativeValue(el, String(value));
    dispatch(el);
    return true;
  }

  // <select> needs the option matched by value OR by visible text.
  function fillSelect(el, value) {
    if (!el || value == null) return false;
    const target = String(value).toLowerCase().trim();
    const opts = Array.from(el.options || []);
    let match = opts.find(o => (o.value || '').toLowerCase() === target);
    if (!match) match = opts.find(o => (o.textContent || '').toLowerCase().trim() === target);
    if (!match) match = opts.find(o => (o.textContent || '').toLowerCase().includes(target));
    if (!match) return false;
    el.value = match.value;
    dispatch(el);
    return true;
  }

  function smartFill(el, value) {
    if (!el) return false;
    if (el.tagName === 'SELECT') return fillSelect(el, value);
    return fillInput(el, value);
  }

  // ── Login fill ────────────────────────────────────────────────────────────
  function fillLogin(detection, credential) {
    if (!detection || !credential) return { filled: 0 };
    let filled = 0;
    if (detection.fields.username && credential.username) {
      if (smartFill(detection.fields.username, credential.username)) filled++;
    }
    if (detection.fields.password && credential.password) {
      if (smartFill(detection.fields.password, credential.password)) filled++;
    }
    return { filled };
  }

  // ── Credit card fill ──────────────────────────────────────────────────────
  function fillCard(detection, card) {
    if (!detection || !card) return { filled: 0 };
    const f = detection.fields;
    let filled = 0;
    if (f.number && card.cardNumber) {
      if (smartFill(f.number, card.cardNumber)) filled++;
    }
    if (f.holder && card.cardholderName) {
      if (smartFill(f.holder, card.cardholderName)) filled++;
    }
    if (f.cvv && card.cvv) {
      if (smartFill(f.cvv, card.cvv)) filled++;
    }

    // Expiry: combined vs split, and year as 2- or 4-digit.
    const mm = String(card.expiryMonth || '').padStart(2, '0');
    const yyyy = String(card.expiryYear || '');
    const yy = yyyy.length === 4 ? yyyy.slice(-2) : yyyy;
    if (f.exp) {
      // Common formats: MM/YY, MM/YYYY, MM-YY, MMYY. We pick MM/YY as the
      // most widely accepted default and let the site reformat.
      if (smartFill(f.exp, `${mm}/${yy}`)) filled++;
    }
    if (f.expMonth) {
      if (smartFill(f.expMonth, mm)) filled++;
    }
    if (f.expYear) {
      // Try 4-digit first; if the select doesn't have that option fillSelect
      // returns false and we retry with 2-digit.
      if (!smartFill(f.expYear, yyyy)) smartFill(f.expYear, yy);
      filled++;
    }
    if (f.zip && card.billingZip) {
      if (smartFill(f.zip, card.billingZip)) filled++;
    }
    return { filled };
  }

  // ── Identity fill ─────────────────────────────────────────────────────────
  function fillIdentity(detection, identity) {
    if (!detection || !identity) return { filled: 0 };
    const f = detection.fields;
    let filled = 0;

    const fullName = [identity.firstName, identity.middleName, identity.lastName]
      .filter(Boolean).join(' ').trim();

    if (f.firstName && identity.firstName && smartFill(f.firstName, identity.firstName)) filled++;
    if (f.lastName && identity.lastName && smartFill(f.lastName, identity.lastName)) filled++;
    if (f.fullName && fullName && smartFill(f.fullName, fullName)) filled++;
    if (f.email && identity.email && smartFill(f.email, identity.email)) filled++;
    if (f.phone && identity.phone && smartFill(f.phone, identity.phone)) filled++;
    if (f.address1 && identity.addressLine1 && smartFill(f.address1, identity.addressLine1)) filled++;
    if (f.address2 && identity.addressLine2 && smartFill(f.address2, identity.addressLine2)) filled++;
    if (f.city && identity.city && smartFill(f.city, identity.city)) filled++;
    if (f.state && identity.state && smartFill(f.state, identity.state)) filled++;
    if (f.postalCode && identity.postalCode && smartFill(f.postalCode, identity.postalCode)) filled++;
    if (f.country && identity.country && smartFill(f.country, identity.country)) filled++;
    return { filled };
  }

  ns.filler = {
    fillLogin,
    fillCard,
    fillIdentity,
    smartFill,        // exposed for the UI module when filling a single field
  };
})();
