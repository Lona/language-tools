import { inspect } from 'util'
import identifierCache, { IdentifierCache } from '../utils/identifierCache'
import { memoizeDirect } from '../utils/memoize'
import { Result } from '../utils/Result'
import * as Sets from '../utils/Sets'
import {
  ConsumePattern,
  ManyMatch,
  ManyPattern,
  Match,
  OptionPattern,
  OrPattern,
  Parse,
  Pattern,
  SequenceMatch,
  SequencePattern,
  ThunkPattern,
  PrintIndentPattern,
  PrintGroupPattern,
  PrintIfPattern,
  PrintLiteralPattern,
  PrintLinePattern,
} from './types'

type TokenIndex = number

enum FailureType {
  inifiteRecursion,
  tokensRemaining,
  tokensConsumed,
  unexpectedToken,
  orFailure,
}

function failureDescription<T>(
  failureValue: FailureValue,
  tokens: T[]
): string {
  switch (failureValue.type) {
    case FailureType.inifiteRecursion:
      return `Infinite left recursion`
    case FailureType.tokensRemaining:
      return `Failed to consume all input tokens. The ${failureValue.tokenCount} remaining.`
    case FailureType.tokensConsumed:
      return `Expected token '${failureValue.expectedType}', but all tokens were already consumed`
    case FailureType.unexpectedToken:
      return `Expected token '${
        failureValue.expectedType
      }', but found: ${inspect(tokens[failureValue.foundIndex])}`
    case FailureType.orFailure:
      return `Failed to match 'or' pattern: ${failureValue.patternLabel}`
  }
}

type FailureValue =
  | { type: FailureType.inifiteRecursion }
  | { type: FailureType.tokensRemaining; tokenCount: number }
  | { type: FailureType.tokensConsumed; expectedType: string }
  | {
      type: FailureType.unexpectedToken
      expectedType: string
      foundIndex: number
    }
  | { type: FailureType.orFailure; patternLabel: string }

namespace Failure {
  export const inifiteRecursion: FailureValue = {
    type: FailureType.inifiteRecursion,
  }

  export const tokensRemaining = memoizeDirect(
    (tokenCount: number): FailureValue => {
      return {
        type: FailureType.tokensRemaining,
        tokenCount,
      }
    }
  )

  export const tokensConsumed = memoizeDirect(
    (expectedType: string): FailureValue => {
      return {
        type: FailureType.tokensConsumed,
        expectedType,
      }
    }
  )

  export const unexpectedToken = memoizeDirect(
    (expectedType: string, foundIndex: number): FailureValue => {
      return {
        type: FailureType.unexpectedToken,
        expectedType,
        foundIndex,
      }
    }
  )

  export const orFailure = memoizeDirect(
    (patternLabel: string): FailureValue => {
      return {
        type: FailureType.orFailure,
        patternLabel,
      }
    }
  )
}

type ParseResultIndex = string
type ParseFailureIndex = string
type RecMapIndex = string

export type ParseResult = Result<ParseResultIndex, ParseFailureIndex> & {
  tokenIndex: TokenIndex
  leftRecMap: RecMapIndex
}

function success(
  value: ParseResultIndex,
  tokenIndex: TokenIndex,
  leftRecMap: RecMapIndex
): ParseResult {
  return { type: 'success', value, tokenIndex, leftRecMap }
}

function failure(
  value: ParseFailureIndex,
  tokenIndex: TokenIndex,
  leftRecMap: RecMapIndex
): ParseResult {
  return { type: 'failure', value, tokenIndex, leftRecMap }
}

export type ParserPattern = Pattern<string>

export type ParserMatch = Match<string>

export interface ParserOptions<Token, Value> {
  matchToken: (token: Token, type: string) => boolean
  tokenToValue: (token: Token) => Value
  verbose?: boolean
}

type Continuation<Token, Value> = (result: ParseResultIndex[]) => void

