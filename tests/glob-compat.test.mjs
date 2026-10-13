import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import defaultGlob, { glob, globSync, sync, async as asyncGlob } from '../build/fast-glob-compat/index.mjs';

const require = createRequire(import.meta.url);
const cjs = require('../build/fast-glob-compat');
// Differential control is external and optional; never install the old parser in CI.
const reference = process.env.FAST_GLOB_REFERENCE_PATH
  ? require(process.env.FAST_GLOB_REFERENCE_PATH)
  : null;
const sorted = (paths) => [...paths].sort();
const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'ag-ui-glob-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['apps/web', 'apps/api', 'apps/.hidden', 'src/views/folder']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  for (const file of [
    'apps/readme.txt', 'src/main.ts', 'src/views/home.tsx', 'src/views/info.jsx',
    'src/views/index.ts', 'src/views/folder/index.js', 'src/views/ignored.css',
    'src/views/.secret.ts', 'src/views/{literal}.ts', 'src/views/n1.ts', 'src/views/n2.ts',
  ]) writeFileSync(join(root, file), 'fixture');
  return root;
};
const compare = async (patterns, options, expected) => {
  assert.deepEqual(sorted(globSync(patterns, options)), sorted(expected));
  assert.deepEqual(sorted(await glob(patterns, options)), sorted(expected));
  if (reference) {
    assert.deepEqual(sorted(globSync(patterns, options)), sorted(reference.sync(patterns, options)));
    assert.deepEqual(sorted(await glob(patterns, options)), sorted(await reference(patterns, options)));
  }
};

test('CJS and ESM export callable defaults and identical aliases', async (t) => {
  const root = fixture(t);
  assert.equal(cjs, defaultGlob);
  assert.equal(cjs.glob, glob);
  assert.equal(cjs.async, asyncGlob);
  assert.equal(cjs.sync, sync);
  assert.equal(cjs.globSync, globSync);
  assert.equal(glob, defaultGlob);
  assert.equal(asyncGlob, defaultGlob);
  assert.equal(sync, globSync);
  for (const entry of [cjs, cjs.glob, cjs.async, defaultGlob, glob, asyncGlob]) {
    assert.deepEqual(await entry('src/main.ts', { cwd: root }), ['src/main.ts']);
  }
  for (const entry of [cjs.sync, cjs.globSync, sync, globSync]) {
    assert.deepEqual(entry('src/main.ts', { cwd: root }), ['src/main.ts']);
  }
});

test('dynamic-import extension braces and index expansion preserve relative paths', async (t) => {
  const root = fixture(t);
  const patterns = ['./views/*.{js,jsx,ts,tsx}', './views/*/index.{js,jsx,ts,tsx}'];
  const expected = [
    './views/folder/index.js', './views/home.tsx', './views/index.ts', './views/info.jsx',
    './views/n1.ts', './views/n2.ts', './views/{literal}.ts',
  ];
  await compare(patterns, { cwd: join(root, 'src') }, expected);
});

