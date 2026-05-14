/*
 * GitHub-flavored Prism themes for Docusaurus.
 *
 * `prism-react-renderer` ships a "github" light theme but no matching dark
 * theme, so we define `githubDark` ourselves. Both palettes are taken
 * straight from GitHub's published syntax-highlighting CSS (their primer
 * style tokens), so the rendered code matches what users see when they
 * read source on github.com.
 */
import {themes as prismThemes, type PrismTheme} from 'prism-react-renderer';

export const githubLight: PrismTheme = prismThemes.github;

export const githubDark: PrismTheme = {
  plain: {
    color: '#e6edf3',
    backgroundColor: '#0d1117',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {color: '#8b949e', fontStyle: 'italic'},
    },
    {
      types: ['namespace'],
      style: {opacity: 0.7},
    },
    {
      types: ['string', 'attr-value'],
      style: {color: '#a5d6ff'},
    },
    {
      types: ['punctuation', 'operator'],
      style: {color: '#c9d1d9'},
    },
    {
      types: [
        'entity',
        'url',
        'symbol',
        'number',
        'boolean',
        'variable',
        'constant',
        'property',
        'regex',
        'inserted',
      ],
      style: {color: '#79c0ff'},
    },
    {
      types: ['atrule', 'keyword', 'attr-name', 'selector'],
      style: {color: '#ff7b72'},
    },
    {
      types: ['function', 'deleted', 'tag'],
      style: {color: '#d2a8ff'},
    },
    {
      types: ['function-variable'],
      style: {color: '#d2a8ff'},
    },
    {
      types: ['tag', 'selector', 'keyword'],
      style: {color: '#ff7b72'},
    },
    // Java / Kotlin / Groovy specifics
    {
      types: ['class-name', 'maybe-class-name'],
      style: {color: '#ffa657'},
    },
    {
      types: ['builtin', 'char'],
      style: {color: '#79c0ff'},
    },
    {
      types: ['annotation'],
      style: {color: '#d2a8ff'},
    },
  ],
};
