import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {githubLight, githubDark} from './src/prismThemes';

const config: Config = {
  title: 'FlixelGDX',
  tagline:
    'The most powerful Java game development framework, designed for beginners and experts alike.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://flixelgdx.github.io',
  baseUrl: '/flixelgdx-website/',

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
    // 'detect' = .mdx → MDX (JSX-aware), .md → CommonMark. Our hand-
    // written pages live in .mdx files (they import React components);
    // every auto-generated API page is .md so they're never run through
    // MDX's strict JSX parser, which rejects Dokka's link-heavy syntax.
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/flixelgdx/flixelgdx-website/tree/main/site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
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
        {to: '/docs/getting-started', label: 'Getting Started', position: 'left'},
        {to: '/docs/your-first-project', label: 'Your First Project', position: 'left'},
        {
          type: 'dropdown',
          label: 'API',
          position: 'left',
          items: [
            {to: '/api/core/', label: 'Core'},
            {to: '/api/lwjgl3/', label: 'Desktop (LWJGL3)'},
            {to: '/api/teavm/', label: 'Web (TeaVM)'},
            {to: '/api/android/', label: 'Android'},
            {to: '/api/ios/', label: 'iOS (MobiVM)'},
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
          title: 'Learn',
          items: [
            {label: 'Getting Started', to: '/docs/getting-started'},
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
