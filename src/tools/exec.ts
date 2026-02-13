// Shell execution tool - run commands safely

import type { Tool } from '../types.js';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

// Security: Allowlist of safe commands
const ALLOWED_COMMANDS = [
  'pandoc',      // Document conversion
  'wkhtmltopdf', // HTML to PDF
  'convert',     // ImageMagick
  'ffmpeg',      // Media processing
  'python3',     // Python scripts
  'node',        // Node scripts
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', // Basic file ops
  'date', 'echo', 'which',
];

// Pre-built command aliases for common tasks
const COMMAND_ALIASES: Record<string, string> = {
  'doc_convert': 'python3 /root/clawd/projects/forge/scripts/doc_converter.py',
};

function isCommandAllowed(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return ALLOWED_COMMANDS.includes(firstWord);
}

export const execTool: Tool = {
  name: 'exec',
  description: `Execute a shell command. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}.

📄 Document Conversion (recommended):
  python3 /root/clawd/projects/forge/scripts/doc_converter.py <format> <input> [-t "Title"] [--template professional]
  Formats: docx, xlsx, pptx, pdf
  Example: python3 /root/clawd/projects/forge/scripts/doc_converter.py docx /tmp/forge/notes.md -t "Meeting Notes"

Other uses: pandoc, ffmpeg, or running custom scripts.
Commands run in /tmp/forge with a 30 second timeout.`,
  parameters: {
    command: {
      type: 'string',
      description: 'Shell command to execute',
      required: true,
    },
    cwd: {
      type: 'string',
      description: 'Working directory (default: /tmp/forge)',
      required: false,
    },
  },
  execute: async (params) => {
    const command = params.command as string;
    const cwd = (params.cwd as string) || '/tmp/forge';

    if (!isCommandAllowed(command)) {
      const firstWord = command.trim().split(/\s+/)[0];
      return `❌ Command "${firstWord}" not in allowlist.

Allowed commands: ${ALLOWED_COMMANDS.join(', ')}

If you need another command, ask to add it to the allowlist.`;
    }

    // Ensure working directory exists
    const fs = await import('fs/promises');
    try {
      await fs.mkdir(cwd, { recursive: true });
    } catch {}

    try {
      const { stdout, stderr } = await exec(command, {
        cwd,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB output limit
      });

      let result = '';
      if (stdout) result += `📤 stdout:\n${stdout.slice(0, 10000)}\n`;
      if (stderr) result += `📥 stderr:\n${stderr.slice(0, 5000)}\n`;
      if (!result) result = '✅ Command completed (no output)';

      return result;
    } catch (error: any) {
      if (error.killed) {
        return '❌ Command timed out (30 second limit)';
      }
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      return `❌ Command failed (exit code ${error.code})\n\nstderr:\n${stderr}\n\nstdout:\n${stdout}`;
    }
  },
};
