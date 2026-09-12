# LaTeX and Layout Quality Assurance

The user's source template is authoritative. Preserve its document class, macros, typography, and geometry unless the user explicitly allows layout changes.

## Required checks

1. Escape LaTeX-sensitive characters in generated text: `&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, and `^`.
2. Keep braces and environments balanced.
3. Preserve hyperlinks and contact information.
4. Avoid invisible text, tiny fonts, off-page text, or metadata keyword injection.
5. Keep headings, dates, roles, and bullets in a clean reading order.
6. Respect `maximum_pages` from candidate preferences.
7. Avoid trailing orphan words and visibly underfilled continuation lines when concise wording can fix them.

## Compilation

When `pdflatex` is available, compile in an isolated directory with nonstop interaction. A second pass may be used for references. Record the exact command and exit status.

Verify:

- expected PDF exists;
- page count does not exceed the user's preference;
- extracted text contains the candidate name, standard sections, dates, and bullet content in reading order;
- the log has no fatal errors;
- overfull boxes are reviewed rather than silently ignored.

If compilation tooling is unavailable, return `compile_status: not_checked`.

## Safe recovery order

If the document is too long or overflows:

1. remove redundant wording introduced by tailoring;
2. restore shorter original phrasing;
3. remove low-priority content only if the user permits removal;
4. make small spacing changes only if the user permits layout edits.

Never solve overflow by shrinking text below the user's minimum font size, hiding content, changing identity facts, or overwriting the master resume.

## Format support

This skill is optimized for LaTeX. If the host accepts another format, it must provide an equivalent parser, renderer, and structural validator; otherwise the result should be limited to content recommendations.
