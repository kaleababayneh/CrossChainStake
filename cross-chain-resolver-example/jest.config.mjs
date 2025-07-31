/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

export default {
    clearMocks: true,
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'tests',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    transform: {
        '^.+\\.(t|j)s$': ['@swc/jest']
    },
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    transformIgnorePatterns: [
        'node_modules/(?!(@1inch|@cosmjs|libsodium-wrappers)/)'
    ],
    moduleNameMapper: {
        '^@1inch/cross-chain-sdk$': '<rootDir>/__mocks__/@1inch-cross-chain-sdk.js',
        '^libsodium-wrappers-sumo$': '<rootDir>/__mocks__/libsodium-wrappers-sumo.js',
        '^libsodium-wrappers$': '<rootDir>/__mocks__/libsodium-wrappers-sumo.js'
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testTimeout: 30000,
    forceExit: true
}
