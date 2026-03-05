export const NAV_TARGETS = Object.freeze({
  guides: '/blog',
  professionals: '/professionals',
  heating: '/thermansi',
  contact: '/epikoinonia'
});

export const TOP_NAV_LINKS = Object.freeze([
  { label: 'Οδηγοί', href: NAV_TARGETS.guides },
  { label: 'Επαγγελματίες', href: NAV_TARGETS.professionals }
]);

export const PRIMARY_NAV_LINKS = Object.freeze([
  { label: 'Αρχική', href: '/' },
  { label: 'Υπηρεσίες', href: '/#services' },
  { label: 'Επαγγελματίες', href: NAV_TARGETS.professionals },
  { label: 'Οδηγοί', href: NAV_TARGETS.guides },
  { label: 'Επικοινωνία', href: NAV_TARGETS.contact }
]);

export const NAV_ALIAS_REDIRECTS = Object.freeze({
  '/odigoi': NAV_TARGETS.guides,
  '/guides': NAV_TARGETS.guides,
  '/epaggelmaties': NAV_TARGETS.professionals,
  '/pros': NAV_TARGETS.professionals,
  '/heating': NAV_TARGETS.heating,
  '/technikoi-thermansis': NAV_TARGETS.heating,
  '/techniki-thermansis': NAV_TARGETS.heating,
  '/contact': NAV_TARGETS.contact,
  '/epikoinise': NAV_TARGETS.contact,
  '/epikoinonia-forma': NAV_TARGETS.contact
});

export const NAV_PLACEHOLDER_TEXT = Object.freeze([
  'coming soon',
  'under construction',
  'work in progress',
  'υπό κατασκευή'
]);
