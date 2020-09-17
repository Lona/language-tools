import fs from 'fs'
import path from 'path'
import { resetId } from '../../parser/builders'
import { Pattern } from '../../parser/types'
import { lexer, parser, patterns, printer, shaper } from '../logic'
import { inspect } from 'util'

function expectParse(
  source: string,
  pattern: Pattern<string>,
  expectedShape?: unknown
) {
  const tokens = lexer.tokenize(source, undefined, tokenizeOptions)
  const result = parser.parseOne(pattern, tokens)

  expect(printer.print(result)).toEqual(source)

  const shape = shaper.extract(result)

  if (expectedShape) {
    expect(shape).toEqual(expectedShape)
  } else {
    expect(shape).toMatchSnapshot()
  }

  const recreated = shaper.inject(shape, pattern)
  expect(recreated).toEqual(result)
}

const tokenizeOptions = {
  positionTracking: false,
}

describe('Logic Language', () => {
  beforeEach(() => {
    resetId()
  })

  it('tokenizes', () => {
    const tokens = lexer.tokenize('let x = 123')
    expect(tokens.length).toEqual(4)
  })

  it('parses identifier', () => {
    expectParse('foo', patterns.identifier, { value: 'foo' })
  })

  it('parses typeAnnotation', () => {
    expectParse('Foo', patterns.typeAnnotation, {
      value: 'Foo',
      genericArguments: [],
    })
    expectParse('Foo<A>', patterns.typeAnnotation, {
      value: 'Foo',
      genericArguments: [{ value: 'A', genericArguments: [] }],
    })
    expectParse('Foo<A, B>', patterns.typeAnnotation, {
      value: 'Foo',
      genericArguments: [
        { value: 'A', genericArguments: [] },
        { value: 'B', genericArguments: [] },
      ],
    })
  })

  it('parses program', () => {
    expectParse(`let foo: Number = x\nstruct Foo {}`, patterns.program)
  })

  it('parses declaration', () => {
    expectParse('let foo: Number = x', patterns.declaration)
    expectParse('struct Foo {}', patterns.declaration)
    expectParse('enum Foo {}', patterns.declaration)
  })

  it('parses import declaration', () => {
    expectParse('import Foo', patterns.importDeclaration)
  })

  it('parses function declaration', () => {
    expectParse('func foo() -> Number {}', patterns.functionDeclaration)
    expectParse(
      'func foo(a: b, c: d) -> Number {}',
      patterns.functionDeclaration
    )
    expectParse('func foo<A>() -> Number {}', patterns.functionDeclaration)
    expectParse('func foo<A, B>() -> Number {}', patterns.functionDeclaration)
  })

  it('parses variable declaration', () => {
    expectParse('let foo: Number = x', patterns.variableDeclaration)
    expectParse('let foo: Number = 1', patterns.variableDeclaration)
    expectParse('@attr\nlet foo: Number = x', patterns.variableDeclaration)
    expectParse(
      '@attr1\n@attr2\nlet foo: Number = x',
      patterns.variableDeclaration
    )
    expectParse(
      '/* comment */\nlet foo: Number = x',
      patterns.variableDeclaration
    )
  })

  it('parses structs', () => {
    expectParse('struct Foo {}', patterns.structDeclaration)
    expectParse(
      `struct Foo {
  let foo: Number = x
}`,
      patterns.structDeclaration
    )
    expectParse(
      `struct Foo {
  let foo: Number = x
  let bar: String = y
}`,
      patterns.structDeclaration
    )
    expectParse('struct Foo<A> {}', patterns.structDeclaration)
  })

  it('parses enums', () => {
    expectParse('enum Foo {}', patterns.enumDeclaration)
    expectParse(
      `enum Foo {
  case a()
}`,
      patterns.enumDeclaration
    )
    expectParse(
      `enum Foo {
  case a(param: Number)
}`,
      patterns.enumDeclaration
    )
    expectParse(
      `enum Foo {
  case a(Number)
}`,
      patterns.enumDeclaration
    )
  })

  it('parses boolean literal', () => {
    expectParse('true', patterns.booleanLiteral)
    expectParse('false', patterns.booleanLiteral)
  })

  it('parses number literal', () => {
    expectParse('1.0', patterns.numberLiteral)
    expectParse('1', patterns.numberLiteral)
  })

  it('parses string literal', () => {
    expectParse('"abc"', patterns.stringLiteral)
    expectParse('""', patterns.stringLiteral)
  })

  it('parses array literal', () => {
    expectParse('[]', patterns.arrayLiteral)
    expectParse('[1, 2, 3]', patterns.arrayLiteral)
  })

  it('parses literal expression', () => {
    expectParse('1', patterns.literalExpression)
    expectParse('true', patterns.literalExpression)
  })

  it('parses identifier expression', () => {
    expectParse('x', patterns.identifierExpression)
  })

  it('parses function calls', () => {
    expectParse('foo()', patterns.functionCallExpression)
    expectParse('foo(a)', patterns.functionCallExpression)
    expectParse('foo(a, b)', patterns.functionCallExpression)
    expectParse('foo(a: b)', patterns.functionCallExpression)
    expectParse('foo(a: b, c: d)', patterns.functionCallExpression)
  })

  it('parses function call argument', () => {
    expectParse('a: b', patterns.functionCallArgument)
    expectParse('a', patterns.functionCallArgument)
  })

  it('parses member expressions', () => {
    expectParse('foo.bar', patterns.memberExpression)
    expectParse('foo.bar()', patterns.memberExpression)
  })

  it('parses expressions', () => {
    expectParse('x', patterns.expression)
    expectParse('1', patterns.expression)
    expectParse('[1, 2]', patterns.expression)
    expectParse('foo()', patterns.expression)
    expectParse('foo.bar', patterns.expression)
  })

  it('parses Prelude.logic', () => {
    const read = (name: string) =>
      fs.readFileSync(path.join(__dirname, 'mocks', name), 'utf8')

    const tokens = lexer.tokenize(
      read('Prelude.logic'),
      undefined,
      tokenizeOptions
    )

    const result = parser.parseOne(patterns.program, tokens)

    shaper.extract(result)
  })

  it('parses TextStyle.logic', () => {
    const read = (name: string) =>
      fs.readFileSync(path.join(__dirname, 'mocks', name), 'utf8')

    const tokens = lexer.tokenize(
      read('TextStyle.logic'),
      undefined,
      tokenizeOptions
    )

    try {
      const result = parser.parseOne(patterns.program, tokens)
      shaper.extract(result)
    } catch (e) {
      console.log(inspect(e, false, null))
      expect(false).toBe(true)
    }
  })
})
