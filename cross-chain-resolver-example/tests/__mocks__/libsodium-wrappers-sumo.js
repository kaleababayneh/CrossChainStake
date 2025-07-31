// Mock implementation of libsodium-wrappers-sumo for Jest testing
const crypto = require('crypto');

const mockSodium = {
  ready: Promise.resolve(),
  
  // Crypto box functions
  crypto_box_PUBLICKEYBYTES: 32,
  crypto_box_SECRETKEYBYTES: 32,
  crypto_box_NONCEBYTES: 24,
  crypto_box_MACBYTES: 16,
  
  crypto_box_keypair: () => {
    const publicKey = crypto.randomBytes(32);
    const privateKey = crypto.randomBytes(32);
    return {
      publicKey: new Uint8Array(publicKey),
      privateKey: new Uint8Array(privateKey),
      keyType: 'x25519'
    };
  },
  
  crypto_box_easy: (message, nonce, publicKey, privateKey) => {
    // Simple mock - just return the message with some random padding
    const encrypted = new Uint8Array(message.length + 16);
    encrypted.set(message);
    encrypted.set(crypto.randomBytes(16), message.length);
    return encrypted;
  },
  
  crypto_box_open_easy: (ciphertext, nonce, publicKey, privateKey) => {
    // Simple mock - just return the first part (removing our fake padding)
    return ciphertext.slice(0, -16);
  },
  
  // Hash functions
  crypto_hash_sha256: (message) => {
    const hash = crypto.createHash('sha256').update(Buffer.from(message)).digest();
    return new Uint8Array(hash);
  },
  
  crypto_hash_sha512: (message) => {
    const hash = crypto.createHash('sha512').update(Buffer.from(message)).digest();
    return new Uint8Array(hash);
  },
  
  // Random functions
  randombytes_buf: (length) => {
    return new Uint8Array(crypto.randomBytes(length));
  },
  
  // Ed25519 signature functions
  crypto_sign_PUBLICKEYBYTES: 32,
  crypto_sign_SECRETKEYBYTES: 64,
  crypto_sign_BYTES: 64,
  
  crypto_sign_keypair: () => {
    const publicKey = crypto.randomBytes(32);
    const privateKey = crypto.randomBytes(64);
    return {
      publicKey: new Uint8Array(publicKey),
      privateKey: new Uint8Array(privateKey),
      keyType: 'ed25519'
    };
  },
  
  crypto_sign_detached: (message, privateKey) => {
    // Mock signature - in real use this would be cryptographically secure
    const signature = crypto.randomBytes(64);
    return new Uint8Array(signature);
  },
  
  crypto_sign_verify_detached: (signature, message, publicKey) => {
    // Mock verification - always return true for testing
    return true;
  },
  
  // Secp256k1 functions (if needed)
  crypto_scalarmult_SCALARBYTES: 32,
  crypto_scalarmult_BYTES: 32,
  
  crypto_scalarmult: (scalar, point) => {
    // Mock scalar multiplication
    return new Uint8Array(32);
  },
  
  crypto_scalarmult_base: (scalar) => {
    // Mock base point multiplication
    return new Uint8Array(32);
  },
  
  // Utility functions
  from_hex: (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  },
  
  to_hex: (bytes) => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },
  
  from_base64: (base64) => {
    const buffer = Buffer.from(base64, 'base64');
    return new Uint8Array(buffer);
  },
  
  to_base64: (bytes) => {
    return Buffer.from(bytes).toString('base64');
  },
  
  // Memory management
  memzero: (array) => {
    array.fill(0);
  },
  
  // Constants
  ERRNO_CODES: {},
  
  // Initialization
  ready: Promise.resolve()
};

// Export both default and named exports to cover all import patterns
module.exports = mockSodium;
module.exports.default = mockSodium;

// Also provide as a function that returns a promise (some imports expect this)
module.exports.ready = Promise.resolve();

// Handle async initialization pattern
Object.defineProperty(module.exports, 'ready', {
  value: Promise.resolve(mockSodium),
  writable: false
}); 