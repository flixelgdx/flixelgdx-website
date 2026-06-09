import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'your-first-project',
    {
      type: 'category',
      label: 'Framework Guides',
      collapsed: false,
      items: [
        'core-concepts',
        'debugger',
        'advanced-concepts',
      ],
    },
    'troubleshooting',
    'best-practices',
  ],
};

export default sidebars;