test('real Next root helper and dynamic-import transform retain their consumer behavior', async (t) => {
  const root = fixture(t);
  const adapterEntry = realpathSync(fileURLToPath(new URL('../build/fast-glob-compat/index.cjs', import.meta.url)));
  assert.equal(realpathSync(require.resolve('fast-glob')), adapterEntry);
  assert.equal(require('fast-glob'), cjs);
  for (const consumerEntry of [
    require.resolve('@next/eslint-plugin-next/dist/utils/get-root-dirs.js'),
    import.meta.resolve('vite-plugin-dynamic-import'),
  ]) {
    const consumerRequire = createRequire(consumerEntry);
    assert.equal(realpathSync(consumerRequire.resolve('fast-glob')), adapterEntry);
    assert.equal(consumerRequire('fast-glob'), cjs);
  }
  const { getRootDirs } = require('@next/eslint-plugin-next/dist/utils/get-root-dirs.js');
  assert.deepEqual(sorted(getRootDirs({ cwd: root, settings: { next: { rootDir: join(root, 'apps/*') } } })),
    sorted([join(root, 'apps/api'), join(root, 'apps/web')]));
  const { default: dynamicImport } = await import('vite-plugin-dynamic-import');
  const plugin = dynamicImport({ loose: false });
  plugin.configResolved({
    root, resolve: { alias: [], extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    optimizeDeps: {}, createResolver: () => async () => undefined,
  });
  const transformed = await plugin.transform('export const load = name => import(`./views/${name}`);', join(root, 'src/main.ts'));
  assert.ok(transformed?.code.includes("import('./views/home.tsx')"));
  assert.ok(transformed.code.includes("import('./views/folder/index.js')"));
  assert.ok(transformed.code.includes("case './views/folder':"));
  assert.ok(!transformed.code.includes('.secret.ts'));
  assert.ok(!transformed.code.includes('ignored.css'));
});

test('Next root globs include only directories, without trailing marks', async (t) => {
  const root = fixture(t);
  await compare('apps/*', { cwd: root, onlyDirectories: true }, ['apps/api', 'apps/web']);
  await compare('apps/*', { cwd: root, onlyDirectories: true, onlyFiles: true }, ['apps/api', 'apps/web']);
  await compare('apps/{web,api}', { cwd: root, onlyDirectories: true }, ['apps/api', 'apps/web']);
  await compare('./apps/*', { cwd: root, onlyDirectories: true }, ['./apps/api', './apps/web']);
});

test('default only-files behavior never recursively expands a directory pattern', async (t) => {
  const root = fixture(t);
  await compare('src/views', { cwd: root }, []);
  await compare('src/views/', { cwd: root }, []);
  await compare('apps/*', { cwd: root }, ['apps/readme.txt']);
  await compare('apps/*', { cwd: root, onlyFiles: false }, ['apps/api', 'apps/readme.txt', 'apps/web']);
});

test('cwd defaults to the process directory without mutating it', async () => {
  const originalCwd = process.cwd();
  const pattern = resolve(dirname(fileURLToPath(import.meta.url)), '../build/fast-glob-compat/package.json');
  await compare(pattern, {}, [pattern]);
  assert.equal(process.cwd(), originalCwd);
});

test('absolute inputs and absolute output options preserve fast-glob path semantics', async (t) => {
  const root = fixture(t);
  await compare(join(root, 'apps/*'), { cwd: root, onlyDirectories: true }, [join(root, 'apps/api'), join(root, 'apps/web')]);
  await compare(join(root, 'src/main.ts'), { cwd: root, absolute: false }, [join(root, 'src/main.ts')]);
  await compare('./src/main.ts', { cwd: root, absolute: true }, [join(root, 'src/main.ts')]);
});

test('negative patterns and ignore arrays exclude matches from every positive glob', async (t) => {
  const root = fixture(t);
  await compare(['src/**/*.ts', '!src/views/**'], { cwd: root }, ['src/main.ts']);
  await compare(['src/**/*.ts', 'src/main.ts'], { cwd: root, ignore: ['src/views/**'] }, ['src/main.ts']);
  await compare('src/**/*.ts', { cwd: root, ignore: 'src/views/**' }, ['src/main.ts']);
  await compare(['./src/**/*.ts', '!src/views/**'], { cwd: root }, ['./src/main.ts']);
});

test('hidden entries are omitted by default and included only when requested', async (t) => {
  const root = fixture(t);
  await compare('src/views/*.ts', { cwd: root }, ['src/views/index.ts', 'src/views/n1.ts', 'src/views/n2.ts', 'src/views/{literal}.ts']);
  await compare('src/views/*.ts', { cwd: root, dot: true }, ['src/views/.secret.ts', 'src/views/index.ts', 'src/views/n1.ts', 'src/views/n2.ts', 'src/views/{literal}.ts']);
  await compare('apps/*', { cwd: root, dot: true, onlyDirectories: true }, ['apps/.hidden', 'apps/api', 'apps/web']);
});

test('ordinary brace ranges, extglobs, case folding and duplicate globs match the control', async (t) => {
  const root = fixture(t);
  await compare('src/views/n{1..2}.ts', { cwd: root }, ['src/views/n1.ts', 'src/views/n2.ts']);
  await compare('src/views/@(home|info).@(tsx|jsx)', { cwd: root }, ['src/views/home.tsx', 'src/views/info.jsx']);
  await compare('src/views/INDEX.ts', { cwd: root, caseSensitiveMatch: false }, ['src/views/index.ts']);
  await compare(['src/main.ts', 'src/**/*.ts'], { cwd: root, ignore: 'src/views/**' }, ['src/main.ts']);
  await compare([], { cwd: root }, []);
});

test('escaped braces are literal and brace expansion can be disabled', async (t) => {
  const root = fixture(t);
  await compare('src/views/\\{literal\\}.ts', { cwd: root }, ['src/views/{literal}.ts']);
  await compare('src/views/{literal}.ts', { cwd: root, braceExpansion: false }, ['src/views/{literal}.ts']);
});

test('all entry points reject malicious nesting and oversized inputs before parsing', async () => {
  const nested = '{'.repeat(17) + 'a,b' + '}'.repeat(17);
  const invalid = [
    [nested, undefined, /opening braces/],
    ['x'.repeat(4097), undefined, /4096/],
    [Array(129).fill('a'), undefined, /128/],
    [Array(9).fill('x'.repeat(4000)), undefined, /32768/],
    ['safe', { ignore: nested }, /opening braces/],
    [Array(128).fill('a'), { ignore: 'b' }, /128/],
    [Array(8).fill('x'.repeat(4000)), { ignore: 'y'.repeat(1000) }, /32768/],
    [nested, { braceExpansion: false }, /opening braces/],
    [['safe', nested], undefined, /opening braces/],
    [['safe'], { ignore: ['safe', nested] }, /opening braces/],
  ];
  for (const [patterns, options, message] of invalid) {
    for (const entry of [cjs.sync, cjs.globSync, sync, globSync]) {
      assert.throws(() => entry(patterns, options), { name: 'RangeError', message });
    }
    for (const entry of [cjs, cjs.glob, cjs.async, defaultGlob, glob, asyncGlob]) {
      await assert.rejects(entry(patterns, options), { name: 'RangeError', message });
    }
  }
});

test('path normalization, quoted closers and escapes cannot hide oversized brace input', async () => {
  const normalized = 'a{,/b}/../'.repeat(17) + 'a,b' + '}'.repeat(17);
  const quotedClosers = ('{a,'.repeat(16) + '"' + '}'.repeat(16) + '"').repeat(4) + 'a,b' + '}'.repeat(64);
  const escaped = '\\{'.repeat(17) + 'not-a-file' + '\\}'.repeat(17);
  const escapedNormalization = 'a\\{/../'.repeat(17) + 'not-a-file';
  const characterClasses = '[{}]'.repeat(17) + 'not-a-file';
  const excessOpenings = [normalized, quotedClosers, escaped, escapedNormalization, characterClasses, '\\\\' + '{'.repeat(17)];
  for (const pattern of excessOpenings) {
    for (const [patterns, options] of [
      [pattern, undefined], [pattern, { braceExpansion: false }],
      [['safe', pattern], undefined], [['safe', '!' + pattern], undefined],
      ['safe', { ignore: pattern }], ['safe', { ignore: ['safe', pattern] }],
    ]) {
      for (const entry of [cjs.sync, cjs.globSync, sync, globSync]) {
        assert.throws(() => entry(patterns, options), { name: 'RangeError', message: /opening braces/ });
      }
      for (const entry of [cjs, cjs.glob, cjs.async, defaultGlob, glob, asyncGlob]) {
        await assert.rejects(entry(patterns, options), { name: 'RangeError', message: /opening braces/ });
      }
    }
  }
  assert.deepEqual(globSync('{' + '\\}'.repeat(20) + '}'), []);
  const unmatchedClass = '[{a,b}';
  for (const entry of [cjs.sync, cjs.globSync, sync, globSync]) {
    assert.throws(() => entry(unmatchedClass), /Unclosed/);
  }
  for (const entry of [cjs, cjs.glob, cjs.async, defaultGlob, glob, asyncGlob]) {
    await assert.rejects(entry(unmatchedClass), /Unclosed/);
  }
});

test('the conservative brace boundary still allows sixteen escaped literal openings', async (t) => {
  const root = fixture(t);
  const filename = 'literal-' + '{'.repeat(16) + 'name' + '}'.repeat(16) + '.ts';
  const pattern = 'literal-' + '\\{'.repeat(16) + 'name' + '\\}'.repeat(16) + '.ts';
  writeFileSync(join(root, filename), 'literal fixture');
  await compare(pattern, { cwd: root }, [filename]);
  assert.deepEqual(await glob('[{}]'.repeat(16) + 'not-a-file', { cwd: root }), []);
});

test('unsupported APIs, mixed forms, invalid types and unknown options fail explicitly', async () => {
  for (const options of [
    { deep: 1 }, { fs: {} }, { objectMode: true }, { stats: false },
    { expandDirectories: true }, { followSymbolicLinks: false }, { unknown: undefined },
    { [Symbol('unknown')]: true }, { cwd: new URL('file:///tmp/') }, { dot: 'yes' },
    null, [], Object.create({ cwd: '/' }),
  ]) {
    assert.throws(() => globSync('*.js', options), TypeError);
    await assert.rejects(glob('*.js', options), TypeError);
  }
  for (const patterns of ['', null, {}, [1], ['ok', ''], ['a', './b'], ['/a', 'b']]) {
    assert.throws(() => globSync(patterns), TypeError);
    await assert.rejects(glob(patterns), TypeError);
  }
  assert.equal(cjs.stream, undefined);
  assert.equal(cjs.generateTasks, undefined);
  assert.equal(cjs.isDynamicPattern, undefined);
});

test('async calls snapshot options and pattern arrays before the caller can mutate them', async (t) => {
  const root = fixture(t);
  const patterns = ['src/main.ts'];
  const options = { cwd: root, ignore: [] };
  const pending = glob(patterns, options);
  patterns[0] = '{'.repeat(10000);
  options.ignore.push('**');
  options.cwd = '/not-a-real-path';
  assert.deepEqual(await pending, ['src/main.ts']);
});
