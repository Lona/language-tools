import { ParserMatch, ParserPattern } from '../parser/Parser'
import { assert } from 'console'
import { inspect, isDeepStrictEqual } from 'util'
import { Parse } from '../parser/types'

type PatternType = string

export interface OrValue {
  type: string
  value: unknown
}

export interface ShaperOptions<Token, TokenShape, OrShape> {
  shapeToToken: (shape: TokenShape, type: PatternType) => Token
  tokenToShape: (token: Token) => TokenShape
  stringToShape: (string: string, type: PatternType) => TokenShape

  // Patterns
  orValueToShape: (value: OrValue, label?: string) => OrShape
  orShapeToValue: (shape: OrShape, label?: string) => OrValue
}

/**
 * Convert built-in types to a new "Shape"
 */
export class Shaper<Token, TokenShape, OrShape = OrValue> {
  options: ShaperOptions<Token, TokenShape, OrShape>

  constructor(options: ShaperOptions<Token, TokenShape, OrShape>) {
    this.options = options
  }

  extract = (match: Parse<string, Token>): unknown => {
    function wrapShape<T>(as: string, shape: T): unknown {
      return as === '.' ? shape : { [as]: shape }
    }

    // if ('as' in match) {
    //   console.log('as', match)
    // }

    switch (match.type) {
      case 'thunk':
        return wrapShape(match.as ?? '.', this.extract(match.match))
      case 'printGroup':
        return this.extract(match.match)
      case 'printIndent':
        return this.extract(match.match)
      case 'printLiteral':
        return null
      case 'printLine':
        return null
      case 'printIf':
        return this.extract(match.match)
      case 'consume':
        if (match.as) {
          const shape = this.options.tokenToShape(match.match)

          return wrapShape(match.as, shape)
        }

        return null
      case 'sequence': {
        const items = match.match.map(this.extract)
        const merged = Object.assign({}, ...items.filter((x) => x !== null))

        // Remove null fields
        const shape = Object.fromEntries(
          Object.entries(merged).flatMap(([key, value]) =>
            value !== null ? [[key, value]] : []
          )
        )

        if (match.select) {
          return (wrapShape(match.as ?? '.', shape) as any)[match.select]
        }

        return wrapShape(match.as ?? '.', shape)
      }
      case 'or':
        if (match.as) {
          const value = {
            type: String(
              match.typeNames
                ? match.typeNames[match.matchIndex]
                : match.matchIndex
            ),
            value: this.extract(match.match),
          }

          const shape = this.options.orValueToShape(value, match.label)

          return wrapShape(match.as, shape)
        }

        return this.extract(match.match)
      case 'many': {
        if (match.as) {
          const shape = match.match.map(this.extract)

          // TODO: Separator?
          return wrapShape(match.as, shape)
        }

        return match.match.map(this.extract)
      }
      case 'option': {
        if (match.as) {
          const defaultValue = match.defaultValue ?? null
          const shape = match.match ? this.extract(match.match) : defaultValue

          if (!isDeepStrictEqual(shape, defaultValue) && match.select) {
            return wrapShape(match.as, (shape as any)[match.select])
          }

          return wrapShape(match.as, shape)
        }

        return null
      }
    }
  }

  inject = (data: unknown, pattern: ParserPattern): Parse<string, Token> => {
    function unwrapValue<T>(
      as: string,
      container: T | { [key: string]: T }
    ): T {
      if (as === '.') return container as T

      assert(
        as in container,
        `expected '${as}' in container: ${inspect(container)}`
      )

      return (container as { [key: string]: T })[as]
    }

    function unwrapOptionalValue<T>(
      as: string,
      container: T | { [key: string]: T }
    ): T | null {
      if (as === '.') return container as T

      if (!(as in container)) return null

      return (container as { [key: string]: T })[as]
    }

    // console.log(
    //   [
    //     pattern.type,
    //     ...('label' in pattern ? [`(${pattern.label})`] : []),
    //     ...('as' in pattern ? [`'${pattern.as}'`] : []),
    //     inspect(data),
    //   ].join(' ')
    // )

    switch (pattern.type) {
      case 'thunk': {
        const value = unwrapValue<TokenShape>(pattern.as ?? '.', data as any)
        return { ...pattern, match: this.inject(value, pattern.value()) }
      }
      case 'printGroup':
      case 'printIndent':
      case 'printIf':
        return { ...pattern, match: this.inject(data, pattern.value) }
      case 'printLiteral':
        return { ...pattern }
      case 'printLine':
        return { ...pattern }
      case 'consume':
        if (pattern.as) {
          const value = unwrapValue<TokenShape>(pattern.as, data as any)

          return {
            ...pattern,
            match: this.options.shapeToToken(value, pattern.value),
          }
        } else {
          return {
            ...pattern,
            match: this.options.shapeToToken(
              this.options.stringToShape(pattern.value, pattern.value),
              pattern.value
            ),
          }
        }

      // throw new Error("Pattern 'consume' must have 'as' name")
      case 'or':
        if (pattern.as) {
          const orValue = unwrapValue<OrShape>(pattern.as, data as any)
          const orShape = this.options.orShapeToValue(orValue, pattern.label)
          const matchIndex = Number(
            pattern.typeNames
              ? pattern.typeNames.indexOf(orShape.type)
              : orShape.type
          )

          return {
            ...pattern,
            matchIndex,
            match: this.inject(orShape.value, pattern.value[matchIndex]),
          }
        }

        throw new Error("Pattern 'or' must have 'as' name")
      case 'sequence': {
        let sequenceValue = unwrapValue<unknown>(pattern.as ?? '.', data as any)

        if (pattern.select) {
          sequenceValue = { [pattern.select]: sequenceValue }
        }

        return {
          ...pattern,
          match: pattern.value.map((subpattern) =>
            this.inject(sequenceValue, subpattern)
          ),
        }

        // console.log(pattern)

        // throw new Error("Pattern 'sequence' must have 'as' name")
      }
      case 'many':
        if (pattern.as) {
          const manyValue = unwrapValue<unknown[]>(pattern.as, data as any)
          const separator = pattern.separator

          return {
            ...pattern,
            match: manyValue.map((item) => this.inject(item, pattern.value)),
            // Separators can't match data
            matchSeparator: separator
              ? manyValue.slice(0, -1).map(() => this.inject({}, separator))
              : [],
          }
        }

        throw new Error("Pattern 'many' must have 'as' name")
      case 'option': {
        if (pattern.as) {
          if (pattern.as === '.') {
            throw new Error("Option patterns can't use '.' for 'as' name")
          }

          let optionValue = unwrapOptionalValue<unknown>(
            pattern.as,
            data as any
          )
          const defaultValue = pattern.defaultValue ?? null

          if (isDeepStrictEqual(optionValue, defaultValue)) {
            return { ...pattern }
          }

          if (pattern.select) {
            optionValue = { [pattern.select]: optionValue }
          }

          return {
            ...pattern,
            match: this.inject(optionValue, pattern.value),
          }
        }

        throw new Error("Pattern 'option' must have 'as' name")
      }
    }
  }
}
