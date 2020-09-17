import { inspect } from 'util'
import { token } from '../../lexer/builders'
import { Token } from '../../lexer/types'
import { resetId } from '../../parser/builders'
import { Parser, ParseResult } from '../../parser/Parser'
import { Match } from '../../parser/types'
import { Printer } from '../../printer/Printer'
import { Shaper } from '../../shaper/Shaper'
import { patterns as xml, lexerDefinition } from '../xml'
import { Lexer } from '../../lexer/Lexer'
import countGroups from '../../utils/countGroups'

type ElementClosing = ElementContent[]

type ElementContent =
  | {
      type: 'comment'
      value: string
    }
  | {
      type: 'charData'
      value: string
    }
  | {
      type: 'element'
      value: unknown
    }

type OrShape = ElementContent | ElementClosing

const lexer = new Lexer(lexerDefinition)

const tokenToString = (token: Token): string =>
  token.values.length > 0 ? token.values[0] : token.type

let parser = new Parser({
  matchToken: (token: Token, type: string) => token.type === type,
  tokenToValue: (token: Token) => token,
})

let printer = new Printer({
  tokenToString,
})

const tokenTypesWithValues = lexerDefinition
  .flatMap((definition) => definition.rules)
  .filter((rule) => countGroups(rule.pattern) > 0)
  .map((rule) => rule.name)

const shaper = new Shaper<Token, string, OrShape>({
  shapeToToken: (shape: string, type: string) =>
    tokenTypesWithValues.includes(type)
      ? token(type, { values: [shape] })
      : token(type),
  tokenToShape: tokenToString,
  stringToShape: (string: string, type: string): string =>
    tokenTypesWithValues.includes(type) ? string : type,

  orValueToShape: (value, label) => {
    switch (label) {
      case 'ElementClosing':
        switch (value.type) {
          case 'selfClosing':
            return []
          case 'open':
            return (value.value as any).content
        }
      case 'ElementContent':
        return value
    }

    throw new Error(`Unknown 'or' value (label: ${label}): ${inspect(value)}`)
  },
  orShapeToValue: (shape, label) => {
    switch (label) {
      case 'ElementClosing':
        return (shape as ElementClosing).length > 0
          ? { type: 'open', value: { content: shape } }
          : { type: 'selfClosing', value: undefined }
      case 'ElementContent':
        return shape as ElementContent
    }

    throw new Error(`Unknown 'or' value (label: ${label}): ${inspect(shape)}`)
  },
})

describe('XML Language with tokens', () => {
  beforeEach(() => {
    resetId()
  })

  it('tokenizes', () => {
    const tokens = lexer.tokenize('foo="bar"', ['inside'], {
      positionTracking: false,
    })

    expect(tokens.length).toEqual(3)
  })

  it('parses attribute', () => {
    const pattern = xml.attribute

    const tokens = lexer.tokenize('foo="bar"', ['inside'], {
      positionTracking: false,
    })

    const result = parser.parseOne(pattern, tokens)
    expect(printer.print(result)).toEqual(`foo="bar"`)

    const shape = shaper.extract(result)
    expect(shape).toEqual({ name: 'foo', value: 'bar' })

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  it('parses element content', () => {
    const pattern = xml.elementContent

    const tokens = lexer.tokenize('<!--hello-->', undefined, {
      positionTracking: false,
    })

    const result = parser.parseOne(pattern, tokens)
    expect(printer.print(result)).toEqual(`<!--hello-->`)

    const shape = shaper.extract(result)
    expect(shape).toEqual({
      type: 'comment',
      value: 'hello',
    })

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  describe('element', () => {
    it('parses element', () => {
      const pattern = xml.element

      const tokens = lexer.tokenize('<el attr="val"></el>', undefined, {
        positionTracking: false,
      })

      const result = parser.parseOne(pattern, tokens)
      expect(printer.print(result)).toEqual(`<el attr="val"></el>`)

      const shape = shaper.extract(result)
      expect(shape).toMatchSnapshot()

      const recreated = shaper.inject(shape, pattern)
      expect(printer.print(recreated)).toEqual(`<el attr="val"/>`)
    })

    it('parses nested elements', () => {
      const pattern = xml.element

      const tokens = lexer.tokenize('<el><!--com-->cd</el>', undefined, {
        positionTracking: false,
      })

      const result = parser.parseOne(pattern, tokens)
      expect(printer.print(result)).toEqual(`<el><!--com-->cd</el>`)

      const shape = shaper.extract(result)
      expect(shape).toMatchSnapshot()

      // const recreated = shaper.inject(shape, pattern)

      // expect(printer.print(recreated)).toEqual(`<el >comcd</el>`)
    })

    it('parses self-closing', () => {
      const pattern = xml.element
      const input = `<el attr="val"/>`
      const tokens = lexer.tokenize(input, undefined, {
        positionTracking: false,
      })

      const result = parser.parseOne(pattern, tokens)
      expect(printer.print(result)).toEqual(input)

      const shape = shaper.extract(result)
      expect(shape).toMatchSnapshot()

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })

    it('parses multiple attributes', () => {
      const pattern = xml.element
      const input = `<el attr1="val1" attr2="val2"/>`
      const tokens = lexer.tokenize(input, undefined, {
        positionTracking: false,
      })

      const result = parser.parseOne(pattern, tokens)
      expect(printer.print(result)).toEqual(input)

      const shape = shaper.extract(result)

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })

    it('parses with wrapping', () => {
      const pattern = xml.element
      const input = `<el veryLongAttributeName1="val1" veryLongAttributeName2="val2"/>`
      const tokens = lexer.tokenize(input, undefined, {
        positionTracking: false,
      })

      const result = parser.parseOne(pattern, tokens)
      expect(printer.print(result, { printWidth: 40, tabWidth: 2 }))
        .toEqual(`<el
  veryLongAttributeName1="val1"
  veryLongAttributeName2="val2"/>`)

      const shape = shaper.extract(result)

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })
  })
})
