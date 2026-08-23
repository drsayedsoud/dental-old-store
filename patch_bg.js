const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const cssToAdd = `
.bg-pattern {
  position: relative;
  overflow: hidden;
  background: var(--bg) !important;
}
.bg-pattern::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url('/bg-pattern.jpg');
  background-size: cover;
  background-position: center;
  opacity: 0.8; /* We use a higher opacity since it's colorful, but we blend it */
  mix-blend-mode: multiply;
  z-index: 0;
  pointer-events: none;
}
body.dark .bg-pattern::before {
  opacity: 0.15;
  mix-blend-mode: screen;
}
.bg-pattern > * {
  position: relative;
  z-index: 1;
}
`;

if(!html.includes('.bg-pattern {')){
    html = html.replace('</style>', cssToAdd + '\n</style>');
}

// Add the class to page-splash and page-login
html = html.replace('<div class="page active" id="page-splash"', '<div class="page active bg-pattern" id="page-splash"');
html = html.replace('<div class="page" id="page-login"', '<div class="page bg-pattern" id="page-login"');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Patched html');
