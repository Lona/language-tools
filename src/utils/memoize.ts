export default function memoize<I extends unknown[], O>(
  f: (...values: I) => O
): (...values: I) => O {
  const intermediateCache = new Map<I[number], string>()
  const cache: Map<string, O> = new Map()
  let intermediateCacheIndex = 0

  return (...values: I): O => {
    let key = ''

    for (let value of values) {
      if (!intermediateCache.has(value)) {
        intermediateCache.set(value, `${intermediateCacheIndex++}`)
      }
      key += intermediateCache.get(value)! + ':'
    }

    if (!cache.has(key)) {
      cache.set(key, f(...values))
    }
    return cache.get(key)!
  }
}

export function memoizeDirect<I extends unknown[], O>(
  f: (...values: I) => O
): (...values: I) => O {
  const cache: Map<string, O> = new Map()

  return (...values: I): O => {
    let key = ''

    for (let value of values) {
      key += value + ':'
    }

    if (!cache.has(key)) {
      cache.set(key, f(...values))
    }
    return cache.get(key)!
  }
}
