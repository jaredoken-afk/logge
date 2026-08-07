(function () {
  "use strict";

  // "New request" opens the in-app chat widget (themed to this page) rather
  // than bouncing to the marketing homepage. Falls back to a redirect if the
  // widget script hasn't loaded for any reason.
  function openChat(prefill) {
    if (window.LoggeChat) { window.LoggeChat.open(prefill); }
    else { window.location.href = prefill ? "index.html?q=" + encodeURIComponent(prefill) + "#start" : "index.html#start"; }
  }

  var newBtn = document.getElementById("newBtn");
  if (newBtn) {
    newBtn.addEventListener("click", function () { openChat(); });
  }

  var nrForm = document.getElementById("nrForm");
  if (nrForm) {
    nrForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = nrForm.querySelector("input").value.trim();
      nrForm.reset();
      openChat(v || undefined);
    });
  }

  // Sidebar active-state (visual only for now).
  document.querySelectorAll(".nav a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      document.querySelectorAll(".nav a").forEach(function (x) { x.classList.remove("active"); });
      a.classList.add("active");
    });
  });
})();