function callcc<F extends (...args: any[]) => any, Token, Value>(
  f: F
): ParseResultIndex[] {
  let out: ParseResultIndex[]

  let cc: Continuation<Token, Value> = (result: ParseResultIndex[]) => {
    out = result
  }

  f(cc)

  return out!
}

type LeftRecMap = Record<string, number>
type LeftRecContext = [number, LeftRecMap][]

interface ParseContext<Token, Value> {
  results: IdentifierCache<ParseResult>
  matches: IdentifierCache<ParserMatch>
  values: IdentifierCache<Value>
  failures: IdentifierCache<FailureValue>
  recMaps: IdentifierCache<LeftRecMap>
  success: (
    value: ParseResultIndex,
    tokenIndex: TokenIndex,
    leftRecMap?: RecMapIndex
  ) => string
  failure: (
    value: ParseFailureIndex,
    tokenIndex: TokenIndex,
    leftRecMap?: RecMapIndex
  ) => string
  getResultType: (resultId: ParseResultIndex) => 'success' | 'failure'
  memo: Record<string, ParseResultIndex[]>
  leftRecCount: Record<string, number>
  leftRecContext: LeftRecContext
  leftRecContextOfResult: Record<string, LeftRecMap>
  path: string[]
  tokens: Token[]
}

const emptyObject = {}

const stack: any[] = []

const delay = <T extends (...args: any[]) => any>(f: T) => {
  stack.push(f)
}

export class Parser<Token, Value> {
  matchToken: (token: Token, type: string) => boolean
  tokenToValue: (token: Token) => Value
  verbose: boolean

  constructor(options: ParserOptions<Token, Value>) {
    this.matchToken = options.matchToken
    this.tokenToValue = options.tokenToValue
    this.verbose = options.verbose ?? false
  }

  rebuildParseTree(
    matchId: string,
    pattern: ParserPattern,
    context: ParseContext<Token, Value>
  ): Parse<string, Value> {
    const match = context.matches.get(matchId)

    switch (match.type) {
      case 'consume': {
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return { ...typedPattern, match: context.values.get(match.match) }
      }
      case 'thunk': {
        const typedMatch = match as Extract<
          ParserMatch,
          { type: typeof match.type }
        >
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return {
          ...typedPattern,
          match: this.rebuildParseTree(
            typedMatch.match,
            typedPattern.value(),
            context
          ),
        }
      }
      case 'printIf':
      case 'printIndent':
      case 'printGroup': {
        const typedMatch = match as Extract<
          ParserMatch,
          { type: typeof match.type }
        >
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return {
          ...typedPattern,
          match: this.rebuildParseTree(
            typedMatch.match,
            typedPattern.value,
            context
          ),
        }
      }
      case 'printLine':
      case 'printLiteral': {
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return {
          ...typedPattern,
        }
      }
      case 'sequence': {
        const typedMatch = match as Extract<
          ParserMatch,
          { type: typeof match.type }
        >
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return {
          ...typedPattern,
          match: typedMatch.match.map((id, i) =>
            this.rebuildParseTree(id, typedPattern.value[i], context)
          ),
        }
      }
      case 'or': {
        const typedMatch = match as Extract<
          ParserMatch,
          { type: typeof match.type }
        >
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return {
          ...typedPattern,
          matchIndex: typedMatch.matchIndex,
          match: this.rebuildParseTree(
            typedMatch.match,
            typedPattern.value[typedMatch.matchIndex],
            context
          ),
        }
      }
      case 'many': {
        const typedMatch = match as Extract<
          ParserMatch,
          { type: typeof match.type }
        >
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        const separator = typedPattern.separator
        return {
          ...typedPattern,
          match: typedMatch.match.map((id, i) =>
            this.rebuildParseTree(id, typedPattern.value, context)
          ),
          matchSeparator: separator
            ? typedMatch.matchSeparator.map((id, i) =>
                this.rebuildParseTree(id, separator, context)
              )
            : [],
        }
      }
      case 'option': {
        const typedMatch = match as Extract<
          ParserMatch,
          { type: typeof match.type }
        >
        const typedPattern = pattern as Extract<
          ParserPattern,
          { type: typeof match.type }
        >
        return {
          ...typedPattern,
          match:
            typedMatch.match !== undefined
              ? this.rebuildParseTree(
                  typedMatch.match,
                  typedPattern.value,
                  context
                )
              : undefined,
        }
      }
    }
  }

