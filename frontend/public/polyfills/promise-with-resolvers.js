/**
 * Polyfill ES2024 Promise.withResolvers — Safari/iOS & browser lama (PDF.js worker + main).
 */
;(function () {
  if (typeof Promise.withResolvers === 'function') return
  Promise.withResolvers = function withResolvers() {
    var resolve, reject
    var promise = new Promise(function (res, rej) {
      resolve = res
      reject = rej
    })
    return { promise: promise, resolve: resolve, reject: reject }
  }
})()
