import { Printer } from '../printer/Printer'
import { Parser, ParserPattern } from '../parser/Parser'
import { Shaper } from '../shaper/Shaper'
import { Lexer } from '../lexer/Lexer'
import { Token } from '../lexer/types'
import { lexer } from '../languages/logic'

interface TemplateOptions<TokenShape, OrShape> {
  lexer: Lexer
  printer: Printer<Token>
  parser: Parser<Token, Token>
  shaper: Shaper<Token, TokenShape, OrShape>
  patterns: Record<string, ParserPattern>
}

type StringTemplateFunction<Shape> = (
  strings: TemplateStringsArray,
  ...nodes: [string, Shape][]
) => string

type NodeTemplateFunction<Shape> = (
  strings: TemplateStringsArray,
  ...nodes: [string, Shape][]
) => Shape

type Templates<Shape> = {
  node: Record<string, NodeTemplateFunction<Shape>>
  string: StringTemplateFunction<Shape>
}

export function createTemplates<TokenShape, OrShape>(
  options: TemplateOptions<TokenShape, OrShape>
): Templates<TokenShape | OrShape> {
  const { printer, parser, shaper, patterns } = options

  function createString(
    strings: TemplateStringsArray,
    ...nodes: [string, TokenShape | OrShape][]
  ) {
    let result = strings[0]

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const string = strings[i + 1]
      const [type, shape] = node
      const parsed = shaper.inject(shape, patterns[type])
      const printed = printer.print(parsed)
      result += printed + string
    }

    return result
  }

  return {
    node: Object.fromEntries(
      Object.entries(patterns).map(([key, pattern]) => {
        function createNode(
          strings: TemplateStringsArray,
          ...nodes: [string, TokenShape | OrShape][]
        ) {
          const text = createString(strings, ...nodes)
          const tokens = lexer.tokenize(text, undefined, {
            positionTracking: false,
          })
          const parsed = parser.parseOne(pattern, tokens)
          const shape = shaper.extract(parsed) as TokenShape | OrShape
          return shape
        }

        return [key, createNode]
      })
    ),
    string: createString,
  }
}
