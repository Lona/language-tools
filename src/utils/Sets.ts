export function map<A, B>(
  a: Set<A> | A[],
  f: (a: A, index: number) => B
): Set<B> {
  const result = new Set<B>()

  let index = 0

  for (let value of a) {
    index++

    result.add(f(value, index))
  }

  return result
}

export function flatMap<A, B>(
  a: Set<A> | A[],
  f: (a: A, index: number) => Set<B> | B[]
): Set<B> {
  const result = new Set<B>()

  let index = 0

  for (let value of a) {
    index++

    for (let item of f(value, index)) {
      result.add(item)
    }
  }

  return result
}

export function merge<A>(sets: Set<A>[]): Set<A> {
  let merged = new Set<A>()

  for (let set of sets) {
    for (let value of set) {
      merged.add(value)
    }
  }

  return merged
}

export function withValue<A>(set: Set<A>, value: A): Set<A> {
  let merged = new Set<A>()

  for (let value of set) {
    merged.add(value)
  }

  merged.add(value)

  return merged
}
