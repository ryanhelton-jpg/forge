#!/usr/bin/env node
// Forge CLI - Entry point for npm package

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

// Config location
const CONFIG_DIR = join(homedir(), '.forge');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DATA_DIR = join(CONFIG_DIR, 'data');

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {}
  }
  return {};
}

function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setup() {
  console.log('\n⚒️  Forge Setup\n');
  
  const config = loadConfig();
  
  // API Key
  if (!config.openrouterApiKey) {
    console.log('Forge uses OpenRouter to access LLMs (Claude, GPT, etc.)');
    console.log('Get your API key at: https://openrouter.ai/keys\n');
    
    const apiKey = await prompt('OpenRouter API Key: ');
    if (!apiKey) {
      console.log('API key required. Run `forge setup` again when ready.');
      process.exit(1);
    }
    config.openrouterApiKey = apiKey;
  }
  
  // Port
  if (!config.port) {
    const port = await prompt('Port (default 3030): ') || '3030';
    config.port = parseInt(port);
  }
  
  // Auth token
  if (!config.authToken) {
    const crypto = await import('crypto');
    config.authToken = crypto.randomBytes(16).toString('hex');
    console.log(`\nGenerated auth token: ${config.authToken}`);
    console.log('(Save this - needed to access the web UI)\n');
  }
  
  saveConfig(config);
  console.log('✅ Configuration saved to ~/.forge/config.json\n');
  console.log('Run `forge start` to launch the server.\n');
}

async function start() {
  ensureConfigDir();
  const config = loadConfig();
  
  if (!config.openrouterApiKey) {
    console.log('Forge not configured. Running setup...\n');
    await setup();
    return start();
  }
  
  console.log('\n⚒️  Starting Forge...\n');
  
  // Set environment variables
  const env = {
    ...process.env,
    OPENROUTER_API_KEY: config.openrouterApiKey,
    PORT: String(config.port || 3030),
    FORGE_TOKEN: config.authToken,
    DATA_DIR: DATA_DIR,
  };
  
  // Find and run the server
  const serverPath = join(packageRoot, 'dist', 'server.js');
  const tsServerPath = join(packageRoot, 'src', 'server.ts');
  
  let cmd, args;
  if (existsSync(serverPath)) {
    // Production: use compiled JS
    cmd = 'node';
    args = [serverPath];
  } else if (existsSync(tsServerPath)) {
    // Development: use tsx
    cmd = 'npx';
    args = ['tsx', tsServerPath];
  } else {
    console.error('Error: Server not found. Try reinstalling forge.');
    process.exit(1);
  }
  
  const child = spawn(cmd, args, {
    env,
    stdio: 'inherit',
    cwd: packageRoot,
  });
  
  child.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

function showConfig() {
  const config = loadConfig();
  console.log('\n⚒️  Forge Configuration\n');
  console.log(`Config file: ${CONFIG_FILE}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Port: ${config.port || 3030}`);
  console.log(`API Key: ${config.openrouterApiKey ? '***' + config.openrouterApiKey.slice(-4) : 'Not set'}`);
  console.log(`Auth Token: ${config.authToken || 'Not set'}`);
  console.log('');
}

function showHelp() {
  console.log(`
⚒️  Forge - Self-evolving AI agent framework

Usage:
  forge <command>

Commands:
  start     Start the Forge server
  setup     Configure Forge (API key, port, etc.)
  config    Show current configuration
  version   Show version
  help      Show this help

Examples:
  forge setup     # First-time configuration
  forge start     # Launch the server
  forge config    # View settings

Documentation: https://github.com/ryanhelton/forge
`);
}

function showVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'));
    console.log(`Forge v${pkg.version}`);
  } catch {
    console.log('Forge (version unknown)');
  }
}

// Main
const command = process.argv[2] || 'help';

switch (command) {
  case 'start':
    start();
    break;
  case 'setup':
    setup();
    break;
  case 'config':
    showConfig();
    break;
  case 'version':
  case '-v':
  case '--version':
    showVersion();
    break;
  case 'help':
  case '-h':
  case '--help':
  default:
    showHelp();
    break;
}
