// // Mock for @1inch/cross-chain-sdk
// const mockCrossChainSDK = {
//   // Network enums
//   NetworkEnum: {
//     ETHEREUM: 1,
//     BINANCE: 56,
//     POLYGON: 137,
//     ARBITRUM: 42161,
//     AVALANCHE: 43114,
//     OPTIMISM: 10,
//     FANTOM: 250,
//     INJECTIVE: 888
//   },

//   // Address class mock
//   Address: class {
//     constructor(value) {
//       this.value = value;
//     }
    
//     toString() {
//       return this.value;
//     }
    
//     static fromRaw(raw) {
//       return new this.constructor(raw);
//     }
    
//     static fromBigInt(bigint) {
//       return new this.constructor(`0x${bigint.toString(16)}`);
//     }
//   },

//   // Mock SDK functions
//   CrossChainSDK: class {
//     constructor() {}
    
//     static async create(config) {
//       return new this();
//     }
    
//     async quote() {
//       return {
//         srcTokenAmount: '1000000',
//         dstTokenAmount: '1000000',
//         routes: []
//       };
//     }
    
//     async swap() {
//       return {
//         txHash: '0x123456789',
//         success: true
//       };
//     }
//   },

//   // Extension mock
//   Extension: {
//     NONE: 0,
//     MAKER_TRAITS: 1
//   },

//   // MakerTraits mock
//   MakerTraits: class {
//     constructor() {}
    
//     static empty() {
//       return new this();
//     }
//   },

//   // AuctionDetails mock  
//   AuctionDetails: class {
//     constructor() {}
//   },

//   // SettlementPostInteractionData mock
//   SettlementPostInteractionData: class {
//     constructor() {}
//   },

//   // Interaction mock
//   Interaction: class {
//     constructor() {}
//   },

//   // AuctionCalculator mock
//   AuctionCalculator: class {
//     constructor() {}
    
//     static create() {
//       return new this();
//     }
//   }
// };

// // Export for both CommonJS and ES modules
// module.exports = mockCrossChainSDK;
// module.exports.default = mockCrossChainSDK;

// // Named exports
// Object.keys(mockCrossChainSDK).forEach(key => {
//   module.exports[key] = mockCrossChainSDK[key];
// });
