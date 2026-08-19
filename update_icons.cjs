const fs = require('fs');
let content = fs.readFileSync('src/hub/account.ts', 'utf8');

const iconFunc = `
function accountMenuIcon(type: string, isDanger: boolean = false): string {
  if (!type) return ''; // for languages that don't have an icon

  let path = '';
  if (type === 'faq') {
    path = '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
  } else if (type === 'support') {
    path = '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/><path d="M14 22h-4"/>';
  } else if (type === 'pricing') {
    path = '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>';
  } else if (type === 'subscription') {
    path = '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>';
  } else if (type === 'settings') {
    path = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
  } else if (type === 'terms') {
    path = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>';
  } else if (type === 'privacy') {
    path = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
  } else if (type === 'about' || type === 'appinfo') {
    path = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
  } else if (type === 'logout') {
    path = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>';
  } else if (type === 'identity') {
    path = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  } else if (type === 'invite') {
    path = '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>';
  } else if (type === 'language') {
    path = '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';
  } else if (type === 'sound') {
    path = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  } else if (type === 'notifications') {
    path = '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>';
  } else if (type === 'tournament') {
    path = '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>';
  } else if (type === 'challenge') {
    path = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>';
  } else if (type === 'rewards') {
    path = '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>';
  } else {
    // Fallback if not recognized
    return \`<div class="acct-menu-ico-wrap"><span class="acct-menu-ico">\${type}</span></div>\`;
  }

  const bgColors = isDanger ? 'linear-gradient(135deg, rgba(255, 235, 235, 0.95), rgba(255, 220, 220, 0.8))' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 245, 250, 0.8))';
  const shadowColor = isDanger ? 'rgba(214, 69, 69, 0.15)' : 'rgba(0, 186, 81, 0.12)';
  const strokeColor = isDanger ? '#d64545' : '#142a1d';
  const borderColor = isDanger ? 'rgba(214, 69, 69, 0.2)' : 'rgba(0, 186, 81, 0.2)';
  const glowColor = isDanger ? 'rgba(214, 69, 69, 0.15)' : 'rgba(0, 186, 81, 0.15)';

  return \`
    <div class="acct-icon-premium" style="
      width: 38px; 
      height: 38px; 
      border-radius: 12px; 
      background: \${bgColors}; 
      box-shadow: 
        0 4px 10px \${shadowColor},
        inset 0 1px 0 rgba(255,255,255,1),
        inset 0 -1px 2px rgba(0,0,0,0.05);
      border: 1px solid \${borderColor};
      display: grid;
      place-items: center;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      margin-right: 0.2rem;
    ">
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at top left, \${glowColor}, transparent 70%);"></div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="\${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 1;">
        \${path}
      </svg>
    </div>
  \`;
}
`;

if (!content.includes('function accountMenuIcon(')) {
  content = content.replace('function accountRowHtml', iconFunc + '\nfunction accountRowHtml');
}

// Update accountRowHtml implementation
content = content.replace(
  /<div class="acct-menu-ico-wrap"><span class="acct-menu-ico">\$\{icon\}<\/span><\/div>/g,
  '${accountMenuIcon(icon, isDanger)}'
);

// Update settingsRowHtml implementation
content = content.replace(
  /<div class="acct-menu-ico-wrap">\$\{icon \? `<span class="acct-menu-ico">\$\{icon\}<\/span>` : ''\}<\/div>/g,
  '${icon ? accountMenuIcon(icon) : \'\'}'
);

const replacements = {
  "'👤'": "'identity'",
  "'💌'": "'invite'",
  "'❓'": "'support'",
  "'💬'": "'faq'",
  "'🏷️'": "'pricing'",
  "'🔄'": "'subscription'",
  "'ℹ️'": "'about'",
  "'📄'": "'terms'",
  "'⚙️'": "'settings'",
  "'🚪'": "'logout'",
  "'🌍'": "'language'",
  "'🔊'": "'sound'",
  "'🔔'": "'notifications'",
  "'🔒'": "'privacy'",
  "'📱'": "'appinfo'",
  "'🏆'": "'tournament'",
  "'🎯'": "'challenge'",
  "'🎁'": "'rewards'"
};

for (const [k, v] of Object.entries(replacements)) {
  content = content.split(k).join(v);
}

fs.writeFileSync('src/hub/account.ts', content, 'utf8');
console.log('Updated account.ts with SVG icons!');
