import path from 'path'
import fs from 'fs'
import { lexer, patterns, shaper, parser } from './languages/logic'
import { Parser } from './parser/Parser'
import { many, consume, sequence } from './parser/builders'

const prelude = fs.readFileSync(
  path.join(__dirname, '../src/languages/__tests__/mocks/TextStyle.logic'),
  'utf8'
)
const tokens = lexer.tokenize(prelude, undefined, { positionTracking: false })
parser.parseOne(patterns.program, tokens)
// const result = parser.parseOne(patterns.program, tokens)
// shaper.extract(result)

// // Simple string tokens
// let parser = new Parser<string, string>({
//   matchToken: (token: string, type: string) => token === type,
//   tokenToValue: (token: string) => token,
//   verbose: true,
// })

// // const result = parser.parseOne(many(consume('hello')), ['hello', 'hello'])
// const result = parser.parseOne(sequence([consume('hello'), consume('world')]), [
//   'hello',
//   'world',
// ])

// console.log(result)
