import {lazy, Suspense, useEffect, type JSX} from 'react';
import Layout from '@theme/Layout';
import {useHistory} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {isDevMode} from '@site/src/utils/devMode';

const TemplateEditorApp = isDevMode()
  ? lazy(() => import('@site/src/components/TemplateEditor/TemplateEditorApp'))
  : null;

/**
 * Dev-only template editor. In production builds, `isDevMode()` is false, the lazy
 * chunk is dropped, and visitors are redirected to the site home.
 */
export default function TemplateEditorPage(): JSX.Element | null {
  const history = useHistory();
  const home = useBaseUrl('/');

  useEffect(() => {
    if (!isDevMode()) {
      history.replace(home);
    }
  }, [history, home]);

  if (!isDevMode()) {
    return (
      <Layout title="FlixelGDX" description="Redirecting">
        <p>Redirecting…</p>
      </Layout>
    );
  }

  if (!TemplateEditorApp) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <Layout title="Template editor" description="Loading">
          <p>Loading template editor…</p>
        </Layout>
      }
    >
      <TemplateEditorApp />
    </Suspense>
  );
}
