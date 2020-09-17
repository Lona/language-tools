import {
  Action,
  Rule,
  Position,
  NextAction,
  PushAction,
  PopAction,
  StateDefinition,
  Token,
} from './types'

/* -------- Actions -------- */

export function nextAction(value: string): NextAction {
  return { type: 'next', value }
}

export function pushAction(value: string): PushAction {
  return { type: 'push', value }
}

export function pop(): PopAction {
  return { type: 'pop' }
}

/* -------- Rules -------- */

type RuleOptions = {
  discard?: boolean
  action?: Action
  // print?: TokenPrintPattern
}

/**
 * Match a keyword followed by a word boundary
 */
export function keyword(name: string): Rule {
  return rule(name, new RegExp(name + '\\b'))
}

export function rule(name: string): Rule
export function rule(name: string, pattern: string | RegExp): Rule
export function rule(
  name: string,
  pattern: string | RegExp,
  options: RuleOptions
): Rule
export function rule(
  name: string,
  pattern?: string | RegExp,
  options: RuleOptions = {}
): Rule {
  const source = pattern instanceof RegExp ? pattern.source : pattern

  return {
    name,
    pattern: source ?? name,
    discard: options.discard ?? false,
    // print: options.print ?? { type: 'literal', value: pattern },
    action: options.action,
  }
}

/* -------- Tokens -------- */

type TokenOptions = { value?: string; values?: string[]; position?: Position }

export function token(type: string): Token
export function token(type: string, value: string): Token
export function token(type: string, options: TokenOptions): Token

export function token(
  type: string,
  optionsOrValue?: TokenOptions | string
): Token {
  const options =
    typeof optionsOrValue === 'undefined'
      ? {}
      : typeof optionsOrValue === 'string'
      ? { values: [optionsOrValue] }
      : optionsOrValue

  return {
    type,
    values: options.values ?? [],
    position: options.position ?? { start: 0, end: 0 },
  }
}

/* -------- States -------- */

export type RuleShorthand =
  | string
  | [string]
  | [string, string | RegExp]
  | [string, string | RegExp, string]
  | [string, string | RegExp, RuleOptions]

/**
 * Support Monarch lexer shorthand patterns
 */
export function normalizeRule(rule: Rule | RuleShorthand): Rule {
  let arrayOrRule = typeof rule === 'string' ? [rule] : rule

  if (arrayOrRule instanceof Array) {
    const [name, pattern, options] = arrayOrRule

    const source = pattern instanceof RegExp ? pattern.source : pattern

    return {
      name,
      pattern: source ?? name,
      discard: false,
      ...(typeof options === 'string'
        ? { action: { type: 'next', value: options } }
        : options),
    }
  }

  return arrayOrRule
}

export function state(
  name: string,
  rules: Parameters<typeof normalizeRule>[0][]
): StateDefinition {
  if (rules.length === 0) {
    throw new Error('A lexer state must contain at least 1 rule')
  }

  return { name, rules: rules.map(normalizeRule) }
}
