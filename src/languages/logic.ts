import { state, token, keyword } from '../lexer/builders'
import { Lexer } from '../lexer/Lexer'
import { LexerDefinition, Token } from '../lexer/types'
import {
  consume,
  language,
  many,
  option,
  printIf,
  printIndentedMany,
  printLine,
  printLiteral,
  sequence,
  thunk,
  typedOr,
} from '../parser/builders'
import { Parser, ParserPattern } from '../parser/Parser'
import { Printer } from '../printer/Printer'
import { Shaper } from '../shaper/Shaper'
import { createTemplates } from '../templates/templates'
import countGroups from '../utils/countGroups'

export const lexerDefinition: LexerDefinition = [
  state('main', [
    keyword('true'),
    keyword('false'),
    keyword('enum'),
    keyword('case'),
    keyword('struct'),
    keyword('extension'),
    keyword('let'),
    keyword('func'),
    keyword('return'),
    keyword('import'),

    // Special chars
    '#',
    '@',
    ['[', /\[/],
    [']', /\]/],
    ['{', /\{/],
    ['}', /\}/],
    ['(', /\(/],
    [')', /\)/],
    ',',
    ':',
    '->',
    '=',
    '>',
    '<',
    ['.', /\./],

    ['identifier', /([_a-zA-Z][_a-zA-Z0-9]*)/],
    ['string', /"([^"]*)"/],
    ['float', /((?:\+|-)?[0-9]+\.[0-9]+)/],
    ['integer', /((?:\+|-)?[0-9]+)/],
    ['comment', /\/\*([\S\s]*?)\*\//],
    ['whitespace', /[ \t\n\r]+/, { discard: true }],
  ]),
]

const blockDeclaration = (kind: string, body: ParserPattern): ParserPattern =>
  sequence([
    option(() => patterns.comment, 'comment'),
    () => patterns.attributeList,
    consume(kind),
    printLine(),
    thunk(() => patterns.identifier, 'name'),
    option(() => patterns.genericIdentifierList, {
      as: 'generics',
      select: 'generics',
      defaultValue: [],
    }),
    printLine(),
    consume('{'),
    printIndentedMany(
      many(body, {
        as: 'body',
        separator: printLine('hard'),
      }),
      { padding: 'hard' }
    ),
    consume('}'),
  ])

