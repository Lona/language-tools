import {
  consume,
  many,
  option,
  or,
  resetId,
  sequence,
  thunk,
} from '../builders'
import { Parser, ParserPattern } from '../Parser'

describe('Parser', () => {
  beforeEach(() => {
    resetId()
  })

  // Simple string tokens
  let parser = new Parser<string, string>({
    matchToken: (token: string, type: string) => token === type,
    tokenToValue: (token: string) => token,
    verbose: true,
  })

  it('parses consume', () => {
    const result = parser.parseOne(consume('hello'), ['hello'])
    expect(result).toMatchSnapshot()
  })

  it('parses thunk', () => {
    const result = parser.parseOne(
      thunk(() => consume('hello')),
      ['hello']
    )
    expect(result).toMatchSnapshot()
  })

  it('parses sequence', () => {
    const result = parser.parseOne(
      sequence([consume('hello'), consume('world')]),
      ['hello', 'world']
    )
    expect(result).toMatchSnapshot()
  })

  it('parses thunk', () => {
    const result = parser.parseOne(
      thunk(() => consume('hello')),
      ['hello']
    )
    expect(result).toMatchSnapshot()
  })

  it('parses option', () => {
    const result = parser.parseOne(option(consume('hello')), ['hello'])
    expect(result).toMatchSnapshot()
  })

  it('parses option 2', () => {
    const result = parser.parseOne(option(consume('hello')), [])
    expect(result).toMatchSnapshot()
  })

  it('parses or', () => {
    const result = parser.parseOne(or([consume('hello'), consume('world')]), [
      'hello',
    ])
    expect(result).toMatchSnapshot()
  })

  it('parses or 2', () => {
    const result = parser.parseOne(or([consume('hello'), consume('world')]), [
      'world',
    ])
    expect(result).toMatchSnapshot()
  })

  it('parses many', () => {
    const result = parser.parseOne(many(consume('hello')), ['hello', 'hello'])
    expect(result).toMatchSnapshot()
    // console.log(result)
  })

  // describe('handles indirect left recursion', () => {
  //   // expression ::= expression + expression | term
  //   // term ::= `a`

  //   const patterns: { [key: string]: ParserPattern } = {
  //     expression: or(
  //       [
  //         sequence(
  //           [
  //             thunk(() => patterns.expression, { label: 'lhs-thunk' }),
  //             consume('+', { label: 'plus' }),
  //             thunk(() => patterns.expression, { label: 'rhs-thunk' }),
  //           ],
  //           { label: 'sequence' }
  //         ),
  //         thunk(() => patterns.term, { label: 'term-thunk' }),
  //       ],
  //       { label: 'expression' }
  //     ),
  //     term: consume('a', { label: 'term' }),
  //   }

  //   it('simple case', () => {
  //     const result = parser.parseOne(patterns.expression, ['a'])
  //     expect(result).toBeDefined()
  //   })

  //   it('complex case', () => {
  //     const result = parser.parseOne(patterns.expression, ['a', '+', 'a'])
  //     expect(result).toBeDefined()
  //   })
  // })
})
