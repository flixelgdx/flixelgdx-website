#!/usr/bin/env python3
"""
Post-process Dokka's GFM output so it renders cleanly inside Docusaurus
**and** reads like a Java reference (Dokka is Kotlin-first, which leaks
through in signatures and folder layout).

What this does, in order, for every Markdown file under the staging dir:

1. **Lift the "FlixelGDX" wrapper folder** so packages live at the top
   level (we are calling this script *with* the FlixelGDX/ inner folder
   already passed in as the staging root, so no extra step needed here —
   ``build-api.sh`` handles that).

2. **Rewrite the breadcrumb** that Dokka emits at the top of every page
   (``//[FlixelGDX](...)/[me.stringdotjar.flixelgdx](...)/[Flixel](...)``)
   into proper Java-shaped breadcrumbs (drops the FlixelGDX prefix and
   the file-tree slashes, uses dots between package segments and
   ``::`` between the package and the type).

3. **Replace ``# Package-level declarations`` titles** with the real
   package name on package landing pages so the sidebar stops showing
   30 identical entries.

4. **Kotlin → Java signatures** in code spans and on bare lines (best-
   effort regexes — ``open class Foo : Bar()`` becomes
   ``public class Foo extends Bar``, ``val x: Int = 4`` becomes
   ``public final int x = 4``, ``Array<T>`` becomes ``T[]``, etc).

5. **Escape stray ``{`` / ``}``** outside code spans so MDX doesn't try
   to interpret them as JSX expressions, and **self-close ``<br>``**
   for the same reason.

6. **Strip the `[flixelgdx-core]` module tag** that Dokka injects into
   every signature row — we surface module info via a dedicated badge
   instead.

7. **Expand the Properties / Functions tables into proper H3 sections**
   so each member becomes a real heading, lands in the right-side TOC,
   and reads like a HaxeFlixel-style API page instead of a giant table.

8. **Drop YAML front-matter** with title + sidebar_label using the
   *cleaned* heading, plus a ``hide_title: true`` on package landing
   pages so the rendered page doesn't show "Package-level declarations"
   twice.

9. **Emit a ``_category_.json``** for every class folder pointing at
   ``index`` so the sidebar entry is the class itself (not the
   constructor or a random field).
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

# ---------------------------------------------------------------------------
# Regex helpers
# ---------------------------------------------------------------------------

BR_RE = re.compile(r"<br\s*>", re.IGNORECASE)
H1_RE = re.compile(r"^#\s+(.*?)\s*$", re.MULTILINE)
BREADCRUMB_RE = re.compile(r"^//\[FlixelGDX\][^\n]*\n", re.MULTILINE)
MODULE_TAG_RE = re.compile(r"\[flixelgdx-[a-z0-9\-]+\]<br\s*/?>", re.IGNORECASE)
MODULE_TAG_PLAIN_RE = re.compile(r"\[flixelgdx-[a-z0-9\-]+\]")

# Kotlin → Java fixups
KOTLIN_TYPE_LINK_RE = re.compile(
    r"\[(String|Int|Long|Float|Double|Boolean|Char|Byte|Short)\]"
    r"\(https://docs\.oracle\.com/[^\)]*\)"
)
KOTLIN_ARRAY_RE = re.compile(r"\bArray<([^<>]+?)>")
KOTLIN_TYPED_NAME_RE = re.compile(
    r"(\b[A-Za-z_][A-Za-z0-9_]*)\s*:\s*"
    r"((?:\[?[A-Za-z_][\w\.\-]*\]?(?:\([^\)]*\))?)+(?:&lt;[^&]*&gt;)?(?:\[\])?)"
)
KOTLIN_CLASS_INHERIT_RE = re.compile(
    r"(class\s+\[[^\]]+\]\([^)]*\)(?:\([^)]*\))?)\s*:\s*"
)
KOTLIN_OPEN_VAR_VAL_RE = re.compile(r"\bopen\s+(var|val)\s+")
KOTLIN_VAR_VAL_RE = re.compile(r"^(?:\s*)(var|val)\s+", re.MULTILINE)
KOTLIN_FUN_RE = re.compile(r"\bopen\s+fun\s+|\bfun\s+")
KOTLIN_RETURN_TYPE_RE = re.compile(r"\)\s*:\s*([A-Za-z_\[][\w\.\-\(\)\[\]\<\>&;]*?)\s*(?=<br|$)")

# Member-row tables come in two flavours from Dokka:
#   - `| Name | Summary |`  (Properties, Functions, Types)
#   - `| | |`               (Constructors — no header text)
# Both are matched here.
MEMBER_TABLE_HEADER_RE = re.compile(
    r"^\|\s*(Name)?\s*\|\s*(Summary)?\s*\|\s*$",
)
MEMBER_TABLE_DIVIDER_RE = re.compile(r"^\|\s*-+\s*\|\s*-+\s*\|\s*$")

# Header on a class page that signals the next H2 is "Properties" etc.
SECTION_HEADER_RE = re.compile(r"^##\s+(Constructors|Properties|Functions|Types|Inheritors)\s*$")


# ---------------------------------------------------------------------------
# Transformations
# ---------------------------------------------------------------------------


def cleanup_breadcrumb(text: str) -> str:
    """Turn `//[FlixelGDX](.../index.md)/[me.stringdotjar.flixelgdx](../index.md)/[Foo](index.md)`
    into a styled Java-shaped breadcrumb, OR drop it entirely on the
    api root index. We render it as a blockquote so it pops visually."""
    def replace(match: re.Match[str]) -> str:
        line = match.group(0).rstrip("\n")
        # Pull out the [label](link) tuples
        pairs = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", line)
        if not pairs:
            return ""
        # Drop the leading "FlixelGDX" wrapper crumb.
        if pairs[0][0] == "FlixelGDX":
            pairs = pairs[1:]
        if not pairs:
            return ""
        # Format: link the package, then `::` then the type, keeping any
        # nested member as a trailing `.member`.
        parts: list[str] = []
        if len(pairs) == 1:
            # Package-level page
            label, href = pairs[0]
            parts.append(f"[{label}]({href})")
        else:
            pkg = pairs[0]
            cls = pairs[1]
            parts.append(f"[{pkg[0]}]({pkg[1]})")
            parts.append(f"**[{cls[0]}]({cls[1]})**")
            for extra in pairs[2:]:
                parts.append(f"[{extra[0]}]({extra[1]})")
        sep = " &raquo; "
        joined = sep.join(parts)
        return f"<small className=\"flx-breadcrumb\">{joined}</small>\n\n"

    return BREADCRUMB_RE.sub(replace, text)


def fix_package_title(text: str, package_name: str | None) -> tuple[str, str | None]:
    """If this is a package-level page (has `# Package-level declarations`),
    replace the heading with the real package name and report it back."""
    if package_name is None:
        return text, None
    if "# Package-level declarations" in text:
        text = text.replace("# Package-level declarations", f"# `{package_name}`", 1)
        return text, package_name
    return text, None


def kotlin_to_java(text: str) -> str:
    """Best-effort fixer for Kotlin-shaped signatures Dokka emits."""

    # Drop the [flixelgdx-core] inline module tag — we surface the module
    # via the package breadcrumb instead.
    text = MODULE_TAG_RE.sub("", text)
    text = MODULE_TAG_PLAIN_RE.sub("", text)

    # Built-in primitive type links → bare type name (Dokka emits the
    # Java Oracle URL but with a Kotlin-style usage).
    text = KOTLIN_TYPE_LINK_RE.sub(r"\1", text)

    # `Array<T>` → `T[]` (handles nested type parameters once).
    def _array(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        return f"{inner}[]"
    for _ in range(3):  # peel a couple of nested layers
        new = KOTLIN_ARRAY_RE.sub(_array, text)
        if new == text:
            break
        text = new

    # `class X(...) : Y` → `class X extends Y`
    text = KOTLIN_CLASS_INHERIT_RE.sub(r"\1 extends ", text)

    # `open class` modifiers — Dokka uses Kotlin's `open`. Java has no
    # equivalent at that position, so drop it.
    text = re.sub(r"\bopen\s+class\b", "class", text)
    text = re.sub(r"\babstract\s+class\b", "abstract class", text)
    text = re.sub(r"\bopen\s+interface\b", "interface", text)
    text = re.sub(r"\bopen\s+fun\b", "fun", text)

    # `var foo: Bar` / `val foo: Bar` at the start of a signature row.
    # We rewrite as `Bar foo` to look like a Java declaration. We're
    # careful not to mangle parameter lists.
    def _typed_name(match: re.Match[str]) -> str:
        name, ty = match.group(1), match.group(2)
        return f"{ty} {name}"

    # Specifically rewrite "open var name: Type" → "Type name" and
    # "open val name: Type" → "final Type name".
    text = re.sub(
        r"\bopen\s+var\s+(\[?[A-Za-z_][\w]*\]?(?:\([^)]+\))?)\s*:\s*"
        r"((?:\[?[A-Za-z_][\w\.\-]*\]?(?:\([^)]+\))?)(?:&lt;[^&]*&gt;)?(?:\[\])?)",
        r"\2 \1",
        text,
    )
    text = re.sub(
        r"\bopen\s+val\s+(\[?[A-Za-z_][\w]*\]?(?:\([^)]+\))?)\s*:\s*"
        r"((?:\[?[A-Za-z_][\w\.\-]*\]?(?:\([^)]+\))?)(?:&lt;[^&]*&gt;)?(?:\[\])?)",
        r"final \2 \1",
        text,
    )
    text = re.sub(
        r"^(\s*)val\s+(\[?[A-Za-z_][\w]*\]?(?:\([^)]+\))?)\s*:\s*"
        r"((?:\[?[A-Za-z_][\w\.\-]*\]?(?:\([^)]+\))?)(?:&lt;[^&]*&gt;)?(?:\[\])?)",
        r"\1final \3 \2",
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r"^(\s*)var\s+(\[?[A-Za-z_][\w]*\]?(?:\([^)]+\))?)\s*:\s*"
        r"((?:\[?[A-Za-z_][\w\.\-]*\]?(?:\([^)]+\))?)(?:&lt;[^&]*&gt;)?(?:\[\])?)",
        r"\1\3 \2",
        text,
        flags=re.MULTILINE,
    )

    # `fun name(...): RetType` → `RetType name(...)`.
    text = re.sub(
        r"\bfun\s+(\[?[A-Za-z_][\w]*\]?(?:\([^)]*\))?)\(([^)]*)\)\s*:\s*"
        r"((?:\[?[A-Za-z_][\w\.\-]*\]?(?:\([^)]+\))?)(?:&lt;[^&]*&gt;)?(?:\[\])?)",
        r"\3 \1(\2)",
        text,
    )
    # `fun name(...)` without explicit return type → `void name(...)`.
    text = re.sub(
        r"\bfun\s+(\[?[A-Za-z_][\w]*\]?(?:\([^)]*\))?)\(([^)]*)\)",
        r"void \1(\2)",
        text,
    )

    return text


_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def strip_control_chars(text: str) -> str:
    """Dokka occasionally embeds bare control characters (especially from
    pasted Unicode like ``\u200b`` or stray ``\x7f`` glyphs) that the
    Rspack HTML minifier flat-out rejects, silently truncating the page
    body. Scrub them out before MDX even sees the file."""
    return _CONTROL_CHAR_RE.sub("", text)


def escape_curly_braces(text: str) -> str:
    """MDX treats `{` / `}` as JSX expression delimiters. Dokka never
    means that, so escape every stray curly outside code spans / fences."""
    out: list[str] = []
    in_fence = False
    for line in text.splitlines(keepends=True):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        parts = re.split(r"(`[^`]*`)", line)
        for i, p in enumerate(parts):
            if i % 2 == 0:
                p = p.replace("{", r"\{").replace("}", r"\}")
            parts[i] = p
        out.append("".join(parts))
    return "".join(out)


def expand_member_tables(text: str) -> str:
    """Walk the document line-by-line. When we see one of the
    structural section headings (`## Properties`, `## Functions`,
    `## Constructors`, `## Types`), we look ahead for a 2-column
    `| Name | Summary |` table and rewrite each table row as a
    standalone H3 block:

        ### name
        signature

        description

    This lifts each member into the right-hand TOC, makes the page
    readable, and lets every property/method have its own deep link."""
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        section = SECTION_HEADER_RE.match(line)
        if section:
            # Look ahead past optional blank lines for a table header
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                out.append(lines[j])
                j += 1
            if j + 1 < len(lines) and MEMBER_TABLE_HEADER_RE.match(lines[j]) and MEMBER_TABLE_DIVIDER_RE.match(lines[j + 1]):
                # Eat the header + divider, then parse rows until a blank line / new heading.
                j += 2
                rendered_rows: list[str] = []
                while j < len(lines):
                    row = lines[j]
                    if row.strip() == "" or row.lstrip().startswith("#"):
                        break
                    if not row.lstrip().startswith("|"):
                        break
                    cells = [c.strip() for c in row.strip().strip("|").split("|")]
                    if len(cells) < 2:
                        j += 1
                        continue
                    name_cell, summary_cell = cells[0], cells[1]
                    name_match = re.match(r"\[([^\]]+)\]\(([^)]+)\)", name_cell)
                    if not name_match:
                        rendered_rows.append(f"### {name_cell}\n\n{summary_cell}\n")
                        j += 1
                        continue
                    label, href = name_match.group(1), name_match.group(2)
                    # Split the summary cell on <br />. Dokka's convention is
                    # one or more signature lines followed by an optional
                    # prose description. Heuristic: a "description" piece is
                    # the first one that ends with `.`, `!`, `?`, `:` or
                    # starts with a capital letter followed by a space and
                    # does NOT look like a Java declaration (no `(`, `;` or
                    # generic brackets at type-position).
                    pieces = re.split(r"<br\s*/?>", summary_cell)
                    pieces = [p.strip() for p in pieces if p.strip()]
                    signatures: list[str] = []
                    description_pieces: list[str] = []
                    for piece in pieces:
                        if description_pieces:
                            description_pieces.append(piece)
                            continue
                        # Strip links to inspect the "shape" of the line.
                        bare = strip_links(piece)
                        is_signature = bool(
                            re.search(r"[\(\)=;]", bare)
                            or bare.startswith("constructor")
                            or bare.startswith("abstract ")
                            or bare.startswith("final ")
                            or bare.startswith("class ")
                            or bare.startswith("interface ")
                            or bare.startswith("enum ")
                            or re.match(
                                r"^[A-Za-z_][\w\.\[\]\<\>&;]*\s+[A-Za-z_][\w]*\s*$",
                                bare,
                            )  # "Type name" with no description text
                        ) and not bare.rstrip().endswith(".")
                        if is_signature:
                            signatures.append(piece)
                        else:
                            description_pieces.append(piece)
                    description = " ".join(description_pieces).strip()

                    member: list[str] = []
                    # H3 heading uses the plain name so Docusaurus can
                    # auto-generate a clean slug (`#active`) for it.
                    member.append(f"### {label}")
                    member.append("")
                    if signatures:
                        for sig in signatures:
                            member.append(f"`{strip_links(sig)}`  ")
                        member.append("")
                    if description:
                        member.append(description)
                        member.append("")
                    # "Details" link out to the dedicated member page, so
                    # users who want the long form can still jump to it.
                    member.append(f"[Details →]({href})")
                    member.append("")
                    rendered_rows.append("\n".join(member))
                    j += 1
                out.extend(rendered_rows)
                # Skip past where we are
                i = j
                continue
        i += 1
    return "\n".join(out) + ("\n" if text.endswith("\n") else "")


def slug(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", name.strip()).strip("-").lower()
    return s or "anon"


def strip_links(s: str) -> str:
    """Collapse `[text](url)` to just `text` — useful when we want a
    signature inside an inline-code span (Markdown won't render the
    link inside backticks anyway). Also decode the HTML entities Dokka
    pre-escapes inside table cells (``&lt;``, ``&gt;``, ``&amp;``) so
    they read like real Java types when we re-wrap them in backticks."""
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = s.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return s


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def derive_package_name(rel_dir: str) -> str | None:
    """If we are inside a package folder (its name looks like a Java
    package — letters, digits, dots, no leading dash), return the dotted
    package name."""
    head, tail = os.path.split(rel_dir)
    if tail and re.match(r"^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$", tail):
        return tail
    return None


def is_class_folder(folder: str) -> bool:
    name = os.path.basename(folder)
    return name.startswith("-") and os.path.exists(os.path.join(folder, "index.md"))


def remove_route_colliders(root: str) -> int:
    """Dokka emits constructor docs in TWO places that both collide with
    the class index route:

      1. The package-level file ``<Pkg>/-flixel-sprite.md`` next to the
         class folder ``<Pkg>/-flixel-sprite/``.
      2. The same-name file *inside* the class folder
         ``<Pkg>/-flixel-sprite/-flixel-sprite.md``. Docusaurus seems to
         treat any file whose stem matches its parent directory as a
         default index — which collides with ``index.md`` in the same
         folder.

    Both produce the "page already exists at this route" warning and
    Docusaurus then silently drops the class index. Their content is
    already summarised inside ``Constructors`` on the class index via
    ``expand_member_tables``, so we just delete them here."""
    removed = 0
    for base, dirs, files in os.walk(root):
        # 1. Sibling collision: <pkg>/<class>.md next to <pkg>/<class>/
        for d in dirs:
            colliding_md = os.path.join(base, f"{d}.md")
            if os.path.isfile(colliding_md):
                os.remove(colliding_md)
                removed += 1
        # 2. Same-name-as-folder collision inside the folder itself.
        folder = os.path.basename(base)
        colliding_md = os.path.join(base, f"{folder}.md")
        if os.path.isfile(colliding_md):
            os.remove(colliding_md)
            removed += 1
    return removed


def write_category_jsons(root: str) -> None:
    """Drop a `_category_.json` into every class folder so the sidebar
    entry collapses to *just* the class index (Dokka emits one md per
    member; we want them out of the sidebar)."""
    for base, dirs, files in os.walk(root):
        if "index.md" not in files:
            continue
        if not is_class_folder(base):
            continue
        # Sidebar label = the directory-derived class name (Dokka's
        # `-flixel-sprite` becomes `FlixelSprite`).
        raw = os.path.basename(base).lstrip("-")
        label = re.sub(r"-([a-z])", lambda m: m.group(1).upper(), raw)
        label = label[:1].upper() + label[1:]
        # NOTE: we deliberately omit `link` here. Setting `link: type: doc,
        # id: index` collides with the per-folder index.md and makes
        # Docusaurus refuse to generate the class page. With no link, the
        # category is a toggle and "Overview" (from index.md front matter)
        # appears as the first item inside the expanded category.
        cat = {
            "label": label,
            "collapsible": True,
            "collapsed": True,
            "customProps": {"isClass": True},
        }
        with open(os.path.join(base, "_category_.json"), "w", encoding="utf-8") as fh:
            json.dump(cat, fh, indent=2)
        # Make non-index siblings invisible in the sidebar by adding
        # `sidebar_class_name: 'flx-hidden-sidebar'` to their front matter.
        for f in files:
            if not f.endswith(".md") or f == "index.md":
                continue
            p = os.path.join(base, f)
            with open(p, "r", encoding="utf-8") as fh:
                text = fh.read()
            if text.startswith("---\n") and "sidebar_class_name" not in text:
                text = text.replace(
                    "---\n",
                    "---\nsidebar_class_name: flx-hidden-sidebar\n",
                    1,
                )
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(text)


def write_package_category(folder: str, package_name: str) -> None:
    # Same reasoning as the class _category_.json above — no `link` field.
    cat = {
        "label": package_name,
        "collapsible": True,
        "collapsed": True,
        "customProps": {"isPackage": True},
    }
    with open(os.path.join(folder, "_category_.json"), "w", encoding="utf-8") as fh:
        json.dump(cat, fh, indent=2)


def main() -> None:
    for base, dirs, files in os.walk(ROOT):
        rel_dir = os.path.relpath(base, ROOT)
        package_name = derive_package_name(rel_dir)
        if package_name and "index.md" in files:
            write_package_category(base, package_name)
        for f in files:
            if not f.endswith(".md"):
                continue
            path = os.path.join(base, f)
            with open(path, "r", encoding="utf-8") as fh:
                text = fh.read()
            if text.startswith("---\n"):
                continue  # already processed (e.g. hand-written api/index.md)

            text = strip_control_chars(text)
            text = cleanup_breadcrumb(text)
            text, replaced_pkg = fix_package_title(text, package_name)
            text = kotlin_to_java(text)
            text = expand_member_tables(text)
            text = BR_RE.sub("<br />", text)
            text = escape_curly_braces(text)

            # Derive title for YAML front matter
            m = H1_RE.search(text)
            title = m.group(1).strip() if m else os.path.splitext(f)[0]
            title = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", title)  # strip md links
            title = re.sub(r"<[^>]+>", "", title)
            title = title.replace("`", "")
            title = title.strip().replace('"', "'")
            sidebar_label = title
            if replaced_pkg:
                sidebar_label = "Overview"

            fm = (
                "---\n"
                f"title: \"{title}\"\n"
                "hide_title: true\n"
                f"sidebar_label: \"{sidebar_label}\"\n"
                "---\n\n"
            )
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(fm + text)

    removed = remove_route_colliders(ROOT)
    if removed:
        print(f"  removed {removed} route-colliding .md files", file=sys.stderr)
    write_category_jsons(ROOT)


if __name__ == "__main__":
    main()
