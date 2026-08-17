#!/usr/bin/env node

import { execSync } from 'child_process';

// Delegate to @even-toolkit/create-even-app
const args = process.argv.slice(2).join(' ');
try {
  execSync(`npx @even-toolkit/create-even-app ${args}`, { stdio: 'inherit' });
} catch {
  process.exit(1);
}
