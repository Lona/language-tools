import { find } from 'tree-visit'
import { doc, Doc } from 'prettier'
import { ParserMatch } from '../parser/Parser'
import { Parse } from '../parser/types'

function getChildren<Token>(
  item: Parse<string, Token>
): Parse<string, Token>[] {
  switch (item.type) {
    case 'consume':
    case 'printLine':
    case 'printLiteral':
      return []
    case 'printGroup':
    case 'printIndent':
    case 'printIf':
    case 'or':
    case 'thunk':
      return [item.match]
    case 'option':
      return item.match ? [item.match] : []
    case 'sequence':
      return item.match
    case 'many':
      return [
        ...item.match,
        ...(item.matchSeparator ? item.matchSeparator : []),
      ]
  }
}

export function findReference<Token>(
  root: Parse<string, Token>,
  reference: string
): Parse<string, Token> | undefined {
  return find(root, {
    getChildren,
    predicate: (match) => 'as' in match && match.as === reference,
  })
}

export function isTruthy<Token>(match: Parse<string, Token>): boolean {
  if (match.type === 'many' && match.match.length === 0) {
    return false
  } else if (match.type === 'option' && match.match === null) {
    return false
  }
  return true
}

const {
  builders: { concat, line, hardline, softline, indent, group },
} = doc

export type PrinterOptions<Token> = {
  tokenToString: (token: Token) => string
}

export class Printer<Token> {
  tokenToString: (token: Token) => string

  constructor(options: PrinterOptions<Token>) {
    this.tokenToString = options.tokenToString
  }

  format = (match: Parse<string, Token>): Doc => {
    switch (match.type) {
      case 'thunk':
        return this.format(match.match)
      case 'printIf': {
        const resolved = findReference(match, match.reference)

        let hasReference = resolved && isTruthy(resolved)

        return concat([
          ...(hasReference && match.before ? [this.format(match.before)] : []),
          this.format(match.match),
          ...(hasReference && match.after ? [this.format(match.after)] : []),
        ])
      }
      case 'printGroup':
        return group(this.format(match.match))
      case 'printIndent':
        return indent(this.format(match.match))
      case 'printLiteral': {
        return match.value
      }
      case 'printLine': {
        switch (match.kind) {
          case 'hard':
            return hardline
          case 'soft':
            return softline
          default:
            return line
        }
      }
      case 'consume': {
        return this.tokenToString(match.match)
      }
      case 'sequence': {
        return concat(match.match.map(this.format))
      }
      case 'or': {
        return this.format(match.match)
      }
      case 'many': {
        if (match.separator) {
          const items: Doc[] = []

          for (let i = 0; i < match.match.length; i++) {
            items.push(this.format(match.match[i]))

            if (i < match.match.length - 1) {
              items.push(this.format(match.matchSeparator[i]))
            }
          }

          return concat(items)
        }

        return concat(match.match.map(this.format))
      }
      case 'option': {
        if (match.match) {
          return this.format(match.match)
        }

        return ''
      }
    }
  }

  print(match: Parse<string, Token>, options?: Partial<doc.printer.Options>) {
    const document = group(this.format(match))
    // const document = this.format(match))

    return doc.printer.printDocToString(document, {
      ...defaultPrintOptions,
      ...options,
    }).formatted
  }
}

const defaultPrintOptions: doc.printer.Options = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
}
