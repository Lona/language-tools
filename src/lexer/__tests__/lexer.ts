import { rule, state } from '../builders'
import { Lexer } from '../Lexer'

it('tokenizes simple tokens', () => {
  const lexer = Lexer.stateless([
    ['from'],
    ['select'],
    ['where'],
    ['identifier', '[a-zA-Z]\\w*'],
    ['integer', '0|[1-9]\\d*'],
    ['_', '\\W+'],
  ])

  const tokens = lexer.tokenize('select foo from 123')

  expect(tokens).toMatchSnapshot()
})

it('captures groups', () => {
  const lexer = Lexer.stateless([['tag', '<(\\w+)>']])

  const tokens = lexer.tokenize('<hi>')

  expect(tokens).toMatchSnapshot()
})

it('supports states', () => {
  const lexer = new Lexer([
    state('main', [
      ['quote', '"', 'string'],
      ['content', '[^"]+'],
    ]),
    state('string', [
      ['quote', '"', 'main'],
      ['string', '[^"]+'],
    ]),
  ])

  const tokens = lexer.tokenize('hello world "this is a string" ok')

  expect(tokens).toMatchSnapshot()
})

it('fails if no input is consumed', () => {
  const lexer = Lexer.stateless([rule('nothing', '')])

  expect(() => {
    lexer.tokenize('hello world "this is a string" ok')
  }).toThrow()
})
