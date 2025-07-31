// Jest setup file for CosmJS testing

// Increase timeout for async operations (Cosmos transactions can be slow)
jest.setTimeout(30000);

// Mock WebAssembly if it's not available in the test environment
if (typeof WebAssembly === 'undefined') {
  global.WebAssembly = {
    Memory: class {
      constructor() {
        this.buffer = new ArrayBuffer(1024);
      }
    },
    Instance: class {
      constructor() {
        this.exports = {};
      }
    },
    Module: class {},
    instantiate: () => Promise.resolve({ instance: new WebAssembly.Instance() })
  };
}

// Set up global fetch if not available (some CosmJS modules might need it)
if (typeof global.fetch === 'undefined') {
  // Mock fetch for testing instead of using node-fetch v3 which is ESM-only
  global.fetch = async (url, options = {}) => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(),
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: new Map(),
      url,
    };
  };
}

// Suppress specific warnings that might come from CosmJS in test environment
const originalWarn = console.warn;
console.warn = (...args) => {
  // Filter out libsodium warnings
  if (args.some(arg => typeof arg === 'string' && arg.includes('libsodium'))) {
    return;
  }
  originalWarn.apply(console, args);
};

// Environment variables for testing
process.env.NODE_ENV = 'test'; 