/**
 * Install the site template's dependencies, once.
 *
 * Every task copies `templates/landing` into its sandbox and shares this
 * node_modules tree, so this runs once per machine rather than once per task.
 * Without it the first site task spends a minute on `npm install` and PRD
 * section 10's three-minute first preview is gone before the agent has written
 * anything.
 *
 *   npm run seed            (add -- --force to reinstall)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { npmCommand } from '../src/core/platform.ts';
import { templateDir, templateIsSeeded } from '../src/core/site/seed.ts';

const exec = promisify(execFile);
const run = (tool: 'npm', args: string[], options: { cwd: string; maxBuffer: number }) => {
  const cmd = npmCommand(tool, args);
  return exec(cmd.file, cmd.args, options);
};

const dir = templateDir();
if (templateIsSeeded() && !process.argv.includes('--force')) {
  console.log(`already seeded: ${dir}/node_modules`);
  console.log('run `npm run seed -- --force` to reinstall.');
  process.exit(0);
}

console.log(`installing ${dir} ...`);
const started = Date.now();
await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, maxBuffer: 32 * 1024 * 1024 });
console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);

console.log('checking the template builds ...');
await run('npm', ['run', 'build'], { cwd: dir, maxBuffer: 32 * 1024 * 1024 });
console.log('template builds clean. Site tasks will start from it in under a second.');
