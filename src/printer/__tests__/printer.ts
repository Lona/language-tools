import { Printer, findReference } from '../Printer'
import { Parser } from '../../parser/Parser'
import {
  resetId,
  consume,
  or,
  many,
  printIndent,
  printIf,
  printLine,
} from '../../parser/builders'

describe('Parser', () => {
  beforeEach(() => {
    resetId()
  })

  // Simple string tokens
  let parser = new Parser({
    matchToken: (token: string, type: string) => token === type,
    tokenToValue: (token: string) => token,
  })

  let printer = new Printer({
    tokenToString: (token: string) => token,
  })

  it('prints consume', () => {
    const result = parser.parseOne(consume('hello'), ['hello'])
    expect(printer.print(result)).toEqual('hello')
  })

  it('prints or', () => {
    const result = parser.parseOne(or([consume('hello'), consume('world')]), [
      'hello',
    ])
    expect(printer.print(result)).toEqual('hello')
  })

  it('prints many', () => {
    const result = parser.parseOne(many(consume('hello')), [
      'hello',
      'hello',
      'hello',
    ])
    expect(printer.print(result)).toEqual('hellohellohello')
  })

  it('finds consume references', () => {
    const pattern = printIndent(consume('hello', { as: 'a' }))

    const result = parser.parseOne(pattern, ['hello'])
    expect(findReference(result, 'a')).toMatchObject({
      as: 'a',
      type: 'consume',
    })
    expect(findReference(result, 'b')).toEqual(undefined)
    expect(printer.print(result)).toEqual('hello')
  })

  it('finds or references', () => {
    const pattern = or([
      consume('hello', { as: 'a' }),
      consume('world', { as: 'b' }),
    ])

    const result1 = parser.parseOne(pattern, ['hello'])
    expect(findReference(result1, 'a')).toMatchObject({
      as: 'a',
      type: 'consume',
    })
    expect(findReference(result1, 'b')).toEqual(undefined)

    const result2 = parser.parseOne(pattern, ['world'])
    expect(findReference(result2, 'a')).toEqual(undefined)
    expect(findReference(result2, 'b')).toMatchObject({
      as: 'b',
      type: 'consume',
    })
  })

  it('prints printIf', () => {
    const pattern = printIf(
      or([consume('hello', { as: 'a' }), consume('world', { as: 'b' })]),
      { reference: 'a', after: printLine() }
    )

    const result1 = parser.parseOne(pattern, ['hello'])
    expect(printer.print(result1)).toEqual('hello ')

    const result2 = parser.parseOne(pattern, ['world'])
    expect(printer.print(result2)).toEqual('world')
  })
})
