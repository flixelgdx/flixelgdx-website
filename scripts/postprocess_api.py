#!/usr/bin/env python3
"""
Post-process Dokka's GFM output so it renders cleanly inside Docusaurus.

Pipeline (per module, run by ``build-api.sh``):

  1. **Restructure the folder tree** from Dokka's flat dotted-package
     layout into a nested short-path layout, so the sidebar reads as
     ``input > gamepad`` instead of one giant
     ``me.stringdotjar.flixelgdx.input.gamepad`` entry. We strip the
     common ``me.stringdotjar.flixelgdx.`` prefix and split the rest by
     dots into nested folders.

  2. **Rewrite every internal ``[label](relative)`` link** so it still
     resolves after the restructure — the file is now at a different
     depth, and so are its targets.

  3. **Inline each member's full documentation** (parameters / returns /
     throws / deprecated, etc.) directly onto the owning class page, so
     readers don't have to click into N member subpages.

  4. **Sanitise for MDX**: escape stray ``{`` / ``}`` outside code
     spans, self-close ``<br>``, strip ASCII control characters, fix the
     "no space before parameter name" quirk that
     ``kotlin-as-java-plugin`` leaves in (``floatdx`` ⇒ ``float dx``),
     decode pre-escaped ``&lt;``/``&gt;`` inside type signatures, …

  5. **Add View-Source buttons** to every class page by deriving the
     GitHub URL from the source path. Dokka's GFM output doesn't include
     ``sourceLink`` data, so we compute it ourselves.

  6. **Wrap the class header signature in a fenced ``java`` code block**
     so MDX renders it with syntax highlighting.

  7. **Emit ``_category_.json`` files** to give each folder a short
     human-readable label (and hide the per-member .md siblings via
     ``sidebar_class_name``).

  8. **Generate ``site/api/sidebars/<module>.json``** — a manifest the
     Docusaurus sidebar config consumes to nest packages exactly the way
     the website wants.

Usage:
    postprocess_api.py <dokka-out-root> <site-api-root> [<frameworkRoot>]

``<dokka-out-root>`` should contain a folder per module (``core``,
``lwjgl3``, …), as produced by ``./gradlew :dokka:dokkaGfmAll``.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Iterable

DOKKA_OUT = Path(sys.argv[1]).resolve()
SITE_API = Path(sys.argv[2]).resolve()
FRAMEWORK_ROOT = (
    Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else Path("/dev/null")
)

# Modules in the order the website's "Module" dropdown should list them.
MODULES: list[tuple[str, str, str]] = [
    ("core", "flixelgdx-core", "Core"),
    ("lwjgl3", "flixelgdx-lwjgl3", "Desktop (LWJGL3)"),
    ("teavm", "flixelgdx-teavm", "Web (TeaVM)"),
    ("android", "flixelgdx-android", "Android"),
    ("ios", "flixelgdx-ios", "iOS (MobiVM)"),
]

# Package prefix we strip from every package path before mapping it into
# the website's nested folder layout. Everything past this prefix becomes
# a chain of subfolders (e.g. `input.gamepad` ⇒ `input/gamepad`).
PACKAGE_PREFIX = "me.stringdotjar.flixelgdx"

GITHUB_BLOB_BASE = "https://github.com/flixelgdx/flixelgdx/blob/master"


# ---------------------------------------------------------------------------
# Regex helpers
# ---------------------------------------------------------------------------

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")

# Dokka writes "See also" link labels like `[dispose()](dispose.md)`. MDX
# strict mode reads the `()` as a function call expression and refuses
# to parse the whole document. Strip them — the link is enough.
PAREN_LABEL_RE = re.compile(r"\[([A-Za-z_][\w]*)\(\)\]")
# Dokka emits the breadcrumb as a single line starting with `//` and
# containing `[label](url)` chunks. We strip it entirely — the Docusaurus
# theme provides its own breadcrumb navigation, plus the H1 already
# shows the class name.
DOKKA_BREADCRUMB_RE = re.compile(r"^//[^\n]*\n", re.MULTILINE)
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
MODULE_TAG_RE = re.compile(r"\[flixelgdx-[a-z0-9\-]+\]\s*\\?\s*", re.IGNORECASE)
BR_RE = re.compile(r"<br\s*>", re.IGNORECASE)
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# kotlin-as-java leaves declarations like ``public void foo(floatdx)`` —
# no space between the type and the parameter name. We try to detect that
# pattern (lowercase keyword followed by a parameter name) and inject a
# space. We **do not** try to split capitalised types like
# ``FlixelObjectnewObject`` because that pattern is also a perfectly
# valid identifier (e.g. ``FlixelSprite``, ``FlixelObject``) and we'd end
# up chopping every CamelCase word in the document. The kotlin-as-java
# plugin gets this case right in almost every signature it emits.
PARAM_GLUE_RE = re.compile(
    r"\b(boolean|byte|short|int|long|float|double|char|void)([A-Za-z_][\w]*)"
)

# Class section headers (Constructors / Properties / Functions / Types).
SECTION_HEADER_RE = re.compile(
    r"^##\s+(Constructors|Properties|Functions|Types|Inheritors)\s*$"
)
MEMBER_TABLE_HEADER_RE = re.compile(r"^\|\s*(Name)?\s*\|\s*(Summary)?\s*\|\s*$")
MEMBER_TABLE_DIVIDER_RE = re.compile(r"^\|\s*-+\s*\|\s*-+\s*\|\s*$")


# ---------------------------------------------------------------------------
# Path mapping
# ---------------------------------------------------------------------------


def short_pkg(dotted: str) -> str:
    """Map a dotted package name to a short slash-separated path under
    the website's module folder. ``me.stringdotjar.flixelgdx`` →
    ``""`` (root of the module), ``me.stringdotjar.flixelgdx.input.mouse``
    → ``"input/mouse"``."""
    if dotted == PACKAGE_PREFIX:
        return ""
    if dotted.startswith(PACKAGE_PREFIX + "."):
        return dotted[len(PACKAGE_PREFIX) + 1 :].replace(".", "/")
    return dotted.replace(".", "/")


def package_pretty(dotted: str) -> str:
    """Short label used for the sidebar — last segment of the package
    path, falling back to ``(root)`` for the framework-root package."""
    if dotted == PACKAGE_PREFIX:
        return "(root)"
    return dotted.rsplit(".", 1)[-1]


def kebab_to_pascal(name: str) -> str:
    """``-flixel-sprite`` ⇒ ``FlixelSprite``."""
    raw = name.lstrip("-")
    out = re.sub(r"-([a-z0-9])", lambda m: m.group(1).upper(), raw)
    return out[:1].upper() + out[1:]


def looks_like_package_folder(folder: Path) -> bool:
    """A package folder has a lowercase name (Java package segment) and
    does NOT start with a dash (which marks Dokka's class folders)."""
    name = folder.name
    return name and not name.startswith("-") and name[0].islower()


def package_label_for(folder: Path, module_root: Path) -> str:
    """The short sidebar label / heading for a package folder. For
    ``<module>/input/gamepad/`` we want ``gamepad``."""
    try:
        rel = folder.relative_to(module_root)
        if not rel.parts:
            return "(root)"
        return rel.parts[-1]
    except ValueError:
        return folder.name


def collect_path_map(module_slug: str, module_name: str) -> dict[Path, Path]:
    """Walk the Dokka output for one module and decide where each
    package folder lives under ``site/api/<module>/``. Returns a mapping
    of source absolute path → destination absolute path. Files inside
    each package keep their basename."""
    src_root = DOKKA_OUT / module_slug / module_name
    dst_root = SITE_API / module_slug
    mapping: dict[Path, Path] = {}
    if not src_root.is_dir():
        return mapping
    # The module index file (e.g. `core/flixelgdx-core/index.md`) becomes
    # the module landing page at `site/api/<module>/index.md`.
    src_idx = src_root / "index.md"
    if src_idx.is_file():
        mapping[src_idx] = dst_root / "index.md"
    for pkg_dir in sorted(src_root.iterdir()):
        if not pkg_dir.is_dir():
            continue
        dotted = pkg_dir.name
        short = short_pkg(dotted)
        dst_pkg_root = dst_root if short == "" else dst_root / short
        for fn in pkg_dir.rglob("*"):
            if not fn.is_file():
                continue
            rel = fn.relative_to(pkg_dir)
            mapping[fn] = dst_pkg_root / rel
    return mapping


# ---------------------------------------------------------------------------
# Markdown transforms
# ---------------------------------------------------------------------------


def strip_control_chars(text: str) -> str:
    return CONTROL_CHARS_RE.sub("", text)


def fix_param_spacing(text: str) -> str:
    """``floatdx`` → ``float dx``. Done in a couple of passes since one
    line may contain many primitive parameters glued together."""
    for _ in range(3):
        new = PARAM_GLUE_RE.sub(lambda m: f"{m.group(1)} {m.group(2)}", text)
        if new == text:
            break
        text = new
    return text


def escape_curly_braces(text: str) -> str:
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


def html_decode(text: str) -> str:
    return (
        text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
    )


def strip_links(text: str) -> str:
    """Collapse ``[text](url)`` to bare ``text`` so the result is safe
    inside an inline-code span. We append a trailing space when we strip
    a link so that ``void[Foo]graphicAssetKey`` becomes
    ``void Foo graphicAssetKey`` instead of ``voidFoographicAssetKey``,
    then we tidy spaces around punctuation."""
    out = LINK_RE.sub(lambda m: f"{html_decode(m.group(1))} ", text)
    out = html_decode(out)
    # Collapse spaces inserted before/after punctuation. We strip space
    # before `(` so `FlixelSprite ()` becomes `FlixelSprite()` (which
    # only happens because the previous step put a space after the
    # stripped class-name link). Inside Java signatures we never want a
    # space between an identifier and an open paren.
    out = re.sub(r"\s+([.,;\)\]])", r"\1", out)
    out = re.sub(r"\s+\(", "(", out)
    out = re.sub(r"([\(\[])\s+", r"\1", out)
    out = re.sub(r"\s+", " ", out).strip()
    return fix_param_spacing(out)


_SIGNATURE_LINE_RE = re.compile(
    r"^(?:public|private|protected|static|final|abstract|synchronized|"
    r"volatile|transient|native|default)\b[^\n]*\[[^\]]+\]\([^)]*\)[^\n]*$",
    re.MULTILINE,
)


def wrap_signature_lines(text: str) -> str:
    """Wrap bare ``public void [foo](foo.md)(arg, arg)`` lines in a
    ``java`` fenced code block. MDX strict mode reads the trailing
    ``(arg, arg)`` after ``](url)`` as a JS call expression on the link
    "value" and refuses to parse the file."""
    out: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if line.startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence and _SIGNATURE_LINE_RE.match(line):
            out.append("```java")
            out.append(strip_links(line))
            out.append("```")
            continue
        out.append(line)
    return "\n".join(out) + ("\n" if text.endswith("\n") else "")


def relative_link(from_path: Path, to_path: Path) -> str:
    """Compute a Markdown-friendly relative link from one file to another."""
    rel = os.path.relpath(to_path, start=from_path.parent)
    return rel.replace(os.sep, "/")


def rewrite_links(
    text: str,
    *,
    src_file: Path,
    dst_file: Path,
    path_map: dict[Path, Path],
) -> str:
    """Rewrite every relative ``[label](path)`` link so it still
    resolves after the file has been moved from ``src_file`` to
    ``dst_file``."""
    src_dir = src_file.parent

    def replace(match: re.Match[str]) -> str:
        label = match.group(1)
        target = match.group(2)
        if target.startswith(("http://", "https://", "#")):
            return match.group(0)
        # Split off optional URL fragment / query.
        head, sep, frag = target.partition("#")
        if not head:
            return match.group(0)
        try:
            resolved = (src_dir / head).resolve()
        except (OSError, ValueError):
            return match.group(0)
        new_dst = path_map.get(resolved)
        if new_dst is None:
            # Try with `.md` appended (Dokka sometimes drops it).
            with_md = path_map.get(resolved.with_suffix(".md"))
            if with_md is None:
                return match.group(0)
            new_dst = with_md
        new_rel = relative_link(dst_file, new_dst)
        return f"[{label}]({new_rel}{sep}{frag})"

    return LINK_RE.sub(replace, text)


# ---------------------------------------------------------------------------
# Inline member docs onto class pages
# ---------------------------------------------------------------------------


def parse_member_table(
    lines: list[str], start: int
) -> tuple[list[tuple[str, str]], int]:
    """Starting from a ``| Name | Summary |`` or ``| | |`` header, parse
    the member rows and return ``[(name_cell, summary_cell), …]`` along
    with the index just past the table."""
    i = start
    if not (
        i < len(lines)
        and MEMBER_TABLE_HEADER_RE.match(lines[i])
        and i + 1 < len(lines)
        and MEMBER_TABLE_DIVIDER_RE.match(lines[i + 1])
    ):
        return [], start
    i += 2
    rows: list[tuple[str, str]] = []
    while i < len(lines):
        row = lines[i]
        if row.strip() == "" or row.lstrip().startswith("#"):
            break
        if not row.lstrip().startswith("|"):
            break
        cells = [c.strip() for c in row.strip().strip("|").split("|")]
        if len(cells) >= 2:
            rows.append((cells[0], cells[1]))
        i += 1
    return rows, i


def render_member_block(
    name: str,
    summary: str,
    *,
    src_file: Path,
    dst_file: Path,
    path_map: dict[Path, Path],
) -> str:
    """Render a single member row from a class index as an H3 block.

    Pulls the full member doc (``<src_dir>/<name>.md``) if it exists,
    so parameters/returns/throws all land on the class page. Falls back
    to just the summary cell when no dedicated member file exists."""
    name_match = LINK_RE.match(name)
    if name_match:
        label = name_match.group(1)
        href = name_match.group(2)
    else:
        label, href = name.strip(), ""

    # Pull signature(s) + short description from the summary cell.
    # Dokka emits multiple overloads back-to-back without `<br />`
    # separators, so we additionally split on `public ` / `protected ` /
    # `static ` boundaries after the first one.
    pieces = [p.strip() for p in re.split(r"<br\s*/?>", summary) if p.strip()]
    pieces = [MODULE_TAG_RE.sub("", p).strip() for p in pieces if p.strip()]
    # Split each piece on additional **visibility** keyword starts
    # within the same string. We only split on `public` / `protected` /
    # `private` (not `static` / `abstract` / `final`) because those
    # always start a new declaration — whereas `final` and friends can
    # legitimately appear in the middle of one (`public final int x`).
    flattened: list[str] = []
    for piece in pieces:
        sub_pieces = re.split(
            r"(?<!^)(?=\b(?:public|protected|private)\s+)",
            piece,
        )
        flattened.extend(sp.strip() for sp in sub_pieces if sp.strip())
    pieces = flattened
    signatures: list[str] = []
    description_pieces: list[str] = []
    for piece in pieces:
        bare = strip_links(piece).strip()
        # Pick signatures even after we've seen a description, since
        # Dokka often emits "sig … description … sig … sig" for
        # overloaded methods / constructors.
        # A signature looks like a Java declaration: starts with a
        # visibility / modifier keyword (or `constructor` from Kotlin).
        # Parens are optional here — properties don't have them.
        looks_like_sig = (
            re.match(
                r"^(?:public|private|protected|static|final|abstract|"
                r"synchronized|volatile|transient|native|default)\b",
                bare,
            )
            is not None
            or bare.startswith("constructor")
        )
        if looks_like_sig:
            signatures.append(piece)
        else:
            description_pieces.append(piece)
    description = " ".join(description_pieces).strip()

    # Try to pull the full member doc.
    full_doc = ""
    member_md_path = None
    if href and not href.startswith(("http://", "https://", "#")):
        head, _, _ = href.partition("#")
        try:
            resolved = (src_file.parent / head).resolve()
        except (OSError, ValueError):
            resolved = None
        if resolved and resolved.is_file():
            member_md_path = resolved
            full_doc = resolved.read_text(encoding="utf-8")

    out: list[str] = []
    out.append(f"### {label}")
    out.append("")
    for sig in signatures:
        out.append(f"```java")
        out.append(strip_links(sig).strip())
        out.append("```")
        out.append("")
    if description:
        out.append(description)
        out.append("")

    # Extract the param / return / throws sections from the full member
    # doc so they appear inline on the class page.
    if full_doc:
        extra = extract_member_sections(full_doc, member_md_path, dst_file, path_map)
        if extra:
            out.append(extra)
            out.append("")  # blank line so JSX `<sub>` below stays in block context

    # No per-member permalink link — the H3 anchor IS the permalink, and
    # the per-member doc pages are pruned at the end of process_module.
    return "\n".join(out)


def extract_member_sections(
    text: str,
    src_file: Path | None,
    dst_file: Path,
    path_map: dict[Path, Path],
) -> str:
    """Pull the "Parameters" / "Throws" / "Deprecated" / etc. sections
    out of a member's dedicated Markdown file, rewrite their internal
    links to land on the class page, and return them as inline content."""
    if src_file is None:
        return ""
    # Drop the Dokka breadcrumb + the H1 (we already have a header here)
    body = DOKKA_BREADCRUMB_RE.sub("", text)
    body = re.sub(r"^#\s+.*?\n", "", body, count=1)
    body = MODULE_TAG_RE.sub("", body)
    # Strip the leading "public void name(args)" signature line(s) —
    # we already rendered them as the code block. Detection: every line
    # before the first non-signature paragraph that looks like a declaration.
    lines = body.splitlines()
    cleaned: list[str] = []
    seen_prose = False
    for line in lines:
        stripped = line.strip()
        if not seen_prose:
            if not stripped or re.match(r"^(public|private|protected|static|final|abstract)\b", stripped):
                continue
            seen_prose = True
        cleaned.append(line)
    body = "\n".join(cleaned).strip()
    if not body:
        return ""
    # Keep only the structured sub-sections we care about (Parameters,
    # Returns, Throws, Deprecated, See also, Since, Author). If none of
    # those exist, return an empty string — anything else would just
    # duplicate what the class-index summary cell already shows.
    wanted = re.findall(
        r"(####\s+(?:Parameters|Returns?|Throws|Deprecated|See also|Since|Author)[\s\S]*?)"
        r"(?=\n####\s|\Z)",
        body,
    )
    if not wanted:
        return ""
    body = "\n".join(wanted).strip()
    # Rewrite links to be relative to the destination class page.
    body = rewrite_links_from_origin(body, src_file, dst_file, path_map)
    return body


def rewrite_links_from_origin(
    text: str,
    src_file: Path,
    dst_file: Path,
    path_map: dict[Path, Path],
) -> str:
    return rewrite_links(text, src_file=src_file, dst_file=dst_file, path_map=path_map)


# ---------------------------------------------------------------------------
# Build per-class index, sidebar manifest
# ---------------------------------------------------------------------------


def build_class_index(
    text: str,
    *,
    src_file: Path,
    dst_file: Path,
    path_map: dict[Path, Path],
    module_dir: str,
    package_dotted: str | None,
) -> str:
    """Transform a class index page: wrap the class signature in a
    ``java`` code block, add the View-Source button, then expand each
    Constructors / Properties / Functions / Types table into a stream of
    H3 sections (with full member docs inlined)."""
    lines = text.splitlines()
    out: list[str] = []
    i = 0

    # Inject "View Source" right after the first H1 of the page if we
    # can guess the source path.
    while i < len(lines):
        line = lines[i]
        out.append(line)
        if line.startswith("# "):
            class_name = line[2:].strip()
            view_src = view_source_link(
                module_dir=module_dir,
                package_dotted=package_dotted,
                class_name=class_name,
            )
            if view_src:
                # Plain Markdown link — wrapping in an `<a>` element
                # makes MDX strict mode switch to JSX parsing for the
                # whole document, which then breaks on a hundred small
                # things (parens after links, sub elements, etc.). The
                # `.flx-view-source` class is applied via a CSS selector
                # that matches links to the framework's GitHub blob.
                out.append("")
                out.append(f"[View source on GitHub]({view_src})")
            i += 1
            break
        i += 1

    # Wrap the class signature line in a fenced ``java`` code block.
    # The signature is the first non-blank line *after* the H1 that
    # starts with `public class`, `abstract class`, `class `,
    # `interface `, `enum `, etc.
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            out.append(line)
            i += 1
            continue
        sig_match = re.match(
            r"^(?:public|protected|private|abstract|final|static|sealed|open)?\s*"
            r"(?:abstract|final|sealed|open)?\s*"
            r"(class|interface|enum|annotation)\b",
            stripped,
        )
        if sig_match:
            out.append("```java")
            out.append(strip_links(stripped))
            out.append("```")
            i += 1
        break

    # Continue rest of the document. When we hit one of the structural
    # section headers, eat the following table and rewrite as H3 blocks.
    while i < len(lines):
        line = lines[i]
        out.append(line)
        section = SECTION_HEADER_RE.match(line)
        if section:
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                out.append(lines[j])
                j += 1
            rows, after = parse_member_table(lines, j)
            if rows:
                for name, summary in rows:
                    out.append(
                        render_member_block(
                            name, summary,
                            src_file=src_file,
                            dst_file=dst_file,
                            path_map=path_map,
                        )
                    )
                i = after
                continue
        i += 1
    return "\n".join(out) + ("\n" if text.endswith("\n") else "")


def view_source_link(
    *, module_dir: str, package_dotted: str | None, class_name: str
) -> str | None:
    if not package_dotted:
        return None
    pkg_path = package_dotted.replace(".", "/")
    return (
        f"{GITHUB_BLOB_BASE}/{module_dir}/src/main/java/{pkg_path}/{class_name}.java"
    )


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def derive_package(src_file: Path, module_slug: str, module_name: str) -> str | None:
    """Recover the original Dokka package folder name for a given source
    file. We need it so View-Source URLs can be reconstructed."""
    src_root = DOKKA_OUT / module_slug / module_name
    try:
        rel = src_file.relative_to(src_root)
    except ValueError:
        return None
    parts = rel.parts
    if not parts:
        return None
    return parts[0]


def looks_like_class_folder(name: str) -> bool:
    return name.startswith("-")


def write_yaml(path: Path, title: str, *, sidebar_label: str | None = None,
               hide_title: bool = True, extra: dict[str, str] | None = None) -> None:
    sidebar_label = sidebar_label or title
    # We do NOT set `hide_title: true` here — the body already contains
    # its own H1 with the class/package name. Some SSR paths fail when
    # `hide_title` collides with how the auto-TOC builds its entry list,
    # so the safest option is to let Docusaurus render the H1 normally
    # and avoid the inline duplicate.
    fm_lines = ["---", f'title: "{title}"', f'sidebar_label: "{sidebar_label}"']
    for k, v in (extra or {}).items():
        fm_lines.append(f"{k}: {v}")
    fm_lines += ["---", ""]
    body = path.read_text(encoding="utf-8")
    # Drop the body's first H1 (we'd otherwise render it twice).
    body = re.sub(r"^\s*#\s+[^\n]+\n+", "", body, count=1)
    path.write_text("\n".join(fm_lines) + body, encoding="utf-8")


def process_module(module_slug: str, module_name: str, module_label: str) -> dict | None:
    """Process a single module's Dokka output and return a sidebar tree
    descriptor for it."""
    path_map = collect_path_map(module_slug, module_name)
    if not path_map:
        print(f"  (no output for {module_slug}, skipping)", file=sys.stderr)
        return None

    dst_root = SITE_API / module_slug
    # Wipe + recreate the module root.
    if dst_root.exists():
        shutil.rmtree(dst_root)
    dst_root.mkdir(parents=True, exist_ok=True)

    # First pass: copy + sanitise + rewrite links.
    for src, dst in path_map.items():
        dst.parent.mkdir(parents=True, exist_ok=True)
        text = src.read_text(encoding="utf-8")
        text = strip_control_chars(text)
        text = MODULE_TAG_RE.sub("", text)
        text = DOKKA_BREADCRUMB_RE.sub("", text)
        text = PAREN_LABEL_RE.sub(r"[\1]", text)
        text = fix_param_spacing(text)
        text = rewrite_links(text, src_file=src, dst_file=dst, path_map=path_map)
        text = wrap_signature_lines(text)
        text = BR_RE.sub("<br />", text)
        text = escape_curly_braces(text)
        # If this is the package overview page (Dokka's
        # "Package-level declarations" H1), replace the heading with the
        # real (short) package name.
        if dst.name == "index.md" and looks_like_package_folder(dst.parent):
            short = package_label_for(dst.parent, dst_root)
            text = text.replace(
                "# Package-level declarations",
                f"# `{short}`",
                1,
            )
        dst.write_text(text, encoding="utf-8")

    # Second pass: turn class index pages into proper class views (with
    # inline member docs). We do this AFTER the first pass so that
    # ``render_member_block`` can read sibling member files that have
    # already been sanitised.
    for src, dst in list(path_map.items()):
        if dst.name != "index.md":
            continue
        if dst.parent == dst_root:
            continue  # module root index — leave alone for now
        if not looks_like_class_folder(dst.parent.name):
            continue
        package_dotted = derive_package(src, module_slug, module_name)
        # Read the (already sanitised) destination; reconstruct the
        # member docs using the SOURCE files in dokka-out so we get raw
        # parameter sections without the curly-brace escapes that the
        # first pass injected.
        text = dst.read_text(encoding="utf-8")
        rebuilt = build_class_index(
            text,
            src_file=src,
            dst_file=dst,
            path_map=path_map,
            module_dir=module_name,
            package_dotted=package_dotted,
        )
        dst.write_text(rebuilt, encoding="utf-8")

    # Write front-matter for every .md file we copied.
    for src, dst in path_map.items():
        if not dst.exists() or dst.suffix != ".md":
            continue
        body = dst.read_text(encoding="utf-8")
        if body.startswith("---\n"):
            continue
        title = "Overview"
        h1 = H1_RE.search(body)
        if h1:
            title = re.sub(r"\[(.*?)\]\([^)]*\)", r"\1", h1.group(1))
            title = re.sub(r"<[^>]+>", "", title).strip()
            title = title.replace("`", "").replace('"', "'")
        # Decide whether this is an "interesting" page (class / package
        # / module overview) or a hidden member detail.
        hide = False
        sidebar_label = title
        if dst.name != "index.md":
            # Per-member page — hide from sidebar; its content is already
            # inlined on the class page.
            hide = True
        if looks_like_class_folder(dst.parent.name) and dst.name == "index.md":
            sidebar_label = kebab_to_pascal(dst.parent.name)
            title = sidebar_label
        extra = {}
        if hide:
            extra["sidebar_class_name"] = "flx-hidden-sidebar"
        write_yaml(dst, title, sidebar_label=sidebar_label, extra=extra)

    # Inside class folders the only file we want is `index.md` — every
    # other `.md` is a per-member page whose content is already inlined
    # on the class index. Keeping them around creates route collisions
    # (Dokka emits `<class>.md` both next to and inside the class
    # folder), MDX strict-mode failures from their auto-generated
    # signatures, and useless extra entries in the sidebar.
    for base, dirs, files in os.walk(dst_root):
        base_path = Path(base)
        if looks_like_class_folder(base_path.name):
            for f in files:
                if f != "index.md" and f.endswith(".md"):
                    (base_path / f).unlink()
        # Sibling collision: `<Pkg>/<Class>.md` next to `<Pkg>/<Class>/`.
        for d in dirs:
            colliding = base_path / f"{d}.md"
            if colliding.is_file():
                colliding.unlink()

    # Emit _category_.json files: one per package folder, one per class folder.
    for folder, label, kind in walk_categories(dst_root, module_label):
        cat = {
            "label": label,
            "collapsible": True,
            "collapsed": True,
            "customProps": {kind: True},
        }
        (folder / "_category_.json").write_text(
            json.dumps(cat, indent=2), encoding="utf-8"
        )

    return {"slug": module_slug, "label": module_label}


def walk_categories(root: Path, module_label: str) -> Iterable[tuple[Path, str, str]]:
    """Yield (folder, sidebar-label, kind) for every folder in the module
    tree that should appear as a sidebar category."""
    for base, dirs, files in os.walk(root):
        base_path = Path(base)
        if base_path == root:
            continue
        if looks_like_class_folder(base_path.name):
            label = kebab_to_pascal(base_path.name)
            yield base_path, label, "isClass"
        else:
            yield base_path, base_path.name, "isPackage"


def write_sidebar_manifest(modules: list[dict]) -> None:
    manifest = {
        "modules": modules,
    }
    out_dir = SITE_API / "_meta"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "modules.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )


def main() -> None:
    processed: list[dict] = []
    for slug, name, label in MODULES:
        info = process_module(slug, name, label)
        if info:
            processed.append(info)
    write_sidebar_manifest(processed)
    print(f"  processed {len(processed)} modules: " +
          ", ".join(m["slug"] for m in processed))


if __name__ == "__main__":
    main()
