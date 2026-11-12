// Applies a saved light/dark choice (ThemeToggle.jsx) before the page draws, so there's no
// flash of the wrong theme. A separate file rather than an inline <script> so the site's
// Content-Security-Policy can forbid inline scripts entirely (server/src/security.js).
try {
  var savedTheme = localStorage.getItem('krew-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
} catch (e) {}
