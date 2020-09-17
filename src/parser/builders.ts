import {
  ConsumePattern,
  SequencePattern,
  OrPattern,
  ManyPattern,
  OptionPattern,
  Pattern,
  PrintLiteralPattern,
  PrintLinePattern,
  PrintIndentPattern,
  PrintGroupPattern,
  ThunkPattern,
  PrintIfPattern,
  TerminalPattern,
  LineKind,
} from './types'
import { ParserPattern } from './Parser'

let initialId = 0

// Exported for testing
export function resetId() {
  initialId = 0
}

function id(): string {
  return String(initialId++)
}

type LabelOptions = { as?: string; label?: string }

type PatternShorthand<T> =
  | Pattern<T>
  | PatternShorthand<T>[]
  | (() => Pattern<T>)

function normalizePattern<T>(pattern: PatternShorthand<T>): Pattern<T> {
  if (typeof pattern === 'function') {
    return thunk(pattern)
  } else if (pattern instanceof Array) {
    return sequence(pattern)
  }

  return pattern
}

export function consume<T>(
  value: T,
  options: LabelOptions | string = {}
): ConsumePattern<T> {
  const normalizedOptions =
    typeof options === 'string' ? { as: options } : options
  return { id: id(), type: 'consume', value, ...normalizedOptions }
}

export function sequence<T>(
  value: PatternShorthand<T>[],
  options?: { select?: string } & LabelOptions
): SequencePattern<T> {
  return {
    id: id(),
    type: 'sequence',
    value: value.map(normalizePattern),
    ...options,
  }
}

export function or<T>(
  value: PatternShorthand<T>[],
  options: LabelOptions & { typeNames?: string[]; parallel?: boolean } = {}
): OrPattern<T> {
  if (options.typeNames && value.length !== options.typeNames.length) {
    throw new Error('typeNames length must match number of patterns')
  }

  return {
    id: id(),
    type: 'or',
    value: value.map(normalizePattern),
    parallel: options.parallel ?? false,
    ...options,
  }
}

export function typedOr<T>(
  value: [string, PatternShorthand<T>][],
  options: LabelOptions & { parallel?: boolean } = {}
): OrPattern<T> {
  return {
    id: id(),
    type: 'or',
    value: value.map(([_, pattern]) => normalizePattern(pattern)),
    typeNames: value.map(([name]) => name),
    parallel: options.parallel ?? false,
    ...options,
  }
}

export function many<T>(
  value: PatternShorthand<T>,
  options: { separator?: PatternShorthand<T> } & LabelOptions = {}
): ManyPattern<T> {
  const { separator, ...rest } = options

  return {
    id: id(),
    type: 'many',
    value: normalizePattern(value),
    ...(separator && { separator: normalizePattern(separator) }),
    ...rest,
  }
}

export function option<T>(
  value: PatternShorthand<T>,
  options:
    | ({ select?: string; defaultValue?: unknown } & LabelOptions)
    | string = {}
): OptionPattern<T> {
  const normalizedOptions =
    typeof options === 'string' ? { as: options } : options
  return {
    id: id(),
    type: 'option',
    value: normalizePattern(value),
    ...normalizedOptions,
  }
}

export function thunk<T>(
  value: () => Pattern<T>,
  options: LabelOptions | string = {}
): ThunkPattern<T> {
  const normalizedOptions =
    typeof options === 'string' ? { as: options } : options
  return { id: id(), type: 'thunk', value, ...normalizedOptions }
}

// Printing

export function printLiteral<T>(value: string): PrintLiteralPattern<T> {
  return { id: id(), type: 'printLiteral', value }
}

export function printLine<T>(kind?: 'soft' | 'hard'): PrintLinePattern<T> {
  return { id: id(), type: 'printLine', ...(kind && { kind }) }
}

export function printIndent<T>(
  value: PatternShorthand<T>
): PrintIndentPattern<T> {
  return { id: id(), type: 'printIndent', value: normalizePattern(value) }
}

export function printGroup<T>(
  value: PatternShorthand<T>
): PrintGroupPattern<T> {
  return { id: id(), type: 'printGroup', value: normalizePattern(value) }
}

export function printIf<T>(
  value: PatternShorthand<T>,
  {
    before,
    after,
    reference,
  }: {
    reference: string
    before?: TerminalPattern<T>
    after?: TerminalPattern<T>
  }
): PrintIfPattern<T> {
  return {
    id: id(),
    type: 'printIf',
    value: normalizePattern(value),
    reference,
    ...(before && { before }),
    ...(after && { after }),
  }
}

export function printIndentedMany<T>(
  value: ManyPattern<T>,
  { padding }: { padding?: LineKind } = {}
) {
  if (!value.as) {
    throw new Error(`The 'printIndentedMany' helper requires an 'as' label`)
  }

  return printGroup(
    printIf(
      printIndent(
        printIf(value, { reference: value.as, before: printLine(padding) })
      ),
      { reference: value.as, after: printLine(padding) }
    )
  )
}

export function language(patterns: {
  [key: string]: PatternShorthand<string>
}): { [key: string]: ParserPattern } {
  return Object.fromEntries(
    Object.entries(patterns).map(([key, pattern]) => [
      key,
      normalizePattern(pattern),
    ])
  )
}
