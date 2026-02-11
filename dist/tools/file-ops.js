// File Operations tools - read and write files
import * as fs from 'fs/promises';
import * as path from 'path';
// Security: Define allowed directories
const ALLOWED_DIRS = [
    process.cwd(),
    '/tmp/forge',
];
function isPathAllowed(filePath) {
    const resolved = path.resolve(filePath);
    return ALLOWED_DIRS.some(dir => resolved.startsWith(path.resolve(dir)));
}
export const readFileTool = {
    name: 'read_file',
    description: 'Read the contents of a file. Only works within the current directory or /tmp/forge.',
    parameters: {
        path: {
            type: 'string',
            description: 'Path to the file to read',
            required: true,
        },
    },
    execute: async (params) => {
        const filePath = params.path;
        if (!isPathAllowed(filePath)) {
            return `Error: Access denied. Can only read files in: ${ALLOWED_DIRS.join(', ')}`;
        }
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);
            // Truncate large files
            const MAX_SIZE = 100000;
            const truncated = content.length > MAX_SIZE
                ? content.slice(0, MAX_SIZE) + '\n\n[... truncated]'
                : content;
            return `File: ${filePath} (${stats.size} bytes)\n\n${truncated}`;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (error.code === 'ENOENT') {
                return `Error: File not found: ${filePath}`;
            }
            return `Error reading file: ${message}`;
        }
    },
};
export const writeFileTool = {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it doesn\'t exist. Only works within the current directory or /tmp/forge.',
    parameters: {
        path: {
            type: 'string',
            description: 'Path to the file to write',
            required: true,
        },
        content: {
            type: 'string',
            description: 'Content to write to the file',
            required: true,
        },
        append: {
            type: 'boolean',
            description: 'If true, append to the file instead of overwriting (default false)',
            required: false,
        },
    },
    execute: async (params) => {
        const filePath = params.path;
        const content = params.content;
        const append = params.append === true;
        if (!isPathAllowed(filePath)) {
            return `Error: Access denied. Can only write files in: ${ALLOWED_DIRS.join(', ')}`;
        }
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            if (append) {
                await fs.appendFile(filePath, content, 'utf-8');
                return `Appended ${content.length} bytes to ${filePath}`;
            }
            else {
                await fs.writeFile(filePath, content, 'utf-8');
                return `Wrote ${content.length} bytes to ${filePath}`;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return `Error writing file: ${message}`;
        }
    },
};
export const listFilesTool = {
    name: 'list_files',
    description: 'List files in a directory. Only works within the current directory or /tmp/forge.',
    parameters: {
        path: {
            type: 'string',
            description: 'Directory path to list (default: current directory)',
            required: false,
        },
    },
    execute: async (params) => {
        const dirPath = params.path || '.';
        if (!isPathAllowed(dirPath)) {
            return `Error: Access denied. Can only list files in: ${ALLOWED_DIRS.join(', ')}`;
        }
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const files = entries.map(e => {
                const type = e.isDirectory() ? '📁' : '📄';
                return `${type} ${e.name}`;
            }).sort();
            if (files.length === 0) {
                return `Directory ${dirPath} is empty`;
            }
            return `Contents of ${dirPath}:\n\n${files.join('\n')}`;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (error.code === 'ENOENT') {
                return `Error: Directory not found: ${dirPath}`;
            }
            return `Error listing directory: ${message}`;
        }
    },
};