  parseOne(pattern: ParserPattern, tokens: Token[]): Parse<string, Value> {
    const context: ParseContext<Token, Value> = {
      results: identifierCache(),
      matches: identifierCache(),
      values: identifierCache(),
      failures: identifierCache(),
      recMaps: identifierCache(),
      memo: {},
      leftRecCount: {},
      leftRecContext: [],
      leftRecContextOfResult: {},
      path: [],
      tokens,
      success: memoizeDirect(
        (a, b, c = context.recMaps.register(emptyObject)) =>
          context.results.register(success(a, b, c))
      ),
      failure: memoizeDirect(
        (a, b, c = context.recMaps.register(emptyObject)) =>
          context.results.register(failure(a, b, c))
      ),
      getResultType: memoizeDirect((id) => context.results.get(id).type),
    }

    const results = this.parse(pattern, tokens, context).map((resultIndex) =>
      context.results.get(resultIndex)
    )

    const successes = results.flatMap((result) =>
      result.type === 'success' ? [result] : []
    )

    const failures = results.flatMap((result) =>
      result.type === 'failure' ? [result] : []
    )

    if (successes.length > 0) {
      return this.rebuildParseTree(successes[0].value, pattern, context)
    }

    throw failures.map((failure) => ({
      tokens: tokens.slice(failure.tokenIndex, failure.tokenIndex + 3),
      reason: failureDescription(context.failures.get(failure.value), tokens),
    }))
  }

  private parse(
    pattern: ParserPattern,
    tokens: Token[],
    context: ParseContext<Token, Value>
  ): ParseResultIndex[] {
    let results: ParseResultIndex[]

    this.parseMemoized(pattern, 0, context, (x: ParseResultIndex[]) => {
      results = x
    })

    while (stack.length > 0) {
      let f = stack.pop()
      f()
    }

    return results!.map((resultIndex) => {
      const result = context.results.get(resultIndex)
      if (result.type === 'success' && result.tokenIndex < tokens.length) {
        return context.failure(
          context.failures.register(
            Failure.tokensRemaining(tokens.length - result.tokenIndex)
          ),
          result.tokenIndex
        )
      } else {
        return resultIndex
      }
    })
  }

  private parseMemoized(
    pattern: ParserPattern,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    // const label = 'label' in pattern ? pattern.label ?? '' : pattern.id
    // context.path.push(label)

    // console.log('START >', context.path)

    delay(() => {
      this.parseMemoizedInner(pattern, tokenIndex, context, next)
    })

    // console.log('END   >', context.path)

    // context.path.pop()
  }

