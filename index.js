if (typeof global.DOMException === 'undefined') {
  global.DOMException = Error;
}
if (typeof global.PerformanceEntry === 'undefined') {
  global.PerformanceEntry = class {};
}
if (typeof global.PerformanceObserver === 'undefined') {
  global.PerformanceObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

import 'expo-router/entry';
