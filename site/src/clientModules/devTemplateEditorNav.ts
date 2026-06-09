import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

/**
 * Injects the template editor link into the navbar on every route in dev.
 * themeConfig.navbar is evaluated at build time and can omit dev-only items
 * from the client bundle; this module runs only when NODE_ENV is development.
 */
function inject(): void {
  if (process.env.NODE_ENV !== 'development') return;
  const right = document.querySelector('.navbar__items--right');
  if (!right || right.querySelector('[data-dev-template-editor-nav]')) return;

  const brand = document.querySelector<HTMLAnchorElement>('a.navbar__brand');
  let prefix = '';
  if (brand?.pathname) {
    prefix = brand.pathname.replace(/\/$/, '');
  }
  const href = `${prefix}/template-editor`.replace(/([^:]\/)\/+/g, '$1');

  const a = document.createElement('a');
  a.setAttribute('data-dev-template-editor-nav', '1');
  a.className = 'navbar__item navbar__link';
  a.href = href;
  a.textContent = 'Template editor (dev)';
  right.insertBefore(a, right.firstChild);
}

if (ExecutionEnvironment.canUseDOM && process.env.NODE_ENV === 'development') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
  window.addEventListener('docusaurus:routeDidUpdate', inject);
}

export default function devTemplateEditorNav(): void {
  /* clientModules may import default; side effects already ran above */
}