export const patterns = language({
  program: many(() => patterns.declaration, {
    as: 'declarations',
    separator: printLine('hard'),
  }),
  declaration: typedOr(
    [
      ['variableDeclaration', () => patterns.variableDeclaration],
      ['structDeclaration', () => patterns.structDeclaration],
      ['namespaceDeclaration', () => patterns.namespaceDeclaration],
      ['functionDeclaration', () => patterns.functionDeclaration],
      ['enumDeclaration', () => patterns.enumDeclaration],
      ['importDeclaration', () => patterns.importDeclaration],
    ],
    {
      as: '.',
    }
  ),
  importDeclaration: [
    consume('import'),
    printLine(),
    thunk(() => patterns.identifier, 'name'),
  ],
  comment: [
    printLiteral('/*'),
    consume('comment', 'comment'),
    printLiteral('*/'),
    printLine('hard'),
  ],
  attributeList: printIf(
    many(() => patterns.attribute, {
      as: 'attributes',
      separator: printLine('hard'),
    }),
    { reference: 'attributes', after: printLine('hard') }
  ),
  genericIdentifierList: [
    consume('<'),
    many(() => patterns.identifier, {
      separator: [consume(','), printLine()],
      as: 'generics',
    }),
    consume('>'),
  ],
  variableDeclaration: [
    option(() => patterns.comment, 'comment'),
    () => patterns.attributeList,
    consume('let'),
    printLine(),
    thunk(() => patterns.identifier, 'name'),
    consume(':'),
    printLine(),
    thunk(() => patterns.typeAnnotation, 'annotation'),
    printLine(),
    consume('='),
    printLine(),
    thunk(() => patterns.expression, 'initializer'),
  ],
  functionParameter: [
    thunk(() => patterns.identifier, 'name'),
    consume(':'),
    printLine(),
    thunk(() => patterns.typeAnnotation, 'annotation'),
  ],
  functionDeclaration: [
    option(() => patterns.comment, 'comment'),
    () => patterns.attributeList,
    consume('func'),
    printLine(),
    thunk(() => patterns.identifier, 'name'),
    option(() => patterns.genericIdentifierList, {
      as: 'generics',
      select: 'generics',
      defaultValue: [],
    }),
    consume('('),
    printIndentedMany(
      many(() => patterns.functionParameter, {
        as: 'arguments',
        separator: [consume(','), printLine()],
      }),
      { padding: 'soft' }
    ),
    consume(')'),
    printLine(),
    consume('->'),
    printLine(),
    thunk(() => patterns.typeAnnotation, 'returnType'),
    printLine(),
    consume('{'),
    consume('}'),
  ],
  structDeclaration: blockDeclaration(
    'struct',
    thunk(() => patterns.declaration)
  ),
  namespaceDeclaration: blockDeclaration(
    'extension',
    thunk(() => patterns.declaration)
  ),
  enumDeclaration: blockDeclaration(
    'enum',
    thunk(() => patterns.enumCase)
  ),
  enumCase: [
    option(() => patterns.comment, 'comment'),
    consume('case'),
    printLine(),
    thunk(() => patterns.identifier, 'name'),
    consume('('),
    many(() => patterns.associatedValue, {
      as: 'associatedValues',
      separator: [consume(','), printLine()],
    }),
    consume(')'),
  ],
  expression: typedOr(
    [
      ['functionCallExpression', () => patterns.functionCallExpression],
      ['memberExpression', () => patterns.memberExpression],
      ['identifierExpression', () => patterns.identifierExpression],
      ['literalExpression', () => patterns.literalExpression],
    ],
    {
      parallel: true,
      as: '.',
    }
  ),
  functionCallExpression: [
    thunk(() => patterns.expression, 'expression'),
    consume('('),
    printIndentedMany(
      many(() => patterns.functionCallArgument, {
        as: 'arguments',
        separator: [consume(','), printLine()],
      }),
      { padding: 'soft' }
    ),
    consume(')'),
  ],
  functionCallArgument: [
    option(
      [
        sequence([() => patterns.identifier, consume(':'), printLine()], {
          as: 'identifier',
        }),
      ],
      {
        as: 'label',
        select: 'identifier',
      }
    ),
    thunk(() => patterns.expression, 'expression'),
  ],
  associatedValue: [
    option(
      sequence([() => patterns.identifier, consume(':'), printLine()], {
        as: 'identifier',
      }),
      {
        as: 'label',
        select: 'identifier',
      }
    ),
    thunk(() => patterns.typeAnnotation, 'annotation'),
  ],
  memberExpression: [
    thunk(() => patterns.expression, 'expression'),
    consume('.'),
    thunk(() => patterns.expression, 'member'),
  ],
  identifierExpression: [() => patterns.identifier],
  literalExpression: typedOr(
    [
      ['boolean', () => patterns.booleanLiteral],
      ['number', () => patterns.numberLiteral],
      ['string', () => patterns.stringLiteral],
      ['array', () => patterns.arrayLiteral],
    ],
    {
      as: '.',
    }
  ),
  booleanLiteral: typedOr(
    [
      ['true', consume('true')],
      ['false', consume('false')],
    ],
    {
      as: '.',
    }
  ),
  numberLiteral: typedOr(
    [
      ['integer', consume('integer', '.')],
      ['float', consume('float', '.')],
    ],
    {
      as: '.',
    }
  ),
  stringLiteral: [
    printLiteral('"'),
    consume('string', 'value'),
    printLiteral('"'),
  ],
  arrayLiteral: [
    consume('['),
    printIndentedMany(
      many(() => patterns.expression, {
        as: 'body',
        separator: sequence([consume(','), printLine()]),
      }),
      { padding: 'soft' }
    ),
    consume(']'),
  ],
  typeAnnotation: [
    () => patterns.identifier,
    option(
      [
        consume('<'),
        many(() => patterns.typeAnnotation, {
          as: 'genericArguments',
          separator: [consume(','), printLine()],
        }),
        consume('>'),
      ],
      {
        as: 'genericArguments',
        select: 'genericArguments',
        defaultValue: [],
      }
    ),
  ],
  identifier: consume('identifier', 'value'),
  attribute: [consume('@'), consume('identifier', 'value')],
})

export const lexer = new Lexer(lexerDefinition)

export const parser = new Parser({
  matchToken: (token: Token, type: string) => token.type === type,
  tokenToValue: (token: Token) => token,
})

const tokenToString = (token: Token): string =>
  token.values.length > 0 ? token.values[0] : token.type

export const printer = new Printer({
  tokenToString,
})

const tokenTypesWithValues: string[] = lexerDefinition
  .flatMap((definition) => definition.rules)
  .filter((rule) => countGroups(rule.pattern) > 0)
  .map((rule) => rule.name)

export const shaper = new Shaper<Token, string, any>({
  shapeToToken: (shape: string, type: string) =>
    tokenTypesWithValues.includes(type)
      ? token(type, { values: [shape] })
      : token(type),
  tokenToShape: tokenToString,
  stringToShape: (string: string, type: string): string =>
    tokenTypesWithValues.includes(type) ? string : type,
  orShapeToValue: (shape) => shape,
  orValueToShape: (value) => value,
})

export const templates = createTemplates({
  lexer,
  parser,
  shaper,
  patterns,
  printer,
})
