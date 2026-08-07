(function () {
  "use strict";

  /* ---- Nav scroll state ---- */
  var hdr = document.getElementById("hdr");
  window.addEventListener("scroll", function () {
    hdr.classList.toggle("scrolled", window.scrollY > 12);
  });

  /* ---- Reveal on scroll ---- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  /* ---- Hero chat demo (auto-playing showcase) ---- */
  var chat = document.getElementById("chat");
  var prompts = [
    {
      text: "Import 300 chairs from Rotterdam and store them in a Sydney warehouse",
      results: [
        { rank: 1, route: "Rotterdam → Sydney · Sea FCL + 3PL storage", tags: ["32 days", "Bonded warehouse", "Door-to-door"], price: "$6,240", per: "all-in", best: true },
        { rank: 2, route: "Rotterdam → Sydney · Sea LCL + 3PL storage", tags: ["38 days", "Shared container", "Flexible"], price: "$5,180", per: "all-in", best: false },
        { rank: 3, route: "Rotterdam → Sydney · Air + short-term store", tags: ["6 days", "Fastest", "Premium"], price: "$14,900", per: "all-in", best: false }
      ]
    },
    {
      text: "Export 40 pallets to Auckland and hold the balance in bond",
      results: [
        { rank: 1, route: "Melbourne → Auckland · Sea FCL + bonded hold", tags: ["9 days", "Bond storage", "Door-to-door"], price: "$4,720", per: "all-in", best: true },
        { rank: 2, route: "Melbourne → Auckland · Sea LCL + bonded hold", tags: ["12 days", "Part-load", "Lower cost"], price: "$3,410", per: "all-in", best: false },
        { rank: 3, route: "Sydney → Auckland · Air + bonded hold", tags: ["3 days", "Fastest", "Premium"], price: "$11,250", per: "all-in", best: false }
      ]
    }
  ];

  function el(cls, html) { var d = document.createElement("div"); d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function botMsg(html) {
    var m = el("msg bot");
    m.appendChild(el("av", "L"));
    var b = el("bubble"); b.innerHTML = html; m.appendChild(b);
    chat.appendChild(m); return b;
  }

  async function typeUser(text) {
    var m = el("msg user");
    m.appendChild(el("av", "You"));
    var b = el("bubble cursor"); m.appendChild(b);
    chat.appendChild(m);
    for (var i = 0; i < text.length; i++) {
      b.textContent = text.slice(0, i + 1);
      await sleep(22 + Math.random() * 30);
    }
    b.classList.remove("cursor");
  }

  async function typingDots() {
    var m = el("msg bot");
    m.appendChild(el("av", "L"));
    var b = el("bubble"); b.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; m.appendChild(b);
    chat.appendChild(m);
    await sleep(1100);
    m.remove();
  }

  function renderResults(results) {
    var wrap = el("results");
    results.forEach(function (r) {
      var card = el("result-card" + (r.best ? " best" : ""));
      card.innerHTML =
        '<div class="rc-rank">' + r.rank + '</div>' +
        '<div class="rc-main"><div class="rc-route">' + r.route + (r.best ? ' <span class="badge-best">Best value</span>' : '') + '</div>' +
        '<div class="rc-tags">' + r.tags.map(function (t) { return '<span class="rc-tag">' + t + '</span>'; }).join("") + '</div></div>' +
        '<div class="rc-price"><div class="p">' + r.price + '</div><div class="t">' + r.per + '</div></div>';
      wrap.appendChild(card);
    });
    return wrap;
  }

  async function runDemo() {
    var idx = 0;
    while (true) {
      var p = prompts[idx % prompts.length];
      chat.innerHTML = "";
      await sleep(500);
      await typeUser(p.text);
      await sleep(400);
      await typingDots();
      var b = botMsg("Got it — sourcing door-to-door options across freight and storage.");
      await sleep(700);
      var r = renderResults(p.results);
      chat.appendChild(r);
      await sleep(500);
      botMsg('<span style="color:var(--muted)">Every price above is sourced from live rates — not estimated. Ready to book option 1?</span>');
      await sleep(5200);
      idx++;
    }
  }
  if (chat) runDemo();

  /* ---- Feature toggle (import / export) ---- */
  var features = {
    import: [
      { t: "Landed &amp; stored, in one quote", d: "Origin pickup, ocean or air, customs, delivery and warehousing — priced as a single door-to-door solution." },
      { t: "Bonded &amp; 3PL storage", d: "Hold goods in bond or long-term, compare warehouse options right beside the freight legs." },
      { t: "Customs-aware", d: "The intake flow captures what clearance needs, so nothing stalls at the border." }
    ],
    export: [
      { t: "Corridor-ready quoting", d: "Export lanes across your trade corridors, with the storage balance held wherever it makes sense." },
      { t: "Hold the balance in bond", d: "Ship part now, store the rest — Logge quotes the split without a second conversation." },
      { t: "Docs drafted for you", d: "AI drafts the RFQs and paperwork for legs with no API, so agents and truckers respond fast." }
    ]
  };
  var lanes = {
    import: [
      { ic: "🏭", cap: "Rotterdam" }, { ic: "🚢", cap: "Ocean" }, { ic: "🛃", cap: "Customs" }, { ic: "🏬", cap: "Sydney store" }
    ],
    export: [
      { ic: "🏢", cap: "Melbourne" }, { ic: "🚛", cap: "Road" }, { ic: "🚢", cap: "Sea" }, { ic: "🔒", cap: "Bonded hold" }
    ]
  };
  var captions = {
    import: "One conversation → landed and stored, door-to-door.",
    export: "Ship part now, hold the balance in bond — quoted together."
  };

  var featureList = document.getElementById("featureList");
  var fvLane = document.getElementById("fvLane");
  var fvCaption = document.getElementById("fvCaption");

  function paintFeatures(mode) {
    featureList.innerHTML = features[mode].map(function (f) {
      return '<div class="feature-item"><div class="ic">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>' +
        '</div><div><h4>' + f.t + '</h4><p>' + f.d + '</p></div></div>';
    }).join("");
    var nodes = lanes[mode];
    var html = "";
    nodes.forEach(function (n, i) {
      html += '<div class="fv-node"><div class="ring" style="font-size:22px">' + n.ic + '</div><div class="cap">' + n.cap + '</div></div>';
      if (i < nodes.length - 1) html += '<div class="fv-line"></div>';
    });
    fvLane.innerHTML = html;
    fvCaption.textContent = captions[mode];
  }
  paintFeatures("import");

  document.getElementById("toggle").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    this.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    paintFeatures(btn.dataset.mode);
  });

  /* ---- Mobile menu (simple scroll) ---- */
  document.getElementById("mtoggle").addEventListener("click", function () {
    location.hash = "#how";
  });

  // The Get-started chat is handled by the shared widget (chat-widget.js),
  // which auto-wires every .js-start button on the page.
})();
