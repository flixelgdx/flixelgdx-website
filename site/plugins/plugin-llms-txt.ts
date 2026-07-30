import type {LoadContext, Plugin} from '@docusaurus/types';
import {flattenRoutes} from '@docusaurus/utils';
import fs from 'fs';
import path from 'path';

type RouteMetadata = {
  sourceFilePath?: string;
  [key: string]: unknown;
};

type Options = {
  title: string;
  description?: string;
};

type Entry = {
  title: string;
  url: string;
  description: string;
  content: string;
  section: string;
};

function parseFrontmatter(raw: string): {title: string; description: string; body: string} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return {title: '', description: '', body: raw};
  const yaml = match[1] ?? '';
  const body = match[2] ?? raw;
  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  return {
    title: titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : '',
    description: descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, '') : '',
    body,
  };
}

function firstHeading(body: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

function sectionFor(routePath: string): string {
  if (routePath.startsWith('/api')) return 'API Reference';
  if (routePath.startsWith('/docs')) return 'Docs';
  return 'Other';
}

export default function pluginLlmsTxt(
  _context: LoadContext,
  options: Options,
): Plugin {
  return {
    name: 'plugin-llms-txt',
    async postBuild({siteConfig, routes, outDir}) {
      const flat = flattenRoutes(routes);
      const docRoutes = flat.filter(r => {
        const src = (r.metadata as RouteMetadata)?.sourceFilePath;
        return typeof src === 'string' && (src.endsWith('.md') || src.endsWith('.mdx'));
      });

      const entries: Entry[] = [];
      for (const route of docRoutes) {
        const src = (route.metadata as RouteMetadata).sourceFilePath as string;
        let raw: string;
        try {
          raw = fs.readFileSync(src, 'utf8');
        } catch {
          continue;
        }
        const {title: fmTitle, description, body} = parseFrontmatter(raw);
        entries.push({
          title: fmTitle || firstHeading(body),
          url: siteConfig.url + route.path,
          description,
          content: raw,
          section: sectionFor(route.path),
        });
      }

      const bySection = entries.reduce<Record<string, Entry[]>>((acc, e) => {
        (acc[e.section] ??= []).push(e);
        return acc;
      }, {});

      let llmsTxt = `# ${options.title}`;
      if (options.description) llmsTxt += `\n\n> ${options.description}`;
      llmsTxt += '\n\n';
      for (const [section, items] of Object.entries(bySection)) {
        llmsTxt += `## ${section}\n\n`;
        for (const item of items) {
          const link = `[${item.title}](${item.url})`;
          llmsTxt += item.description ? `- ${link}: ${item.description}\n` : `- ${link}\n`;
        }
        llmsTxt += '\n';
      }

      let llmsFullTxt = `# ${options.title}`;
      if (options.description) llmsFullTxt += `\n\n> ${options.description}`;
      llmsFullTxt += '\n\n';
      llmsFullTxt += entries.map(e => e.content).join('\n\n---\n\n');

      fs.writeFileSync(path.join(outDir, 'llms.txt'), llmsTxt);
      fs.writeFileSync(path.join(outDir, 'llms-full.txt'), llmsFullTxt);
    },
  };
}
