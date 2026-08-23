const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const welcomeModalHTML = `
<!-- Welcome Modal -->
<div class="custom-modal" id="welcome-modal" onclick="if(event.target===this) this.classList.remove('open')">
  <div class="custom-sheet" style="text-align: center; max-width: 400px; padding: 30px 20px;">
    <h3 style="color: var(--primary); margin-bottom: 15px; font-size: 1.4rem;">أهلاً وسهلاً بك يا <span id="welcome-username"></span>! 🎉</h3>
    <p style="color: #475569; margin-bottom: 25px; line-height: 1.6; font-size: 1.1rem;">يمكنك الآن نشر إعلان والتعليق والمشاركة داخل الموقع.</p>
    <button class="btn" style="width: 100%; border-radius: 20px; font-size: 1.1rem; padding: 12px;" onclick="$('welcome-modal').classList.remove('open')">دخول</button>
  </div>
</div>
`;

if (!html.includes('id="welcome-modal"')) {
    html = html.replace('</body>', welcomeModalHTML + '\n</body>');
}

html = html.replace(
    "toast('تم تسجيل الدخول بنجاح! 👋', 'ok');",
    `$('welcome-username').textContent = maskName(result.user.displayName || 'صديقنا');\n    $('welcome-modal').classList.add('open');`
);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Patched');