  private parseMemoizedInner(
    pattern: ParserPattern,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    const label = 'label' in pattern ? pattern.label : pattern.id
    const key = `${tokenIndex}:${label}`

    if (
      key in context.memo &&
      context.memo[key].some(
        (resultIndex) => context.results.get(resultIndex).type === 'success'
      )
    ) {
      const contextOfResult = context.leftRecContextOfResult[key] || emptyObject
      const contextAtIndex = context.leftRecContext.find(
        ([index]) => index === tokenIndex
      )
      const currentContext: LeftRecMap = contextAtIndex
        ? contextAtIndex[1]
        : emptyObject

      if (
        isMoreConstrained(
          currentContext,
          contextOfResult,
          context.leftRecCount,
          this.verbose
        )
      ) {
        next(context.memo[key])
        return
      }
    }

    const leftRecCount = context.leftRecCount[key] ?? 0

    if (
      pattern.type !== 'thunk' &&
      pattern.type !== 'consume' &&
      leftRecCount > context.tokens.length - tokenIndex + 1
    ) {
      const found = context.leftRecContext.find(
        (item) => item[0] === tokenIndex
      )

      if (!found) {
        throw new Error('Implementation error')
      }

      const result: ParseResultIndex = context.failure(
        context.failures.register(Failure.inifiteRecursion),
        tokenIndex,
        context.recMaps.register(found[1])
      )

      next([result])
      return
    }

    context.leftRecCount[key] = leftRecCount + 1

    const childContext: ParseContext<Token, Value> = {
      ...context,
      leftRecContext: updateLeftRecContext(
        context.leftRecContext,
        tokenIndex,
        key,
        leftRecCount + 1
      ),
    }

    this.parsePattern(pattern, tokenIndex, childContext, (results) => {
      // console.log(results.length)
      // if (results.length > 1000) {
      //   debugger
      // }

      results.forEach((resultIndex) => {
        const result = context.results.get(resultIndex)

        if (
          result.type === 'failure' &&
          context.failures.get(result.value[0]).type ===
            FailureType.inifiteRecursion
        ) {
          context.leftRecContextOfResult[key] = context.recMaps.get(
            result.leftRecMap
          )
        }
      })

      const successes = results.filter(
        (resultIndex) => context.results.get(resultIndex).type === 'success'
      )

      context.memo[key] = [
        ...(context.memo[key] ? context.memo[key] : []),
        ...successes,
      ]

      next(results)
    })
  }

  private parseThunk(
    pattern: ThunkPattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    this.parseMemoized(pattern.value(), tokenIndex, context, (results) => {
      next(
        results.map((id) => {
          const result = context.results.get(id)
          return result.type === 'success'
            ? context.success(
                context.matches.register({
                  type: pattern.type,
                  match: result.value,
                }),
                result.tokenIndex,
                result.leftRecMap
              )
            : id
        })
      )
    })
  }

  private parseConsume(
    pattern: ConsumePattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    if (tokenIndex >= context.tokens.length) {
      next([
        context.failure(
          context.failures.register(Failure.tokensConsumed(pattern.value)),
          tokenIndex
        ),
      ])
    } else {
      const token = context.tokens[tokenIndex]

      if (token && this.matchToken(token, pattern.value)) {
        next([
          context.success(
            context.matches.register({
              type: 'consume',
              match: context.values.register(this.tokenToValue(token)),
            }),
            tokenIndex + 1
          ),
        ])
      } else {
        next([
          context.failure(
            context.failures.register(
              Failure.unexpectedToken(pattern.value, tokenIndex)
            ),
            tokenIndex
          ),
        ])
      }
    }
  }

  private parseSequence(
    pattern: SequencePattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    const inner = (
      remaining: ParseResultIndex[],
      remainingIndex: number,
      following: ParseResultIndex[],
      finished: ParseResultIndex[],
      matchIndex: number,
      next: Continuation<Token, Value>
    ): void => {
      if (matchIndex >= pattern.value.length) {
        next([...remaining, ...finished])
      } else if (remainingIndex >= remaining.length) {
        inner(following, 0, [], finished, matchIndex + 1, next)
      } else {
        const result = context.results.get(remaining[remainingIndex])
        const resultMatch = context.matches.get(result.value) as SequenceMatch<
          string
        >

        if (result.type === 'failure') {
          inner(
            remaining,
            remainingIndex + 1,
            following,
            [...finished, remaining[remainingIndex]],
            matchIndex,
            next
          )
        } else {
          this.parseMemoized(
            pattern.value[matchIndex],
            result.tokenIndex,
            context,
            (newResults) => {
              const newResultsMapped = newResults.map((newResultId) => {
                const newResult = context.results.get(newResultId)

                return newResult.type === 'success'
                  ? context.success(
                      context.matches.register({
                        type: pattern.type,
                        match: [...resultMatch.match, newResult.value],
                      }),
                      newResult.tokenIndex,
                      context.recMaps.register({
                        ...context.recMaps.get(result.leftRecMap),
                        ...context.recMaps.get(newResult.leftRecMap),
                      })
                    )
                  : newResultId
              })

              inner(
                remaining,
                remainingIndex + 1,
                [...following, ...newResultsMapped],
                finished,
                matchIndex,
                next
              )
            }
          )
        }
      }
    }

    const initial = context.success(
      context.matches.register({
        type: pattern.type,
        match: [],
      }),
      tokenIndex
    )

    inner([initial], 0, [], [], 0, next)
  }

