import { templates } from '../logic'

describe('Logic Templates', () => {
  const typeAnnotation = { value: 'Number', genericArguments: null }
  const numberLiteral = { type: 'integer', value: '1' }

  it('generates a string', () => {
    // const string = templates.string`let x: ${[
    //   'typeAnnotation',
    //   typeAnnotation,
    // ]} = ${['numberLiteral', numberLiteral]}`
    // expect(string).toEqual(`let x: Number = 1`)
  })

  it('generates a node', () => {
    // const node = templates.node.variableDeclaration`let x: ${[
    //   'typeAnnotation',
    //   typeAnnotation,
    // ]} = ${['numberLiteral', numberLiteral]}`
    // expect(node).toMatchSnapshot()
  })
})
