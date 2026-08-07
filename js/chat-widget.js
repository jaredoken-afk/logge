/* Logge in-app chat widget.
   Injects a themed overlay into the host page and runs the conversational
   intake (same required-field logic as the homepage). Because the user is
   already signed in here, it skips the login gate and goes straight to the
   quote. Open it with window.LoggeChat.open(optionalPrefillText). */
(function () {
  "use strict";

  // Config (set on the host page before this script loads):
  //   window.LoggeChatConfig = { gate: true, redirect: "dashboard.html" }
  // gate=true   → guest flow: lock rates behind a login card (marketing site)
  // gate=false  → in-app flow: reveal rates immediately (dashboard, already signed in)
  var CFG = window.LoggeChatConfig || {};
  var GATE = CFG.gate === true;
  var REDIRECT = CFG.redirect || "dashboard.html";

  var MARK = '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="#04121a" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 7l9 4 9-4M12 11v10" stroke="#04121a" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var G_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>';
  var MS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>';

  // Build + inject the overlay markup.
  var host = document.createElement("div");
  host.innerHTML =
    '<div class="cw-overlay" id="cwOverlay" aria-hidden="true">' +
      '<div class="cw-modal" role="dialog" aria-modal="true" aria-label="New request">' +
        '<div class="cw-head">' +
          '<span class="cw-mark" aria-hidden="true">' + MARK + '</span>' +
          '<div><div class="cw-ttl">New request</div><div class="cw-sub">Logge · usually replies instantly</div></div>' +
          '<button class="cw-close" id="cwClose" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div>' +
        '<div class="cw-progress" id="cwProgress"><div class="cw-bar"><span id="cwFill"></span></div><div class="cw-plabel"><span class="cw-ptxt" id="cwText">Tell me about your shipment</span><span class="cw-pct" id="cwPct">0%</span></div></div>' +
        '<div class="cw-scroll" id="cwChat"></div>' +
        '<div class="cw-input"><textarea id="cwInput" rows="1" placeholder="Describe what you need to move or import…" aria-label="Your request"></textarea>' +
        '<button class="cw-send" id="cwSend" aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(host);

  var overlay = document.getElementById("cwOverlay");
  var modalEl = overlay.querySelector(".cw-modal");
  var chat = document.getElementById("cwChat");
  var input = document.getElementById("cwInput");
  var sendBtn = document.getElementById("cwSend");

  var started = false, phase = "intake", awaiting = null, data = {};

  var SLOTS = [
    { key: "goods",   ask: "First up — what are you shipping? A rough description and its value is plenty. Tell me too if it's fragile, hazardous, or needs refrigeration." },
    { key: "load",    ask: "How much is there? Give me the packaging and rough size — e.g. “6 pallets, about 1,200 kg, 1.2×1×1.5 m”. Weight and dimensions are the part I can't price without." },
    { key: "origin",  ask: "Where does it pick up from? A city or a full address both work." },
    { key: "dest",    ask: "And where's it heading — the final delivery point?" },
    { key: "ready",   ask: "When will it be ready to collect?" },
    { key: "terms",   ask: "Are you covering it the whole way, door to door — or does someone hand it over (or take over) at a port?" },
    { key: "storage", ask: "Last one — do you need it stored at the destination? If so, roughly how long, and does it need to stay in bond?" }
  ];
  var LABELS = { direction: "Type", goods: "Goods", load: "Load", origin: "From", dest: "To", ready: "Ready", terms: "Handover", storage: "Storage" };
  var suggestions = [
    "Import 300 chairs from Rotterdam to Sydney",
    "Send 5 pallets from Melbourne to Auckland",
    "Store 20 cartons for 3 months, then ship"
  ];

  function el(cls, html) { var d = document.createElement("div"); d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function tidy(s) { s = s.trim(); return s.charAt(0).toUpperCase() + s.slice(1); }

  function bot(html) { var m = el("cw-msg bot"); m.appendChild(el("cw-av", "L")); var b = el("cw-bubble"); b.innerHTML = html; m.appendChild(b); chat.appendChild(m); chat.scrollTop = chat.scrollHeight; return b; }
  function user(text) { var m = el("cw-msg user"); m.appendChild(el("cw-av", "You")); var b = el("cw-bubble"); b.textContent = text; m.appendChild(b); chat.appendChild(m); chat.scrollTop = chat.scrollHeight; }
  function typing() { var m = el("cw-msg bot"); m.appendChild(el("cw-av", "L")); var b = el("cw-bubble"); b.innerHTML = '<span class="cw-typing"><i></i><i></i><i></i></span>'; m.appendChild(b); chat.appendChild(m); chat.scrollTop = chat.scrollHeight; return m; }
  async function reply(html, delay) { var t = typing(); await sleep(delay || 900); t.remove(); return bot(html); }

  function prefill(text) {
    var t = " " + text.toLowerCase() + " ";
    if (!data.direction) { if (/\bimport/.test(t)) data.direction = "import"; else if (/\bexport/.test(t)) data.direction = "export"; }
    var from = t.match(/\bfrom\s+([a-z][a-z .'-]{1,28}?)(?=\s+to\b|,|\.| and | for |$)/);
    if (from && !data.origin) data.origin = tidy(from[1]);
    var to = t.match(/\bto\s+([a-z][a-z .'-]{1,28}?)(?=\s+and\b|,|\.| for | in |$)/);
    if (to && !data.dest) data.dest = tidy(to[1]);
    if (!data.load && /\d/.test(t) && /(kg|kilo|tonne|\bt\b|lb|cbm|m3|m³|container|20\s?ft|40\s?ft|20'|40')/.test(t)) data.load = text.trim();
    if (!data.ready && /(today|tomorrow|asap|next week|next month|this week|in \d+ (day|week|month)|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\d{1,2}[\/-]\d{1,2})/.test(t)) data.ready = text.trim();
    if (!data.terms && /\b(exw|fob|cif|cfr|fca|dap|ddp|dpu|cip|cpt|fas)\b/.test(t)) data.terms = text.trim();
    else if (!data.terms && /(door[ -]?to[ -]?door|all the way|the whole way)/.test(t)) data.terms = "door-to-door";
    if (!data.storage) {
      var hasStore = /(store|storage|warehouse|\bhold\b|in bond|bonded|3pl)/.test(t);
      var dur = /(\d+\s*(day|week|month|year)s?)/.test(t);
      if (hasStore && dur) data.storage = text.trim();
      else if (/\bno storage\b|don'?t need storage|no store|not storing/.test(t)) data.storage = "none";
    }
    if (!data.goods && (/\$|\bworth\b|\bvalue\b/.test(t) || /\d+\s*[a-z]{3,}/.test(t))) data.goods = text.trim();
  }

  function nextMissing() { for (var i = 0; i < SLOTS.length; i++) { if (!data[SLOTS[i].key]) return SLOTS[i]; } return null; }

  function updateProgress() {
    var fill = document.getElementById("cwFill"); if (!fill) return;
    var filled = SLOTS.filter(function (s) { return data[s.key]; }).length;
    var pct = Math.round((filled / SLOTS.length) * 100);
    fill.style.width = pct + "%";
    document.getElementById("cwPct").textContent = pct + "%";
    var box = document.getElementById("cwProgress"), txt = document.getElementById("cwText");
    if (pct >= 100) { txt.textContent = "Ready for your quote"; box.classList.add("done"); }
    else if (pct === 0) { txt.textContent = "Tell me about your shipment"; box.classList.remove("done"); }
    else { txt.textContent = "Building your quote…"; box.classList.remove("done"); }
  }

  function buildSummary() {
    var order = ["direction", "goods", "load", "origin", "dest", "ready", "terms", "storage"];
    return order.filter(function (k) { return data[k]; }).map(function (k) {
      var v = data[k] === "none" ? "not needed" : data[k];
      return "<br/>• <b>" + LABELS[k] + ":</b> " + escapeHtml(v);
    }).join("");
  }

  var optionEls = [];

  function priceCell(locked) {
    return locked
      ? '<div class="cw-locked">🔒</div><div class="cw-t">Log in for rate</div>'
      : '<div class="cw-p">Live rate ✓</div><div class="cw-t">' + (GATE ? "in your inbox" : "in Quotes") + '</div>';
  }

  function renderOptions(locked) {
    var store = data.storage && data.storage !== "none";
    var opts = [
      { rank: 1, route: "Sea FCL · door-to-door" + (store ? " + storage" : ""), tags: ["Best value", "~4–6 wks"], best: true },
      { rank: 2, route: "Sea LCL · door-to-door" + (store ? " + storage" : ""), tags: ["Part-load", "~5–7 wks"], best: false },
      { rank: 3, route: "Air · door-to-door" + (store ? " + storage" : ""), tags: ["Fastest", "~3–7 days"], best: false }
    ];
    var wrap = el("cw-results");
    optionEls = [];
    opts.forEach(function (o) {
      var card = el("cw-card" + (o.best ? " best" : ""));
      card.innerHTML =
        '<div class="cw-rank">' + o.rank + '</div>' +
        '<div><div class="cw-route">' + o.route + '</div>' +
        '<div class="cw-tags">' + o.tags.map(function (x) { return '<span class="cw-tag">' + x + '</span>'; }).join("") + '</div></div>' +
        '<div class="cw-rate">' + priceCell(locked) + '</div>';
      wrap.appendChild(card);
      optionEls.push(card);
    });
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  function unlockOptions() {
    optionEls.forEach(function (card) {
      var pc = card.querySelector(".cw-rate");
      if (pc) pc.innerHTML = priceCell(false);
    });
  }

  /* --- In-app flow (gate=false): reveal rates immediately --- */
  async function presentQuote() {
    phase = "done";
    await reply("That's everything I need — nice one." + buildSummary(), 950);
    await reply("Here are the ranked, door-to-door routings that fit — storage included:", 1050);
    renderOptions(false);
    await sleep(300);
    await reply("<b>Live rates</b> are ready — I've saved this to <b>Quotes</b> and emailed you a copy. Review the options above and hit Book when you're set. Before booking we'll confirm the paperwork: parties, commercial invoice, HS codes and importer of record.", 1150);
  }

  /* --- Guest flow (gate=true): show routes, then gate the rates behind login --- */
  async function presentGate() {
    phase = "auth";
    await reply("That's everything I need — nice one." + buildSummary(), 950);
    await reply("Here are the door-to-door routings that fit — storage included:", 1050);
    renderOptions(true);
    await sleep(1600);
    await reply("You're <b>100% quote-ready</b>. Log in to unlock your exact <b>live rates</b> and book — I never make a price up:", 1050);
    await sleep(450);
    renderAuthCard();
  }

  function renderAuthCard() {
    modalEl.classList.add("gate");
    var card = document.createElement("div");
    card.className = "cw-auth";
    card.innerHTML =
      '<div class="cw-ac-title">Log in to unlock your rates</div>' +
      '<div class="cw-ac-sub">Your ranked options are ready — sign in to reveal live pricing and book. New here? This creates your free account.</div>' +
      '<button class="cw-sso" type="button" data-p="Google">' + G_SVG + ' Continue with Google</button>' +
      '<button class="cw-sso" type="button" data-p="Microsoft">' + MS_SVG + ' Continue with Microsoft</button>' +
      '<div class="cw-divider">OR EMAIL</div>' +
      '<form class="cw-ac-form">' +
        '<input class="cw-ac-input" type="email" placeholder="Work email" aria-label="Work email" required />' +
        '<button class="cw-ac-submit" type="submit">Email me a sign-in link</button>' +
      '</form>' +
      '<div class="cw-ac-foot">No password needed — we\'ll email you a secure link.</div>';
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;

    card.querySelectorAll(".cw-sso").forEach(function (b) {
      b.addEventListener("click", function () { authSuccess("sso", b.getAttribute("data-p"), card); });
    });
    card.querySelector(".cw-ac-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = card.querySelector(".cw-ac-input").value.trim();
      if (!email) return;
      authSuccess("email", email, card);
    });
  }

  function authSuccess(method, value, card) {
    if (card) card.remove();
    modalEl.classList.remove("gate");
    if (method === "sso") {
      user("Continue with " + value);
      reply("Signing you in via " + value + "…", 700).then(function () { window.location.href = REDIRECT; });
      return;
    }
    phase = "done";
    user(value);
    revealRates("Magic link sent to <b>" + escapeHtml(value) + "</b> — tap it to finish signing in. Here are your live rates:");
  }

  async function revealRates(opening) {
    unlockOptions();
    await reply(opening, 950);
    await reply("Your ranked, all-in <b>live rates</b> are unlocked above — full breakdown is in your inbox and dashboard. Before booking we'll confirm the paperwork: parties, commercial invoice, HS codes and importer of record. Ready when you are.", 1150);
  }

  function renderSuggestions() {
    var wrap = el("cw-suggest");
    suggestions.forEach(function (s) {
      var chip = document.createElement("button");
      chip.className = "cw-chip"; chip.type = "button"; chip.textContent = s;
      chip.addEventListener("click", function () { wrap.remove(); handle(s); });
      wrap.appendChild(chip);
    });
    chat.appendChild(wrap);
  }

  async function handle(text) {
    text = (text || "").trim();
    if (!text) return;
    user(text);
    input.value = ""; input.style.height = "auto";
    if (phase !== "intake") {
      if (phase === "done") { await reply("Noted — I'll add that to your request.", 800); }
      return;
    }
    if (awaiting && !data[awaiting]) data[awaiting] = text;
    awaiting = null;
    prefill(text);
    updateProgress();
    var slot = nextMissing();
    if (slot) { awaiting = slot.key; await reply(slot.ask, 850); }
    else if (GATE) { await presentGate(); }
    else { await presentQuote(); }
  }

  async function openOverlay(prefillText) {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("cw-open");
    updateProgress();
    if (!started) {
      started = true;
      await sleep(250);
      await reply("Hey — I'm Logge. What are you looking to move or import? Describe it however you like.", 700);
      renderSuggestions();
    }
    input.focus();
    if (prefillText) { await sleep(400); handle(prefillText); }
  }
  function closeOverlay() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cw-open");
  }

  document.getElementById("cwClose").addEventListener("click", closeOverlay);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeOverlay(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay(); });
  sendBtn.addEventListener("click", function () { handle(input.value); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handle(input.value); } });
  input.addEventListener("input", function () { this.style.height = "auto"; this.style.height = Math.min(this.scrollHeight, 120) + "px"; });

  // Auto-wire any .js-start triggers on the page.
  document.querySelectorAll(".js-start").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); openOverlay(); });
  });

  window.LoggeChat = { open: function (prefillText) { openOverlay(prefillText); } };

  // Deep link: a URL with #start (optionally ?q=…) auto-opens the chat.
  (function initDeepLink() {
    if (location.hash.indexOf("start") === -1) return;
    var q = null;
    var m = location.search.match(/[?&]q=([^&]+)/);
    if (m) { try { q = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { q = null; } }
    openOverlay(q || undefined);
  })();
})();
