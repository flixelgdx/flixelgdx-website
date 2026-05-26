import type {Plugin} from 'unified';
import type {Root, Html, Node, Parent} from 'mdast';
import {visit} from 'unist-util-visit';

// Matches the HTML comment markers DocletMD emits before every member heading.
const MARKER_RE = /^<!-- docletmd:([\w:]+) -->$/;

// Java access/non-access modifiers that appear in member signatures.
const MODIFIER_RE =
  /^(public|protected|private|static|final|abstract|synchronized|native|transient|volatile|strictfp) /;

// Java primitive types and void -- colored as keywords, not as type references.
const JAVA_PRIMITIVES = new Set([
  'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short',
]);

// Escape text for safe insertion into an HTML attribute or text node.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Mirrors github-slugger v1 (used by rehype-slug in Docusaurus): lowercase,
// replace each space with a hyphen, then strip any remaining non-word/non-hyphen chars.
// Note: \w covers [a-zA-Z0-9_], so underscores are preserved.
function slugify(text: string): string {
  return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
}

// Produce a concise TOC label by stripping modifiers, return type, and parameter
// names -- leaving only the member name and parameter types.
// Examples:
//   "public static FlixelSprite loadGraphic(FileHandle path, int w)" -> "loadGraphic(FileHandle, int)"
//   "public static final int MAX_FRAMES = 100"                       -> "MAX_FRAMES"
//   "public FlixelSprite(FlixelGame game)"                           -> "FlixelSprite(FlixelGame)"
function simplify(sig: string, kind: string): string {
  let rem = sig;
  let m: RegExpExecArray | null;
  while ((m = MODIFIER_RE.exec(rem))) rem = rem.slice(m[0].length);

  const parenIdx = rem.indexOf('(');
  if (parenIdx === -1) {
    // Field: strip constant value, take the last word (field name).
    const eqIdx = rem.indexOf(' = ');
    const typeAndName = eqIdx >= 0 ? rem.slice(0, eqIdx) : rem;
    const sp = typeAndName.lastIndexOf(' ');
    return sp >= 0 ? typeAndName.slice(sp + 1) : typeAndName;
  }

  const header = rem.slice(0, parenIdx);
  const paramsStr = rem.slice(parenIdx);

  const name = kind === 'constructor'
    ? header.trim()
    : (() => { const sp = header.lastIndexOf(' '); return sp >= 0 ? header.slice(sp + 1) : header; })();

  const inner = paramsStr.slice(1, paramsStr.lastIndexOf(')'));
  if (!inner.trim()) return `${name}()`;
  const paramTypes = splitParams(inner).map(param => {
    const sp = param.lastIndexOf(' ');
    const rawType = sp >= 0 ? param.slice(0, sp) : param;
    // Strip type-use annotations (@NotNull, @Size(max=10), etc.) from the type.
    return rawType.replace(/@[A-Za-z][A-Za-z0-9_]*(\([^)]*\))?\s*/g, '').trim();
  });
  return `${name}(${paramTypes.join(', ')})`;
}

