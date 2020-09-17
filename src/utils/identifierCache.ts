export type IdentifierCache<T> = {
  register: (value: T) => string
  get: (id: string) => T
}

/**
 * Convert an object to a cached unique ID.
 *
 * Values are JSON before in order to determine uniqueness.
 * Undefined is not a valid value.
 */
export default function identifierCache<T>(): IdentifierCache<T> {
  const intermediate: { [key: string]: string } = {}
  const cache: { [key: string]: T } = {}

  let nextIndex = 0

  return {
    register: (value: T): string => {
      const key = JSON.stringify(value)

      const existing = intermediate[key]

      if (existing !== undefined) return existing

      const index = `${nextIndex++}`

      intermediate[key] = index
      cache[index] = value

      return index
    },
    get: (id: string): T => cache[id],
  }
}
