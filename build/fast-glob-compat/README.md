# Scoped build glob compatibility

This local package replaces `fast-glob` for two verified build consumers:

- `@next/eslint-plugin-next/dist/utils/get-root-dirs.js` calls named
  `globSync(pattern, { onlyDirectories: true })`.
- `vite-plugin-dynamic-import/dist/index.mjs` imports the default function and
  calls `.sync(patternArray, { cwd })`, including extension braces and index files.

It uses the unmodified official `tinyglobby` 0.2.17 parser and crawler. It does
not include `micromatch` or the vulnerable `braces` parser, impersonate their
versions, or bypass dependency auditing. `expandDirectories` is always false,
as required by [tinyglobby's fast-glob migration documentation](https://superchupu.dev/tinyglobby/migration).
In particular, a directory pattern does not implicitly match its contents.

CommonJS exports a callable async function with `glob` and `async` aliases,
plus the identical `sync`/`globSync` function. ESM provides the same default
function and named aliases. Results are string paths, normally relative to
`cwd`, unique, and files only; ordering is unspecified. Supported options are
`cwd` (string), `absolute`, `braceExpansion`, `caseSensitiveMatch`, `dot`,
`extglob`, `globstar`, `onlyDirectories`, `onlyFiles` (booleans), and `ignore`
(string or string array). `onlyDirectories: true` takes precedence over
`onlyFiles`. Negated patterns, extension alternatives, globstars, escaped
literal braces, and absolute patterns are covered by compatibility tests.
The adapter restores `./` prefixes and unmarked directory paths. Absolute
input patterns keep absolute output paths, matching fast-glob. A call must
use one path form for all positive patterns (relative, `./`-prefixed, or
absolute); mixed forms are rejected because the parsers group such results
differently. Negative patterns can use a different form.

This is deliberately not the full fast-glob API. Streams, filesystem
adapters, depth limits, symlink configuration, object/stat results, task
generation, path utilities, and other options are not supported. Unknown
options throw instead of being silently ignored. New consumers must extend
and verify this adapter or use a compatible upstream implementation.

Before invoking the parser, every entry point validates both positive and
ignore patterns in one pass. Inputs are limited to 128 combined patterns,
4096 characters per pattern, 32768 combined characters, and at most 16 opening
brace characters (`{`) per pattern. This intentionally conservative brace
budget also counts escaped braces and braces inside quotes or character
classes. Raw-string nesting alone is unsafe: path normalization may remove
closing-brace path segments, while quoted closing braces may not close the
parser's brace state. Counting every opening character prevents those
transformations, including escape normalization, from hiding a larger parser
depth. Even disabled brace expansion does not bypass validation. Pattern arrays and
options are copied before async execution. Empty arrays are valid, empty
strings and non-string entries are rejected. These limits are intended for
trusted build patterns rather than arbitrary user-generated glob workloads.
Unclosed character classes are also rejected, so a parser's literal-bracket
fallback cannot hide brace nesting from input validation.

`tests/glob-compat.test.mjs` records expected results checked against the
previous fast-glob 3.3.1 before replacement. An optional
`FAST_GLOB_REFERENCE_PATH` can point to an external copy for direct differential
verification; the old parser is not a dependency of the project or its CI.
