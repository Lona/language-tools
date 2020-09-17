import { state } from '../lexer/builders'
import { LexerDefinition } from '../lexer/types'
import {
  consume,
  many,
  or,
  printGroup,
  printIf,
  printIndent,
  printLine,
  printLiteral,
  printIndentedMany,
  sequence,
  language,
  typedOr,
} from '../parser/builders'
import { ParserPattern } from '../parser/Parser'

export const lexerDefinition: LexerDefinition = [
  state('main', [
    ['comment', /<!--(.*?)-->/],
    ['</', /<\//, 'inside'],
    ['<', /</, 'inside'],
    ['charData', /([^<&]+)/],
  ]),
  state('inside', [
    ['whitespace', /[ \t\r\n]/, { discard: true }],
    ['string', /"([^<"]*)"/],
    ['name', /([a-zA-Z0-9]+)/],
    ['='],
    ['>', />/, 'main'],
    ['/>', /\/>/, 'main'],
  ]),
]

export const patterns = language({
  element: [
    consume('<'),
    consume('name', 'tag'),
    printIndent(
      printIf(
        printGroup(
          many(() => patterns.attribute, {
            separator: printLine(),
            as: 'attributes',
          })
        ),
        { reference: 'attributes', before: printLine() }
      )
    ),
    typedOr(
      [
        ['selfClosing', consume('/>')],
        [
          'open',
          [
            consume('>'),
            many(() => patterns.elementContent, {
              as: 'content',
              label: 'contentItem',
            }),
            consume('</'),
            consume('name', 'closingTag'),
            consume('>'),
          ],
        ],
      ],
      { as: 'content', label: 'ElementClosing' }
    ),
  ],
  elementContent: typedOr(
    [
      ['charData', consume('charData', '.')],
      [
        'comment',
        sequence(
          [
            printLiteral('<!--'),
            consume('comment', 'text'),
            printLiteral('-->'),
          ],
          { select: 'text' }
        ),
      ],
      ['element', () => patterns.element],
    ],
    { as: '.', label: 'ElementContent' }
  ),
  attribute: [
    consume('name', 'name'),
    consume('='),
    printLiteral('"'),
    consume('string', 'value'),
    printLiteral('"'),
  ],
})
