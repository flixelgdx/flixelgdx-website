import type {Config, PluginConfig} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {githubLight, githubDark} from './src/prismThemes';
import remarkDocletmdColors from './plugins/remark-docletmd-colors';

const devTemplateEditorPlugins: PluginConfig[] =
  process.env.NODE_ENV === 'development' ? [['./plugins/dev-template-editor-api', {}]] : [];

const config: Config = {
  title: 'FlixelGDX',
  tagline:
    'The most powerful Java game development framework, designed for beginners and experts alike.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://flixelgdx.org',
  baseUrl: '/',

  organizationName: 'flixelgdx',
  projectName: 'flixelgdx-website',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: false,
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  clientModules: ['./src/clientModules/devTemplateEditorNav.ts'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/flixelgdx/flixelgdx-website/tree/main/site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        searchResultLimits: 10,
        docsRouteBasePath: ['docs', 'api'],
      },
    ],
  ],

  plugins: [
    ...devTemplateEditorPlugins,
    // Single docs plugin for the entire API reference (welcome page +
    // every module's generated content). Per-module sidebars are still
    // distinct because each top-level module folder (core / lwjgl3 /
    // teavm / android / ios) gets its own auto-generated tree. The
    // "Module" dropdown in the navbar just links to those URLs.
    //
    // Hand-written `api/index.mdx` runs through MDX (it imports React).
    // Every Dokka-generated `.md` file under `api/<module>/...` runs
    // through CommonMark (selected automatically by `markdown.format:
    // 'detect'` in this config) so MDX 3's strict JSX parser doesn't
    // choke on Dokka's link-heavy output.
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'api',
        path: 'api',
        routeBasePath: 'api',
        sidebarPath: './sidebars-api.ts',
        editUrl: undefined,
        beforeDefaultRemarkPlugins: [remarkDocletmdColors],
      },
    ],
  ],

  themeConfig: {
    image: 'img/logo-square.png',
    metadata: [
      {
        name: 'description',
        content:
          'FlixelGDX — the most powerful Java game development framework, designed for beginners and experts alike. A Java 17 port of HaxeFlixel on top of libGDX.',
      },
      {name: 'theme-color', content: '#ff2a3c'},
    ],
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'FlixelGDX',
      logo: {
        alt: 'FlixelGDX logo',
        src: 'img/logo-square.png',
      },
      items: [
        {to: '/getting-started', label: 'Getting Started', position: 'left'},
        {to: '/docs/your-first-project', label: 'Docs', position: 'left'},
        {
          type: 'dropdown',
          label: 'API',
          position: 'left',
          items: [
            {to: '/api/category/core/', label: 'Core'},
            {to: '/api/category/desktop-lwjgl3/', label: 'Desktop (LWJGL3)'},
            {to: '/api/category/web-teavm', label: 'Web (TeaVM)'},
            // TODO: uncomment when Android and iOS backends are released
            // {to: '/api/android/', label: 'Android'},
            // {to: '/api/ios/', label: 'iOS (MobiVM)'},
            {to: '/api/', label: 'About the reference'},
          ],
        },
        {
          href: 'https://github.com/flixelgdx/flixelgdx',
          label: 'View source',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: '/getting-started'},
            {label: 'Your First Project', to: '/docs/your-first-project'},
            {label: 'API Reference', to: '/api/'},
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Framework on GitHub',
              href: 'https://github.com/flixelgdx/flixelgdx',
            },
            {
              label: 'JitPack',
              href: 'https://jitpack.io/#flixelgdx/flixelgdx',
            },
            {
              label: 'Releases',
              href: 'https://github.com/flixelgdx/flixelgdx/releases',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Issues',
              href: 'https://github.com/flixelgdx/flixelgdx/issues',
            },
            {
              label: 'Discussions',
              href: 'https://github.com/flixelgdx/flixelgdx/discussions',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} FlixelGDX. Built with Docusaurus. Not affiliated with HaxeFlixel or libGDX.`,
    },
    prism: {
      theme: githubLight,
      darkTheme: githubDark,
      additionalLanguages: ['java', 'groovy', 'kotlin', 'gradle', 'bash', 'markup', 'properties', 'powershell', 'batch'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
