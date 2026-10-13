'use strict';

const tinyglobby = require('tinyglobby');
const { isAbsolute } = require('node:path');

// Bound work before any pattern reaches the parser, including ignore patterns.
const MAX_PATTERN_LENGTH = 4096;
const MAX_PATTERN_COUNT = 128;
const MAX_TOTAL_LENGTH = 32768;
const MAX_OPENING_BRACES = 16;
const BOOLEAN_OPTIONS = new Set([
  'absolute', 'braceExpansion', 'caseSensitiveMatch', 'dot', 'extglob',
  'globstar', 'onlyDirectories', 'onlyFiles',
]);
const SUPPORTED_OPTIONS = new Set([...BOOLEAN_OPTIONS, 'cwd', 'ignore']);

function copyPatterns(input, label, budget) {
  const patterns = typeof input === 'string' ? [input] : input;
  if (!Array.isArray(patterns)) {
    throw new TypeError(`${label} must be a non-empty string or an array of non-empty strings`);
  }
  if (patterns.length + budget.count > MAX_PATTERN_COUNT) {
    throw new RangeError(`Glob input exceeds ${MAX_PATTERN_COUNT} patterns, including ignore patterns`);
  }
  const result = [];
  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || pattern.length === 0) {
      throw new TypeError(`${label} must contain only non-empty strings`);
    }
    if (pattern.length > MAX_PATTERN_LENGTH) {
      throw new RangeError(`Glob pattern exceeds ${MAX_PATTERN_LENGTH} characters`);
    }
    budget.count += 1;
    budget.length += pattern.length;
    if (budget.length > MAX_TOTAL_LENGTH) {
      throw new RangeError(`Glob input exceeds ${MAX_TOTAL_LENGTH} total characters`);
    }

    let openingBraces = 0;
    let escaped = false;
    let characterClass = false;
    for (const character of pattern) {
      // Count opening characters even in escapes, quotes and character classes.
      // Path normalization can remove a closing-brace segment, and quoted
      // closing braces need not close parser state. A raw depth counter is
      // therefore insufficient; later parsing cannot add opening characters.
      if (character === '{') {
        openingBraces += 1;
        if (openingBraces > MAX_OPENING_BRACES) {
          throw new RangeError(`Glob pattern exceeds ${MAX_OPENING_BRACES} opening braces`);
        }
      }
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (characterClass) {
        if (character === ']') characterClass = false;
      } else if (character === '[') {
        characterClass = true;
      }
    }
    // Picomatch can interpret an unmatched '[' as a literal and subsequently
    // parse its braces. Reject it so it cannot hide nesting from this guard.
    if (characterClass) {
      throw new TypeError('Unclosed glob character classes are not supported');
    }
    result.push(pattern);
  }
  return result;
}

function prepare(source, inputOptions = {}) {
  if (inputOptions === null || typeof inputOptions !== 'object' || Array.isArray(inputOptions)) {
    throw new TypeError('Glob options must be a plain object');
  }
  const prototype = Object.getPrototypeOf(inputOptions);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Glob options must be a plain object');
  }
  const options = { expandDirectories: false };
  for (const key of Reflect.ownKeys(inputOptions)) {
    if (!SUPPORTED_OPTIONS.has(key)) {
      throw new TypeError(`Unsupported fast-glob compatibility option: ${String(key)}`);
    }
    const value = inputOptions[key];
    if (value === undefined) continue;
    if (BOOLEAN_OPTIONS.has(key) && typeof value !== 'boolean') {
      throw new TypeError(`Glob option ${key} must be a boolean`);
    }
    if (key === 'cwd' && typeof value !== 'string') {
      throw new TypeError('Glob option cwd must be a string');
    }
    options[key] = value;
  }
  const budget = { count: 0, length: 0 };
  const patterns = copyPatterns(source, 'Patterns', budget);
  if (options.ignore !== undefined) {
    options.ignore = copyPatterns(options.ignore, 'Ignore patterns', budget);
  }
  const pathForms = new Set();
  for (const pattern of patterns) {
    if (pattern.startsWith('!') && !pattern.startsWith('!(')) continue;
    pathForms.add(isAbsolute(pattern) ? 'absolute' : pattern.startsWith('./') ? 'dot' : 'relative');
  }
  if (pathForms.size > 1) {
    throw new TypeError('Mixed absolute, ./-prefixed, and relative positive patterns are not supported');
  }
  const pathForm = pathForms.values().next().value;
  // fast-glob keeps absolute inputs absolute, even with absolute: false.
  if (pathForm === 'absolute') options.absolute = true;
  const dotPrefix = pathForm === 'dot' && !options.absolute;
  return { patterns, options, dotPrefix };
}

function formatPaths(paths, dotPrefix) {
  return paths.map((path) => {
    // tinyglobby can mark relative directory entries with a trailing slash.
    const unmarked = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
    return dotPrefix ? `./${unmarked}` : unmarked;
  });
}

async function glob(source, inputOptions) {
  const { patterns, options, dotPrefix } = prepare(source, inputOptions);
  return formatPaths(await tinyglobby.glob(patterns, options), dotPrefix);
}

function globSync(source, inputOptions) {
  const { patterns, options, dotPrefix } = prepare(source, inputOptions);
  return formatPaths(tinyglobby.globSync(patterns, options), dotPrefix);
}

module.exports = glob;
module.exports.glob = glob;
module.exports.async = glob;
module.exports.sync = globSync;
module.exports.globSync = globSync;