  private parseOr(
    pattern: OrPattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    const inner = (
      acc: Set<string>,
      matchIndex: number,
      next: Continuation<Token, Value>
    ) => {
      if (matchIndex >= pattern.value.length) {
        next([...acc])
      } else {
        this.parseMemoized(
          pattern.value[matchIndex],
          tokenIndex,
          context,
          (results) => {
            const nested = (
              nestedAcc: Set<string>,
              newResultIndex: number,
              next: Continuation<Token, Value>
            ) => {
              if (newResultIndex >= results.length) {
                inner(nestedAcc, matchIndex + 1, next)
              } else {
                const newResultId = results[newResultIndex]
                const newResult = context.results.get(newResultId)

                if (newResult.type === 'failure') {
                  delay(() => {
                    nestedAcc.add(newResultId)

                    nested(nestedAcc, newResultIndex + 1, next)
                  })
                } else {
                  const successId = context.success(
                    context.matches.register({
                      type: pattern.type,
                      match: newResult.value,
                      matchIndex,
                    }),
                    newResult.tokenIndex,
                    newResult.leftRecMap
                  )

                  if (pattern.parallel) {
                    nestedAcc.add(successId)
                    nested(nestedAcc, newResultIndex + 1, next)
                  } else {
                    next([successId])
                  }
                }
              }
            }

            nested(acc, 0, next)
          }
        )
      }
    }

    inner(new Set(), 0, next)
  }

  private parseMany(
    pattern: ManyPattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    const initialResult = context.success(
      context.matches.register({
        type: pattern.type,
        matchSeparator: [],
        match: [],
      }),
      tokenIndex
    )

    let sepResultMap: Map<ParseResultIndex, ParseResultIndex> = new Map()

    const inner = (
      remainingIndex: number,
      remaining: ParseResultIndex[],
      following: ParseResultIndex[],
      finished: ParseResultIndex[],
      next: Continuation<Token, Value>
    ): void => {
      if (remainingIndex >= remaining.length) {
        // Begin following round
        if (following.length > 0) {
          inner(0, following, [], finished, next)
        } else {
          next(finished)
        }
      } else {
        const result = context.results.get(remaining[remainingIndex])
        const resultMatch = context.matches.get(result.value) as ManyMatch<
          string
        >

        const isSeparator =
          pattern.separator &&
          resultMatch.match.length > resultMatch.matchSeparator.length

        this.parseMemoized(
          isSeparator ? pattern.separator! : pattern.value,
          result.tokenIndex,
          context,
          (itemResults) => {
            const hasFailure = itemResults.some(
              (id) => context.getResultType(id) === 'failure'
            )

            const itemSuccesses = itemResults.filter(
              (id) => context.getResultType(id) === 'success'
            )

            const nextFollowing = itemSuccesses.map((itemResultId) => {
              const itemResult = context.results.get(itemResultId)

              return context.success(
                context.matches.register({
                  type: pattern.type,
                  matchSeparator: isSeparator
                    ? [...resultMatch.matchSeparator, itemResult.value]
                    : resultMatch.matchSeparator,
                  match: isSeparator
                    ? resultMatch.match
                    : [...resultMatch.match, itemResult.value],
                }),
                itemResult.tokenIndex,
                context.recMaps.register({
                  ...context.recMaps.get(result.leftRecMap),
                  ...context.recMaps.get(itemResult.leftRecMap),
                })
              )
            })

            if (isSeparator) {
              nextFollowing.forEach((id) => {
                sepResultMap.set(id, remaining[remainingIndex])
              })
            }

            // Imperative, for perf
            following.push(...nextFollowing)
            if (hasFailure) {
              finished.push(
                sepResultMap.get(remaining[remainingIndex]) ??
                  remaining[remainingIndex]
              )
            }

            inner(remainingIndex + 1, remaining, following, finished, next)
          }
        )
      }
    }

    inner(0, [initialResult], [], [], next)
  }

