import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PropsWithChildren } from 'react';

type ProductShellProps = PropsWithChildren<{
  mode?: 'application' | 'demo';
  activeItem?: string;
  onNavigate?: (item: string) => void;
  navigationItems?: string[];
  navigationDividerBefore?: string;
  userLabel?: string;
  profileImageUrl?: string;
  onProfile?: () => void;
  onSignOut?: () => void | Promise<void>;
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  productName?: string;
  logoUrl?: string;
  version?: string;
  edition?: 'community' | 'enterprise';
  navigationLabel?: (item: string) => string;
  labels?: Partial<ProductShellLabels>;
}>;

type ProductShellLabels = {
  demoReadOnly: string;
  visitedViews: string;
  previousView: string;
  nextView: string;
  openMainMenu: string;
  openUserMenu: string;
  userMenu: string;
  profile: string;
  signOut: string;
  closeMainMenu: string;
  mainNavigation: string;
  menu: string;
};

const defaultNavigationItems = ['Overview', 'Tasks', 'Organization', 'Personnel', 'Reports'];
const defaultLabels: ProductShellLabels = {
  demoReadOnly: 'Demo · read-only',
  visitedViews: 'Visited main views',
  previousView: 'Previous main view',
  nextView: 'Next main view',
  openMainMenu: 'Open main menu',
  openUserMenu: 'Open user menu',
  userMenu: 'User menu',
  profile: 'Profile',
  signOut: 'Sign out',
  closeMainMenu: 'Close main menu',
  mainNavigation: 'Main navigation',
  menu: 'Menu',
};

export function userInitials(userLabel: string) {
  const nameParts = userLabel.trim().split(/\s+/).filter(Boolean);

  if (nameParts.length === 0) return '';
  if (nameParts.length === 1) return Array.from(nameParts[0]).slice(0, 2).join('').toLocaleUpperCase();

  const firstInitial = Array.from(nameParts[0])[0] ?? '';
  const lastInitial = Array.from(nameParts[nameParts.length - 1])[0] ?? '';
  return `${firstInitial}${lastInitial}`.toLocaleUpperCase();
}

export function ProductShell({ children, mode = 'application', activeItem = 'Overview', onNavigate, navigationItems = defaultNavigationItems, navigationDividerBefore, userLabel = 'MK', profileImageUrl, onProfile, onSignOut, onPrevious, onNext, canPrevious = false, canNext = false, productName = 'Fylkren', logoUrl, version = '0.14.0', edition = 'community', navigationLabel = item => item, labels: labelOverrides }: ProductShellProps) {
  const labels = { ...defaultLabels, ...labelOverrides };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 850px), (max-height: 520px) and (pointer: coarse)');
    const update = () => { setIsMobile(query.matches); if (!query.matches) setMobileMenuOpen(false); };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => navigationRef.current?.querySelector<HTMLElement>('.mobile-navigation-close')?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileMenuOpen]);

  useEffect(() => setMobileMenuOpen(false), [activeItem]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  function closeMobileMenu(restoreFocus = false) {
    setMobileMenuOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  function trapMobileNavigation(event: KeyboardEvent<HTMLElement>) {
    if (!isMobile || !mobileMenuOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMobileMenu(true); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(navigationRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="product-shell">
      <header className="title-bar">
        <span className={logoUrl ? 'product-mark custom-logo' : 'product-mark'} aria-hidden="true">{logoUrl ? <img alt="" src={logoUrl} /> : productName.slice(0, 1).toUpperCase()}</span>
        <strong>{productName}</strong>
        {mode === 'demo' && <span className="demo-badge">{labels.demoReadOnly}</span>}
        {mode === 'application' && <nav className="view-history-navigation" aria-label={labels.visitedViews}>
          <button type="button" aria-label={labels.previousView} title={labels.previousView} disabled={!canPrevious} onClick={onPrevious}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/><path d="M9 12h9"/></svg></button>
          <button type="button" aria-label={labels.nextView} title={labels.nextView} disabled={!canNext} onClick={onNext}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/><path d="M15 12H6"/></svg></button>
        </nav>}
        <button ref={menuButtonRef} className="mobile-navigation-toggle" type="button" aria-label={labels.openMainMenu} aria-controls="fylkren-main-navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div className="account-menu-container" ref={accountMenuRef}>
          <button className="profile-button" type="button" aria-label={labels.openUserMenu} aria-haspopup="menu" aria-expanded={accountMenuOpen} disabled={!onProfile && !onSignOut} onClick={() => setAccountMenuOpen(open => !open)}>
            {profileImageUrl ? <img alt="" src={profileImageUrl} /> : userInitials(userLabel)}
          </button>
          {accountMenuOpen && <div className="account-menu" role="menu" aria-label={labels.userMenu}>
            {onProfile && <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); onProfile(); }}>{labels.profile}</button>}
            {onSignOut && <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); void onSignOut(); }}>{labels.signOut}</button>}
          </div>}
        </div>
      </header>
      <div className="workspace">
        {mobileMenuOpen && <button className="mobile-navigation-backdrop" type="button" aria-label={labels.closeMainMenu} onClick={() => closeMobileMenu(true)} />}
        <nav ref={navigationRef} id="fylkren-main-navigation" className={mobileMenuOpen ? 'side-navigation mobile-open' : 'side-navigation'} aria-label={labels.mainNavigation} aria-hidden={isMobile && !mobileMenuOpen ? true : undefined} onKeyDown={trapMobileNavigation}>
          <div className="mobile-navigation-heading"><strong>{labels.menu}</strong><button className="mobile-navigation-close" type="button" aria-label={labels.closeMainMenu} onClick={() => closeMobileMenu(true)}>×</button></div>
          {navigationItems.map(item => (
            <Fragment key={item}>
              {item === navigationDividerBefore && <div className="navigation-divider" role="separator" />}
              <a
              aria-current={item === activeItem ? 'page' : undefined}
              className={item === activeItem ? 'navigation-item active' : 'navigation-item'}
              href={`#${item.toLowerCase()}`}
              tabIndex={isMobile && !mobileMenuOpen ? -1 : undefined}
              onClick={event => {
                event.preventDefault();
                onNavigate?.(item);
                closeMobileMenu();
              }}
            >
              {navigationLabel(item)}
              </a>
            </Fragment>
          ))}
          <div className="navigation-footer">
            <span className="environment-label">{mode === 'demo' ? `Fylkren Demo (${version})` : `Fylkren (${version})`}</span>
            {mode === 'application' && <span className="edition-label">{edition === 'enterprise' ? 'Enterprise' : 'Community'}</span>}
          </div>
        </nav>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
