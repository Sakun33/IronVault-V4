// IronVault form detector.
//
// Scans the page for four kinds of form: login, signup, credit-card, and
// identity/address. Each detected form is returned as a structured object
// that the UI module turns into a badge + picker, and the filler module
// uses to inject values.
//
// Detection priority:
//   1. autocomplete="..." attributes — the only fully reliable signal.
//   2. name / id / placeholder / aria-label / associated <label> text.
//   3. heuristic shape (e.g. 16-digit input near a 3-digit input = card).
//
// We expose everything on window.IronVaultAutofill.detector so the other
// content scripts (which run in the same isolated world) can call into it.

(() => {
  if (window.IronVaultAutofill && window.IronVaultAutofill.detector) return;
  const ns = (window.IronVaultAutofill = window.IronVaultAutofill || {});

  // ── Visibility / element utilities ────────────────────────────────────────
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.type === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 8) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    return true;
  }

  function fieldText(el) {
    if (!el) return '';
    const parts = [
      el.name, el.id, el.placeholder,
      el.getAttribute('aria-label'),
      el.getAttribute('autocomplete'),
      el.getAttribute('data-test'),
      el.getAttribute('data-testid'),
    ];
    // Associated label via for=…
    if (el.id) {
      const lbl = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (lbl) parts.push(lbl.textContent || '');
    }
    // Closest <label> wrapping the input
    const wrap = el.closest('label');
    if (wrap) parts.push(wrap.textContent || '');
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
  }

  function autocompleteToken(el) {
    const v = (el.getAttribute('autocomplete') || '').toLowerCase().trim();
    // Strip "section-*" and "shipping/billing" prefixes commonly added.
    return v.replace(/^section-\S+\s+/, '').replace(/^(shipping|billing)\s+/, '');
  }

  // ── Field-role classification ─────────────────────────────────────────────
  //
  // Each classifier returns null if no confident match, or a small object with
  // a "role" string the filler understands. Order matters — we run all matchers
  // and let later passes (form grouping) decide the form type.

  function classifyField(el) {
    const ac = autocompleteToken(el);
    const txt = fieldText(el);
    const type = (el.type || 'text').toLowerCase();

    // Password is the strongest signal — emit early so it can't be misread
    // as anything else (e.g. card cvv is type=text/tel).
    if (type === 'password') {
      // New-password vs current-password matters: signup forms need both.
      if (ac.includes('new-password') || /\b(new|create|confirm)\s*pass/.test(txt)) {
        return { role: 'newPassword' };
      }
      return { role: 'password' };
    }

    // ── Credit card fields ───────────────────────────────────────────────
    if (ac === 'cc-number' || /\b(card[\s_-]*number|cardnum|ccn|pan)\b/.test(txt)) {
      return { role: 'cardNumber' };
    }
    if (ac === 'cc-name' || ac === 'cc-holder' || /\b(cardholder|card\s*name|name on card|name_on_card)\b/.test(txt)) {
      return { role: 'cardHolder' };
    }
    if (ac === 'cc-csc' || ac === 'cc-cvc' || ac === 'cc-cvv' || /\b(cvv|cvc|csc|security[\s_-]*code|card[\s_-]*code)\b/.test(txt)) {
      return { role: 'cardCvv' };
    }
    if (ac === 'cc-exp' || /\b(expir[ye]|exp[\s_-]*date)\b/.test(txt) && !/(month|year|mm|yy)/.test(txt)) {
      return { role: 'cardExp' };
    }
    if (ac === 'cc-exp-month' || /\b(exp[\s_-]*month|expiry[\s_-]*month|card[\s_-]*month|cc[\s_-]*month|\bmm\b)/.test(txt)) {
      return { role: 'cardExpMonth' };
    }
    if (ac === 'cc-exp-year' || /\b(exp[\s_-]*year|expiry[\s_-]*year|card[\s_-]*year|cc[\s_-]*year|\byy(yy)?\b)/.test(txt)) {
      return { role: 'cardExpYear' };
    }

    // ── Identity / address fields ────────────────────────────────────────
    if (ac === 'given-name' || /\b(first[\s_-]*name|fname|given[\s_-]*name)\b/.test(txt)) {
      return { role: 'firstName' };
    }
    if (ac === 'family-name' || /\b(last[\s_-]*name|lname|surname|family[\s_-]*name)\b/.test(txt)) {
      return { role: 'lastName' };
    }
    if (ac === 'name' || /\b(full[\s_-]*name|your[\s_-]*name|^name$)\b/.test(txt)) {
      return { role: 'fullName' };
    }
    if (ac === 'tel' || ac === 'tel-national' || type === 'tel' || /\b(phone|mobile|tel(ephone)?|contact[\s_-]*number)\b/.test(txt)) {
      return { role: 'phone' };
    }
    if (ac === 'address-line1' || ac === 'street-address' || /\b(address[\s_-]*line[\s_-]*1|street[\s_-]*address|^address$|addr1)\b/.test(txt)) {
      return { role: 'address1' };
    }
    if (ac === 'address-line2' || /\b(address[\s_-]*line[\s_-]*2|apt|suite|unit|addr2)\b/.test(txt)) {
      return { role: 'address2' };
    }
    if (ac === 'address-level2' || /\b(city|town|locality)\b/.test(txt)) {
      return { role: 'city' };
    }
    if (ac === 'address-level1' || /\b(state|province|region|county)\b/.test(txt)) {
      return { role: 'state' };
    }
    if (ac === 'postal-code' || /\b(zip[\s_-]*code|zip|postal[\s_-]*code|postcode|pincode|pin[\s_-]*code)\b/.test(txt)) {
      return { role: 'postalCode' };
    }
    if (ac === 'country' || ac === 'country-name' || /\b(country)\b/.test(txt)) {
      return { role: 'country' };
    }

    // ── Auth-username candidates (email or text) ─────────────────────────
    if (ac === 'username' || ac === 'email' || type === 'email' ||
        /\b(email|username|user[\s_-]*name|login|user[\s_-]*id|account[\s_-]*id)\b/.test(txt)) {
      return { role: 'username' };
    }

    return null;
  }

  // ── Form grouping ─────────────────────────────────────────────────────────
  //
  // Group fields by their enclosing <form>. If a field has no form (very
  // common in modern SPAs that use plain <div> wrappers), we cluster it into
  // a synthetic group identified by the closest sectioning ancestor.

  function getGroupKey(el) {
    if (el.form) return el.form;
    // Walk up for a sectioning container so nearby inputs cluster together.
    let n = el;
    while (n && n !== document.body) {
      n = n.parentElement;
      if (!n) break;
      const tag = n.tagName;
      if (tag === 'FORM' || tag === 'FIELDSET' || tag === 'SECTION' ||
          tag === 'ARTICLE' || tag === 'DIALOG' || tag === 'MAIN') {
        return n;
      }
      if (n.getAttribute && n.getAttribute('role') === 'dialog') return n;
    }
    return document.body; // last resort — one giant group
  }

  function detectForms() {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'))
      .filter(isVisible);
    if (inputs.length === 0) return [];

    const groups = new Map(); // groupEl → { fields: [{el, role}], roles: Set }
    for (const el of inputs) {
      const c = classifyField(el);
      if (!c) continue;
      const key = getGroupKey(el);
      let g = groups.get(key);
      if (!g) { g = { groupEl: key, fields: [], roles: new Set() }; groups.set(key, g); }
      g.fields.push({ el, role: c.role });
      g.roles.add(c.role);
    }

    const detections = [];
    for (const g of groups.values()) {
      const det = classifyGroup(g);
      if (det) detections.push(det);
    }
    return detections;
  }

  // Decide what kind of form each group represents, and pick the anchor field
  // that the badge will attach to.
  function classifyGroup(g) {
    const has = (r) => g.roles.has(r);
    const find = (r) => {
      const m = g.fields.find(f => f.role === r);
      return m ? m.el : null;
    };

    // Credit card — strongest signal is cardNumber, but tolerate cards that
    // only expose cvv (rare but exists for "verify card" forms).
    if (has('cardNumber') || (has('cardCvv') && (has('cardExp') || has('cardExpMonth')))) {
      return {
        type: 'card',
        groupEl: g.groupEl,
        anchor: find('cardNumber') || find('cardCvv'),
        fields: {
          number: find('cardNumber'),
          holder: find('cardHolder'),
          exp: find('cardExp'),
          expMonth: find('cardExpMonth'),
          expYear: find('cardExpYear'),
          cvv: find('cardCvv'),
          zip: find('postalCode'),
        },
      };
    }

    // Signup — has new password and (often) a confirm password.
    const newPwInputs = g.fields.filter(f => f.role === 'newPassword').map(f => f.el);
    const regularPwInputs = g.fields.filter(f => f.role === 'password').map(f => f.el);
    const allPwInputs = newPwInputs.concat(regularPwInputs);
    if (has('newPassword') || allPwInputs.length >= 2) {
      return {
        type: 'signup',
        groupEl: g.groupEl,
        anchor: allPwInputs[0] || find('username'),
        fields: {
          username: find('username'),
          password: allPwInputs[0] || null,
          confirmPassword: allPwInputs[1] || null,
        },
      };
    }

    // Login — at least one password field, optional username.
    if (has('password')) {
      return {
        type: 'login',
        groupEl: g.groupEl,
        anchor: find('password'),
        fields: {
          username: find('username'),
          password: find('password'),
        },
      };
    }

    // Identity — must have at least two address/contact role fields to count.
    // This keeps us from showing a badge on every search box that happens to
    // look like a "name" input.
    const identityRoles = ['firstName', 'lastName', 'fullName', 'phone',
      'address1', 'address2', 'city', 'state', 'postalCode', 'country'];
    const identityHits = identityRoles.filter(r => has(r));
    if (identityHits.length >= 2) {
      // Anchor preference: a name field, then address1, then phone.
      const anchor = find('firstName') || find('fullName') ||
                     find('lastName') || find('address1') || find('phone');
      return {
        type: 'identity',
        groupEl: g.groupEl,
        anchor,
        fields: {
          firstName: find('firstName'),
          lastName: find('lastName'),
          fullName: find('fullName'),
          email: find('username'), // email matched as username role
          phone: find('phone'),
          address1: find('address1'),
          address2: find('address2'),
          city: find('city'),
          state: find('state'),
          postalCode: find('postalCode'),
          country: find('country'),
        },
      };
    }

    return null;
  }

  ns.detector = {
    detectForms,
    isVisible,
    classifyField,        // exposed for unit tests / debugging
  };
})();
