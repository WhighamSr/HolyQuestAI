/**
 * setup.ts
 * VS Code API mock for Jest test environment.
 * Replaces the 'vscode' module in all test files.
 * Holy Quest AI — Test Infrastructure
 */

// ─── URI MOCK ──────────────────────────────────────────────────────────────
class MockUri {
  constructor(
    public readonly scheme: string,
    public readonly fsPath: string
  ) {}

  static file(path: string): MockUri {
    return new MockUri('file', path);
  }

  static joinPath(base: MockUri, ...parts: string[]): MockUri {
    const joined = [base.fsPath, ...parts].join('/');
    return new MockUri(base.scheme, joined);
  }
}

// ─── WINDOW MOCK ───────────────────────────────────────────────────────────
const window = {
  showInformationMessage: jest.fn().mockResolvedValue(undefined),
  showWarningMessage: jest.fn().mockResolvedValue(undefined),
  showErrorMessage: jest.fn().mockResolvedValue(undefined),
  showInputBox: jest.fn().mockResolvedValue(undefined),
  activeTextEditor: undefined as unknown,
  createOutputChannel: jest.fn().mockReturnValue({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  }),
};

// ─── WORKSPACE MOCK ────────────────────────────────────────────────────────
const workspace = {
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(''),
    update: jest.fn().mockResolvedValue(undefined),
  }),
  workspaceFolders: undefined as unknown,
  fs: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('')),
    writeFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ type: 1 }),
    readDirectory: jest.fn().mockResolvedValue([]),
    createDirectory: jest.fn().mockResolvedValue(undefined),
  },
  openTextDocument: jest.fn().mockResolvedValue({}),
};

// ─── COMMANDS MOCK ─────────────────────────────────────────────────────────
const commands = {
  registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  executeCommand: jest.fn().mockResolvedValue(undefined),
};

// ─── FILE TYPE ENUM ────────────────────────────────────────────────────────
const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

// ─── EXTENSION CONTEXT MOCK ────────────────────────────────────────────────
const ExtensionContext = {
  secrets: {
    get: jest.fn().mockResolvedValue(undefined),
    store: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  globalState: {
    get: jest.fn().mockReturnValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  },
  subscriptions: [],
};

// ─── EXPORT AS VSCODE MODULE ───────────────────────────────────────────────
module.exports = {
  Uri: MockUri,
  window,
  workspace,
  commands,
  FileType,
  ExtensionContext,
  WebviewViewProvider: class {},
};
