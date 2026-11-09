// Applies the saved theme before first paint so the app never flashes the wrong colours.
(function () {
  try {
    var m = localStorage.getItem("ledger.theme") || "system";
    var dark = m === "dark" || (m === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {}
})();
