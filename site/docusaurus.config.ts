import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

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
        {to: '/api/', label: 'API', position: 'left'},
        {
          href: 'https://github.com/flixelgdx/flixelgdx',
          label: 'Source',
          position: 'right',
        },
        {
          href: 'https://github.com/flixelgdx/flixelgdx-website',
          label: 'Website Repo',
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
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['java', 'groovy', 'kotlin', 'gradle', 'bash', 'markup', 'properties'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
