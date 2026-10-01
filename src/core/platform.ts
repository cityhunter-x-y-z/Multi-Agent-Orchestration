/**
 * The few places where Windows and POSIX disagree about how to start a process.
 *
 * On macOS and Linux every function here returns exactly what the callers used
 * before: `/bin/bash`, and `npm` / `npx` by name. Only win32 takes another path.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';

/**
 * How to run `npm` or `npx` with execFile/spawn.
 *
 * On Windows they are `.cmd` shims, which Node refuses to execFile without a
 * shell (and a shell re-parses the arguments). Running npm's own CLI script
 * with this Node binary sidesteps both.
 */
export function npmCommand(tool: 'npm' | 'npx', args: string[]): { file: string; args: string[] } {
  if (!isWindows) return { file: tool, args };
  const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', `${tool}-cli.js`);
  if (existsSync(cli)) return { file: process.execPath, args: [cli, ...args] };
  // npm_execpath is set when we are ourselves running under an npm script.
  const fromEnv = process.env.npm_execpath;
  if (fromEnv && existsSync(fromEnv) && /npm-cli\.js$/.test(fromEnv)) {
    const script = tool === 'npm' ? fromEnv : path.join(path.dirname(fromEnv), 'npx-cli.js');
    if (existsSync(script)) return { file: process.execPath, args: [script, ...args] };
  }
  throw new Error(`could not find ${tool}-cli.js next to ${process.execPath}; is npm installed with Node?`);
}

let bash: string | null | undefined;

/**
 * A bash to run sandbox commands with, or null when none exists.
 *
 * Windows ships a `bash.exe` in System32 and WindowsApps that is the WSL
 * launcher, not a shell for this filesystem, so those are skipped. Git for
 * Windows' bash is found through `RUNNER_BASH`, next to `git` on PATH, or in
 * its default install location.
 */
export function resolveBash(): string | null {
  if (!isWindows) return '/bin/bash';
  if (bash !== undefined) return bash;

  const candidates: string[] = [];
  if (process.env.RUNNER_BASH) candidates.push(process.env.RUNNER_BASH);

  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    if (existsSync(path.join(dir, 'git.exe'))) {
      // <git>\cmd\git.exe or <git>\mingw64\bin\git.exe -> <git>\bin\bash.exe
      let root = path.dirname(dir);
      if (path.basename(root).toLowerCase() === 'mingw64') root = path.dirname(root);
      candidates.push(path.join(root, 'bin', 'bash.exe'));
    }
  }
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]) {
    if (base) candidates.push(path.join(base, 'Git', 'bin', 'bash.exe'), path.join(base, 'Programs', 'Git', 'bin', 'bash.exe'));
  }
  for (const dir of dirs) {
    const lower = dir.toLowerCase();
    if (lower.includes('\\windows\\system32') || lower.includes('\\windowsapps')) continue;
    candidates.push(path.join(dir, 'bash.exe'));
  }

  bash = candidates.find((c) => existsSync(c)) ?? null;
  return bash;
}
