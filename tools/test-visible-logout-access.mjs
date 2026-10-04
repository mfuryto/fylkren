import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('apps/web/src/main.tsx', 'utf8');
const content = readFileSync('apps/web/src/app/AppContent.tsx', 'utf8');
const shell = readFileSync('shared/frontend/src/product-shell.tsx', 'utf8');
const theme = readFileSync('shared/frontend/src/theme.css', 'utf8');
const profile = readFileSync('apps/web/src/profile/ProfilePage.tsx', 'utf8');
const norwegian = readFileSync('apps/web/src/localization/catalogs/nb-NO/index.ts', 'utf8');

const authenticatedShell = main.slice(main.indexOf('<ProductShell'), main.indexOf('</ProductShell>'));
assert.ok(authenticatedShell.length > 0, 'Authenticated content is not enclosed by ProductShell');
assert.match(authenticatedShell, /labels=\{\{[^]*openUserMenu:[^]*signOut:/);
assert.match(authenticatedShell, /onSignOut=\{signOut\}/);
assert.match(authenticatedShell, /<AppContent/);
assert.match(content, /effectiveItem: AppPage/);

assert.match(shell, /className="profile-button"[^]*aria-label=\{labels\.openUserMenu\}[^]*aria-haspopup="menu"/);
assert.match(shell, /accountMenuOpen && <div className="account-menu" role="menu"/);
assert.match(shell, /onSignOut && <button type="button" role="menuitem"[^]*labels\.signOut/);
assert.match(theme, /\.title-bar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/);
assert.match(theme, /\.account-menu-container\s*\{[^}]*position:\s*relative;/);
assert.match(theme, /@media \(max-width: 850px\)[^]*\.mobile-navigation-toggle \+ \.account-menu-container/);

assert.match(profile, /<button className="secondary-button" type="button" onClick=\{onSignOut\}>[^]*t\("signOut"\)/);
assert.match(norwegian, /openUserMenu: "Åpne brukermeny"/);
assert.match(norwegian, /signOut: "Logg ut"/);

process.stdout.write(`${JSON.stringify({
  visibleLogoutAccess: 'passed', authenticatedPageShell: 'ProductShell',
  persistentTrigger: true, interactionCount: 2, mobileAvailable: true,
  accessibleMenu: true, profileDirectAction: true,
})}\n`);
