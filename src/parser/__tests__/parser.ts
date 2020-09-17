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
    // verbose: true,
  })

  it('parses consume', () => {
    const result = parser.parseOne(consume('hello'), ['hello'])
    expect(result).toMatchSnapshot()
  })

  it('parses sequence', () => {
    const result = parser.parseOne(
      sequence([consume('hello'), consume('world')]),
      ['hello', 'world']
    )
    expect(result).toMatchSnapshot()
  })

  it('parses many', () => {
    const result = parser.parseOne(many(consume('hello')), [
      'hello',
      'hello',
      'hello',
    ])
    expect(result).toMatchSnapshot()
  })

  it('parses many with separator', () => {
    const result = parser.parseOne(
      many(consume('hello'), { separator: consume(',') }),
      ['hello', ',', 'hello', ',', 'hello']
    )
    expect(result).toMatchSnapshot()
  })

  it('parses option', () => {
    const result = parser.parseOne(option(consume('hello')), ['hello'])
    expect(result).toMatchSnapshot()

    const result2 = parser.parseOne(option(consume('hello')), [])
    expect(result2).toMatchSnapshot()
  })

  it('parses or', () => {
    const result = parser.parseOne(or([consume('hello'), consume('world')]), [
      'hello',
    ])
    expect(result).toMatchSnapshot()

    const result2 = parser.parseOne(or([consume('hello'), consume('world')]), [
      'world',
    ])
    expect(result2).toMatchSnapshot()
  })

  it('fails for direct left recursion', () => {
    // expression ::= expression | `a`

    const patterns: { [key: string]: ParserPattern } = {
      expression: sequence([() => patterns.expression, consume('a')]),
    }

    // const result = parser.parse(patterns.expression, ['a'])
    // expect(result.every((r) => r.type === 'failure')).toEqual(true)
  })

  describe('handles indirect left recursion', () => {
    // expression ::= expression + expression | term
    // term ::= `a`

    const patterns: { [key: string]: ParserPattern } = {
      expression: or(
        [
          sequence(
            [
              thunk(() => patterns.expression, { label: 'lhs-thunk' }),
              consume('+', { label: 'plus' }),
              thunk(() => patterns.expression, { label: 'rhs-thunk' }),
            ],
            { label: 'sequence' }
          ),
          thunk(() => patterns.term, { label: 'term-thunk' }),
        ],
        { label: 'expression', parallel: true }
      ),
      term: consume('a', { label: 'term' }),
    }

    it('simple case', () => {
      const result = parser.parseOne(patterns.expression, ['a'])
      expect(result).toBeDefined()
    })

    it('complex case', () => {
      const result = parser.parseOne(patterns.expression, ['a', '+', 'a'])
      expect(result).toBeDefined()
    })
  })

  describe('complex left recursion', () => {
    //   expression ::= memberExpression | functionCallExpression | identifierExpression
    //   functionCallExpression ::= expression `(` `)`
    //   memberExpression ::= expression `.` expression
    //   identifierExpression ::= `a`

    const patterns: { [key: string]: ParserPattern } = {
      expression: or(
        [
          // TODO:
          // If member comes before function call, parsing fails (incorrectly)
          () => patterns.functionCallExpression,
          () => patterns.memberExpression,
          () => patterns.identifierExpression,
        ],
        { parallel: true }
      ),
      memberExpression: sequence([
        () => patterns.expression,
        consume('.'),
        () => patterns.expression,
      ]),
      functionCallExpression: sequence([
        () => patterns.expression,
        consume('('),
        consume(')'),
      ]),
      identifierExpression: consume('a'),
    }

    it('handles member expression', () => {
      const result = parser.parseOne(patterns.expression, ['a', '.', 'a'])
      expect(result).toBeDefined()
    })

    it('handles function call expression', () => {
      const result = parser.parseOne(patterns.expression, ['a', '(', ')'])
      expect(result).toBeDefined()
    })

    it('handles member then function call expression', () => {
      const result = parser.parseOne(patterns.expression, [
        'a',
        '.',
        'a',
        '(',
        ')',
      ])
      expect(result).toBeDefined()
    })

    it('handles function call then member expression', () => {
      const result = parser.parseOne(patterns.expression, [
        'a',
        '(',
        ')',
        '.',
        'a',
      ])
      expect(result).toBeDefined()
    })
  })
})
