// export class BrowserHeaders {
//     constructor(init) {
//         this.headers = new Map();
//         if (init) {
//             if (init instanceof Map) {
//                 this.headers = new Map(init);
//             } else if (typeof init === 'object') {
//                 Object.entries(init).forEach(([key, value]) => {
//                     this.headers.set(key.toLowerCase(), value);
//                 });
//             }
//         }
//     }

//     append(name, value) {
//         const lowerName = name.toLowerCase();
//         const existing = this.headers.get(lowerName);
//         if (existing) {
//             this.headers.set(lowerName, `${existing}, ${value}`);
//         } else {
//             this.headers.set(lowerName, value);
//         }
//     }

//     delete(name) {
//         this.headers.delete(name.toLowerCase());
//     }

//     get(name) {
//         return this.headers.get(name.toLowerCase()) || null;
//     }

//     has(name) {
//         return this.headers.has(name.toLowerCase());
//     }

//     set(name, value) {
//         this.headers.set(name.toLowerCase(), value);
//     }

//     forEach(callback, thisArg) {
//         this.headers.forEach((value, key) => {
//             callback.call(thisArg, value, key, this);
//         });
//     }

//     entries() {
//         return this.headers.entries();
//     }

//     keys() {
//         return this.headers.keys();
//     }

//     values() {
//         return this.headers.values();
//     }

//     [Symbol.iterator]() {
//         return this.headers.entries();
//     }

//     toHeaders() {
//         const result = {};
//         this.headers.forEach((value, key) => {
//             result[key] = value;
//         });
//         return result;
//     }
// }

// export { BrowserHeaders as default };
