import { inspect } from 'util'
import memoize from '../utils/memoize'
import { RuleShorthand, state } from './builders'
import { Rule, StateDefinition, Token } from './types'

const getRegExp = memoize(
  (pattern: string): RegExp => new RegExp('^(?:' + pattern + ')')
)

export class Lexer {
  stateDefinitions: StateDefinition[]

  static stateless(rules: (Rule | RuleShorthand)[]): Lexer {
    return new Lexer([state('main', rules)])
  }

  constructor(states: StateDefinition[]) {
    if (states.length === 0) {
      throw new Error('A lexer must be defined with at least one state')
    }

    this.stateDefinitions = states
  }

  tokenize(
    source: string,
    initialState?: string[],
    { positionTracking }: { positionTracking?: boolean } = {}
  ): Token[] {
    const stack: string[] = initialState ?? [this.stateDefinitions[0].name]

    for (let name of stack) {
      if (!this.stateDefinitions.some((state) => state.name === name)) {
        throw new Error(`Lexer state "${name}" isn't defined`)
      }
    }

    let length = source.length
    let pos = 0
    let tokens: Token[] = []

    main: while (pos < length) {
      const currentState = stack[stack.length - 1]

      const stateDefinition = this.stateDefinitions.find(
        (definition) => definition.name === currentState
      )

      if (!stateDefinition) {
        console.log(currentState, stack)
        throw new Error(`Invalid lexer state: ${currentState}.`)
      }

      const { rules } = stateDefinition

      const slice = source.slice(pos)

      for (let rule of rules) {
        let regExp = getRegExp(rule.pattern)

        const match = slice.match(regExp)

        if (match) {
          const [value, ...values] = match

          if (value.length === 0 && !rule.action) {
            throw new Error(
              `Lexer stalled: the pattern matched, but no input was consumed and no action taken for rule: ${inspect(
                rule
              )}.`
            )
          }

          if (rule.discard !== true) {
            tokens.push({
              type: rule.name,
              values,
              position: {
                start: positionTracking !== false ? pos : 0,
                end: positionTracking !== false ? pos + value.length : 0,
              },
            })
          }

          if (rule.action) {
            switch (rule.action.type) {
              case 'next':
                stack[stack.length - 1] = rule.action.value
                break
              case 'push':
                stack.push(rule.action.value)
                break
              case 'pop':
                if (stack.length === 1) {
                  throw new Error(
                    `Lexer tried to pop to empty state from state: ${stack[0]}`
                  )
                }

                stack.pop()
                break
            }
          }

          pos += value.length

          continue main
        }
      }

      console.error(
        `Failed to parse: ${slice}\n`,
        currentState,
        rules.map((rule) => rule.pattern)
      )

      break
    }

    return tokens
  }
}
