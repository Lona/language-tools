export type NextAction = { type: 'next'; value: string }

export type PushAction = { type: 'push'; value: string }

export type PopAction = { type: 'pop' }

export type Action = NextAction | PushAction | PopAction

export type Rule = {
  name: string
  pattern: string
  action?: Action
  discard: boolean
  // print: TokenPrintPattern
}

export type StateDefinition = {
  name: string
  rules: Rule[]
}

export type Position = {
  start: number
  end: number
}

export interface Token {
  type: string
  values: string[]
  position: Position
}

// export interface TokenWithPosition extends Token {
//   position: Position
// }

export type LexerDefinition = StateDefinition[]
