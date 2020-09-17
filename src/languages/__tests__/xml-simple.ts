import { resetId } from '../../parser/builders'
import { Parser, ParseResult } from '../../parser/Parser'
import { Match } from '../../parser/types'
import { Printer } from '../../printer/Printer'
import { patterns as xml } from '../xml'
import { Shaper } from '../../shaper/Shaper'
import { inspect } from 'util'

describe('XML Language', () => {
  beforeEach(() => {
    resetId()
  })

  // Simple string tokens
  let parser = new Parser({
    matchToken: (token: string, type: string) => token === type,
    tokenToValue: (token: string) => token,
    // verbose: true,
  })

  let printer = new Printer({
    tokenToString: (token: string) => token,
  })

  const shaper = new Shaper<string, string>({
    stringToShape: (string: string) => string,
    tokenToShape: (token: string) => token,
    shapeToToken: (shape: string) => shape,
    orShapeToValue: (shape) => shape,
    orValueToShape: (value) => value,
  })

  it('parses attribute', () => {
    const pattern = xml.attribute

    const result = parser.parseOne(pattern, ['name', '=', 'string'])
    expect(printer.print(result)).toEqual(`name="string"`)

    const shape = shaper.extract(result)
    expect(shape).toEqual({
      name: 'name',
      value: 'string',
    })

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  it('parses element content', () => {
    const pattern = xml.elementContent

    const result = parser.parseOne(pattern, ['comment'])
    expect(printer.print(result)).toEqual(`<!--comment-->`)

    const shape = shaper.extract(result)
    expect(shape).toMatchSnapshot()

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  describe('element', () => {
    it('parses element', () => {
      const pattern = xml.element

      const result = parser.parseOne(pattern, [
        '<',
        'name',
        'name',
        '=',
        'string',
        '>',
        '</',
        'name',
        '>',
      ])
      expect(printer.print(result)).toEqual(`<name name="string"></name>`)

      const shape = shaper.extract(result)
      expect(shape).toMatchSnapshot()

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })

    it('parses nested elements', () => {
      const pattern = xml.element

      const result = parser.parseOne(pattern, [
        '<',
        'name',
        '>',
        'comment',
        'charData',
        '</',
        'name',
        '>',
      ])
      expect(printer.print(result)).toEqual(
        `<name><!--comment-->charData</name>`
      )

      const shape = shaper.extract(result)
      expect(shape).toMatchSnapshot()

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })

    it('parses self-closing', () => {
      const pattern = xml.element

      const result = parser.parseOne(pattern, [
        '<',
        'name',
        'name',
        '=',
        'string',
        '/>',
      ])
      expect(printer.print(result)).toEqual(`<name name="string"/>`)

      const shape = shaper.extract(result)
      expect(shape).toMatchSnapshot()

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })

    it('parses multiple attributes', () => {
      const pattern = xml.element

      const result = parser.parseOne(pattern, [
        '<',
        'name',
        'name',
        '=',
        'string',
        'name',
        '=',
        'string',
        '/>',
      ])

      expect(printer.print(result)).toEqual(
        `<name name="string" name="string"/>`
      )
      const shape = shaper.extract(result)

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })

    it('parses with wrapping', () => {
      const pattern = xml.element

      const result = parser.parseOne(pattern, [
        '<',
        'name',
        'name',
        '=',
        'string',
        'name',
        '=',
        'string',
        'name',
        '=',
        'string',
        '/>',
      ])

      expect(printer.print(result, { printWidth: 40, tabWidth: 2 }))
        .toEqual(`<name
  name="string"
  name="string"
  name="string"/>`)
      const shape = shaper.extract(result)

      const recreated = shaper.inject(shape, pattern)
      expect(recreated).toEqual(result)
    })
  })
})