// Split a parameter string at commas that are NOT nested inside angle brackets,
// so that "Map<String, Integer> x, int y" splits into two params, not three.
function splitParams(params: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < params.length; i++) {
    const ch = params[i];
    if (ch === '<') depth++;
    else if (ch === '>') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(params.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = params.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

// Return a colored <span> for a type token.
// Primitives and void use keyword color; class names use type color.
function spanType(raw: string): string {
  const base = raw.replace(/\.\.\.$/, '').replace(/(\[\])+$/, '');
  const cls = JAVA_PRIMITIVES.has(base) ? 'dm-kw' : 'dm-type';
  return `<span class="${cls}">${esc(raw)}</span>`;
}

// Build colored HTML for a "(type name, type name, ...)" parameter list.
// paramsStr includes the outer parentheses.
function colorParams(paramsStr: string): string {
  const inner = paramsStr.slice(1, paramsStr.lastIndexOf(')'));
  if (!inner.trim()) return '()';
  const colored = splitParams(inner).map(param => {
    const sp = param.lastIndexOf(' ');
    if (sp < 0) return spanType(param);
    return `${spanType(param.slice(0, sp))} <span class="dm-param">${esc(param.slice(sp + 1))}</span>`;
  });
  return `(${colored.join(', ')})`;
}

// Build a colorized HTML string for a complete member signature.
// kind is the marker kind: "method", "method:static", "field", "field:static",
// "field:constant", or "constructor".
function colorize(sig: string, kind: string): string {
  let rem = sig;
  let out = '';

  let m: RegExpExecArray | null;
  while ((m = MODIFIER_RE.exec(rem))) {
    out += `<span class="dm-kw">${m[1]}</span> `;
    rem = rem.slice(m[0].length);
  }

  const parenIdx = rem.indexOf('(');

  if (parenIdx === -1) {
    const eqIdx = rem.indexOf(' = ');
    const typeAndName = eqIdx >= 0 ? rem.slice(0, eqIdx) : rem;
    const sp = typeAndName.lastIndexOf(' ');
    if (sp >= 0) {
      out += `${spanType(typeAndName.slice(0, sp))} <span class="dm-fn">${esc(typeAndName.slice(sp + 1))}</span>`;
    } else {
      out += `<span class="dm-fn">${esc(typeAndName)}</span>`;
    }
    if (eqIdx >= 0) {
      out += ` = <span class="dm-const">${esc(rem.slice(eqIdx + 3))}</span>`;
    }
  } else {
    const header = rem.slice(0, parenIdx);
    const paramsStr = rem.slice(parenIdx);

    if (kind === 'constructor') {
      out += `<span class="dm-fn">${esc(header)}</span>`;
    } else {
      const sp = header.lastIndexOf(' ');
      if (sp >= 0) {
        out += `${spanType(header.slice(0, sp))} <span class="dm-fn">${esc(header.slice(sp + 1))}</span>`;
      } else {
        out += `<span class="dm-fn">${esc(header)}</span>`;
      }
    }

    out += colorParams(paramsStr);
  }

  return out;
}

const remarkDocletmdColors: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'html', (node: Html, index: number | undefined, parent: Parent | undefined) => {
    if (index == null || parent == null) return;
    const match = node.value.match(MARKER_RE);
    if (!match) return;
    const kind = match[1];

    const next = parent.children[index + 1] as (Node & {
      depth?: number;
      children?: (Node & {type: string; value?: string})[];
      data?: Record<string, unknown>;
    }) | undefined;
    if (!next || next.type !== 'heading' || next.depth !== 3) return;

    // Grab the full signature text from the inlineCode child DocletMD generated.
    const codeChild = next.children?.find(c => c.type === 'inlineCode');
    if (!codeChild?.value) return;
    const sig = codeChild.value;

    const slug = slugify(sig);

    // Set data.hProperties.id so mdast-util-to-hast writes the id attribute directly
    // onto the <h4> element. rehype-slug skips elements that already have an id, so
    // the heading anchor is exactly our slug (matching the links DocletMD generates).
    next.data ??= {};
    next.data.hProperties = {
      ...(next.data.hProperties as Record<string, unknown> ?? {}),
      id: slug,
    };

    // Replace the inline-code child with plain simplified text so the TOC sidebar
    // shows "NONE" instead of the full "public static final int NONE = -2" signature.
    next.children = [{type: 'text', value: simplify(sig, kind)} as Node];

    // Insert a sibling <div class="dm-sig"> immediately after the heading to display
    // the colorized full signature. This keeps the h4 text clean (for TOC) while
    // still rendering the full colored signature for readers below the heading.
    //
    // Using <span class="dm-code"> instead of <code> here is intentional.
    // Docusaurus's rehype pipeline intercepts bare <code> elements and converts
    // them into full Prism code block React components (codeBlockStandalone) with
    // hardcoded inline --prism-color/--prism-background-color styles. That component
    // can re-render client-side and replace our dm-* spans with Prism token spans,
    // causing intermittent wrong colors. A <span> is left as raw HTML and is never
    // touched by the Prism transformer.
    parent.children.splice(index + 2, 0, {
      type: 'html',
      value: `<div class="dm-sig"><span class="dm-code">${colorize(sig, kind)}</span></div>`,
    } as Node);
  });
};

export default remarkDocletmdColors;