  private parseOption(
    pattern: OptionPattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    this.parseMemoized(pattern.value, tokenIndex, context, (results) => {
      next(
        results.map((id) => {
          const result = context.results.get(id)
          return result.type === 'success'
            ? context.success(
                context.matches.register({
                  type: pattern.type,
                  match: result.value,
                }),
                result.tokenIndex,
                result.leftRecMap
              )
            : context.success(
                context.matches.register({
                  type: pattern.type,
                  match: undefined,
                }),
                tokenIndex
              )
        })
      )
    })
  }

  private parseSingleChild(
    pattern:
      | PrintIndentPattern<string>
      | PrintGroupPattern<string>
      | PrintIfPattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    this.parseMemoized(pattern.value, tokenIndex, context, (results) => {
      next(
        results.map((id) => {
          const result = context.results.get(id)
          return result.type === 'success'
            ? context.success(
                context.matches.register({
                  type: pattern.type,
                  match: result.value,
                }),
                result.tokenIndex,
                result.leftRecMap
              )
            : id
        })
      )
    })
  }

  private parseSimple(
    pattern: PrintLiteralPattern<string> | PrintLinePattern<string>,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    return next([
      context.success(
        context.matches.register({ type: pattern.type }),
        tokenIndex
      ),
    ])
  }

  private parsePattern(
    pattern: ParserPattern,
    tokenIndex: TokenIndex,
    context: ParseContext<Token, Value>,
    next: Continuation<Token, Value>
  ): void {
    switch (pattern.type) {
      case 'consume':
        return this.parseConsume(pattern, tokenIndex, context, next)
      case 'thunk':
        return this.parseThunk(pattern, tokenIndex, context, next)
      case 'printIf':
      case 'printIndent':
      case 'printGroup':
        return this.parseSingleChild(pattern, tokenIndex, context, next)
      case 'printLine':
      case 'printLiteral':
        return this.parseSimple(pattern, tokenIndex, context, next)
      case 'sequence':
        return this.parseSequence(pattern, tokenIndex, context, next)
      case 'or':
        return this.parseOr(pattern, tokenIndex, context, next)
      case 'many':
        return this.parseMany(pattern, tokenIndex, context, next)
      case 'option':
        return this.parseOption(pattern, tokenIndex, context, next)
      // default:
      //   throw new Error(`Pattern ${pattern.type} not handled`)
    }
  }
}

function updateLeftRecContext(
  leftRecContext: LeftRecContext,
  tokenIndex: number,
  key: string,
  leftRecCount: number
): LeftRecContext {
  const item = leftRecContext.find(([index]) => index === tokenIndex)

  if (!item) {
    return [...leftRecContext, [tokenIndex, emptyObject]]
  } else {
    return leftRecContext.map((item) => {
      if (item[0] === tokenIndex) {
        return [item[0], { ...item[1], [key]: leftRecCount }]
      }
      return item
    })
  }
}

function isMoreConstrained(
  currentContext: LeftRecMap,
  contextOfResult: LeftRecMap,
  leftRecCount: Record<string, number>,
  verbose: boolean
): boolean {
  // For each recognizer in the left-rec context of the result
  for (let pair of Object.entries(contextOfResult)) {
    const [recognizer, count] = pair

    // Use the memoized result if the memoized left-rec-count is smaller than or equal to
    // the left-rec-count of that recognizer in the current context
    if (count <= (currentContext[recognizer] ?? Infinity)) {
      // if (verbose) {
      //   console.log(
      //     `For recognizer ${recognizer}, stored count: ${count}, current context count: ${leftRecCount[recognizer]}`
      //   )
      // }
    } else {
      // if (verbose) {
      //   console.log('FAIL OUT!', recognizer)
      // }

      return false
    }
  }

  return true
}
