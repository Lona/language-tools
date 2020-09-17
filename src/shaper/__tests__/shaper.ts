import {
  consume,
  many,
  option,
  or,
  printLine,
  sequence,
} from '../../parser/builders'
import { Parser } from '../../parser/Parser'
import { Shaper } from '../Shaper'

// Simple string tokens
let parser = new Parser({
  matchToken: (token: string, type: string) => token === type,
  tokenToValue: (token: string) => token,
})

const shaper = new Shaper<string, string>({
  stringToShape: (string: string) => string,
  shapeToToken: (string: string) => string,
  tokenToShape: (token: string) => token,
  orShapeToValue: (shape) => shape,
  orValueToShape: (value) => value,
})

it('shapes consume', () => {
  const pattern = consume('hello', { as: 'a' })
  const result = parser.parseOne(pattern, ['hello'])

  const shape = shaper.extract(result)
  expect(shape).toEqual({ a: 'hello' })

  const recreated = shaper.inject(shape, pattern)
  expect(recreated).toEqual(result)
})

describe('shapes or', () => {
  const pattern = or(
    [consume('hello', { as: 'b' }), consume('world', { as: 'c' })],
    {
      as: 'a',
    }
  )

  it('shapes case 0', () => {
    const result = parser.parseOne(pattern, ['hello'])

    const shape = shaper.extract(result)
    expect(shape).toMatchSnapshot()

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  it('shapes case 1', () => {
    const result = parser.parseOne(pattern, ['world'])

    const shape = shaper.extract(result)
    expect(shape).toMatchSnapshot()

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })
})

describe('shapes sequence', () => {
  const pattern = sequence(
    [consume('hello', { as: 'b' }), consume('world', { as: 'c' })],
    {
      as: 'a',
    }
  )

  const result = parser.parseOne(pattern, ['hello', 'world'])

  const shape = shaper.extract(result)
  expect(shape).toEqual({ a: { b: 'hello', c: 'world' } })

  const recreated = shaper.inject(shape, pattern)
  expect(recreated).toEqual(result)
})

describe('shapes many', () => {
  const pattern = many(consume('hello', { as: 'b' }), {
    as: 'a',
  })

  const result = parser.parseOne(pattern, ['hello', 'hello'])

  const shape = shaper.extract(result)
  expect(shape).toEqual({ a: [{ b: 'hello' }, { b: 'hello' }] })

  const recreated = shaper.inject(shape, pattern)
  expect(recreated).toEqual(result)
})

describe('shapes many with separator', () => {
  const pattern = many(consume('hello', { as: 'b' }), {
    separator: consume(','),
    as: 'a',
  })

  const result = parser.parseOne(pattern, ['hello', ',', 'hello', ',', 'hello'])

  const shape = shaper.extract(result)
  expect(shape).toEqual({ a: [{ b: 'hello' }, { b: 'hello' }, { b: 'hello' }] })

  const recreated = shaper.inject(shape, pattern)
  expect(recreated).toEqual(result)
})

describe('shapes many with line separator', () => {
  const pattern = many(consume('hello', { as: 'b' }), {
    separator: printLine(),
    as: 'a',
  })

  const result = parser.parseOne(pattern, ['hello', 'hello', 'hello'])

  const shape = shaper.extract(result)
  expect(shape).toEqual({ a: [{ b: 'hello' }, { b: 'hello' }, { b: 'hello' }] })

  const recreated = shaper.inject(shape, pattern)
  expect(recreated).toEqual(result)
})

describe('shapes option', () => {
  const pattern = option(consume('hello', { as: 'b' }), {
    as: 'a',
  })

  it('shapes existing option', () => {
    const result = parser.parseOne(pattern, ['hello'])

    const shape = shaper.extract(result)
    expect(shape).toEqual({ a: { b: 'hello' } })

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  it('shapes missing option', () => {
    const result = parser.parseOne(pattern, [])

    const shape = shaper.extract(result)
    expect(shape).toEqual({ a: null })

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })
})

describe('complex pattern', () => {
  const pattern = sequence(
    [
      consume('name', { as: 'name' }),
      option(
        sequence(
          [
            consume('<'),
            many(consume('Type', { as: 'type' }), {
              as: 'genericArguments',
              label: 'many type',
              separator: sequence([consume(','), printLine()]),
            }),
            consume('>'),
          ],
          {
            label: 'inner sequence',
          }
        ),
        {
          as: 'genericArguments',
          select: 'genericArguments',
          label: 'optional generics',
        }
      ),
    ],
    { label: 'complex sequence' }
  )

  it('nested optional without value', () => {
    const result = parser.parseOne(pattern, ['name'])

    const shape = shaper.extract(result)
    expect(shape).toMatchSnapshot()

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })

  it('nested optional with value', () => {
    const result = parser.parseOne(pattern, [
      'name',
      '<',
      'Type',
      ',',
      'Type',
      '>',
    ])

    const shape = shaper.extract(result)
    expect(shape).toMatchSnapshot()

    const recreated = shaper.inject(shape, pattern)
    expect(recreated).toEqual(result)
  })
})
