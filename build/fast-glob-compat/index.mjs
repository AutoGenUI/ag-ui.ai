import glob from './index.cjs';

const globSync = glob.globSync;
const asyncGlob = glob;

export default glob;
export { glob, globSync, globSync as sync, asyncGlob as async };
