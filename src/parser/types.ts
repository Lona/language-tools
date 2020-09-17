/* -------- Patterns -------- */

export type Identifiable = { id: string }

export type Extractable = { as?: string; label?: string }

export interface ConsumePattern<T> extends Identifiable, Extractable {
  type: 'consume'
  value: T
}

export interface SequencePattern<T> extends Identifiable, Extractable {
  type: 'sequence'
  value: Pattern<T>[]
  select?: string
}

export interface OrPattern<T> extends Identifiable, Extractable {
  type: 'or'
  value: Pattern<T>[]
  typeNames?: string[]
  parallel: boolean
}

export interface ManyPattern<T> extends Identifiable, Extractable {
  type: 'many'
  value: Pattern<T>
  separator?: Pattern<T>
}

export interface OptionPattern<T> extends Identifiable, Extractable {
  type: 'option'
  value: Pattern<T>
  select?: string
  defaultValue?: unknown
}

export interface PrintLiteralPattern<T> extends Identifiable {
  type: 'printLiteral'
  value: string
}

export type LineKind = 'soft' | 'hard'

export interface PrintLinePattern<T> extends Identifiable {
  type: 'printLine'
  kind?: 'soft' | 'hard'
}

export type TerminalPattern<T> = PrintLiteralPattern<T> | PrintLinePattern<T>

export interface PrintIndentPattern<T> extends Identifiable {
  type: 'printIndent'
  value: Pattern<T>
}

export interface PrintGroupPattern<T> extends Identifiable {
  type: 'printGroup'
  value: Pattern<T>
}

export interface PrintIfPattern<T> extends Identifiable {
  type: 'printIf'
  value: Pattern<T>
  reference: string
  before?: PrintLiteralPattern<T> | PrintLinePattern<T>
  after?: PrintLiteralPattern<T> | PrintLinePattern<T>
}

export interface ThunkPattern<T> extends Identifiable, Extractable {
  type: 'thunk'
  value: () => Pattern<T>
}

export type Pattern<T> =
  | ConsumePattern<T>
  | SequencePattern<T>
  | OrPattern<T>
  | ManyPattern<T>
  | OptionPattern<T>
  | ThunkPattern<T>
  // Printing
  | PrintLiteralPattern<T>
  | PrintLinePattern<T>
  | PrintIndentPattern<T>
  | PrintGroupPattern<T>
  | PrintIfPattern<T>

/* -------- Matches -------- */

export type ConsumeMatch<T> = {
  type: ConsumePattern<T>['type']
  match: string
}

export type SequenceMatch<T> = {
  type: SequencePattern<T>['type']
  match: string[]
}

export type OrMatch<T> = {
  type: OrPattern<T>['type']
  matchIndex: number
  match: string
}

export type ManyMatch<T> = {
  type: ManyPattern<T>['type']
  match: string[]
  matchSeparator: string[]
}

export type OptionMatch<T> = {
  type: OptionPattern<T>['type']
  match?: string
}

export type PrintLiteralMatch<T> = {
  type: PrintLiteralPattern<T>['type']
}

export type PrintLineMatch<T> = {
  type: PrintLinePattern<T>['type']
}

export type PrintIndentMatch<T> = {
  type: PrintIndentPattern<T>['type']
  match: string
}

export type PrintGroupMatch<T> = {
  type: PrintGroupPattern<T>['type']
  match: string
}

export type PrintIfMatch<T> = {
  type: PrintIfPattern<T>['type']
  match: string
}

export type ThunkMatch<T> = {
  type: ThunkPattern<T>['type']
  match: string
}

export type Match<T> =
  | ConsumeMatch<T>
  | SequenceMatch<T>
  | OrMatch<T>
  | ManyMatch<T>
  | OptionMatch<T>
  | ThunkMatch<T>
  // Printing
  | PrintLiteralMatch<T>
  | PrintLineMatch<T>
  | PrintIndentMatch<T>
  | PrintGroupMatch<T>
  | PrintIfMatch<T>

/* -------- Matches -------- */

export interface ConsumeParse<T, M> extends ConsumePattern<T> {
  match: M
}

export interface SequenceParse<T, M> extends SequencePattern<T> {
  match: Parse<T, M>[]
}

export interface OrParse<T, M> extends OrPattern<T> {
  matchIndex: number
  match: Parse<T, M>
}

export interface ManyParse<T, M> extends ManyPattern<T> {
  match: Parse<T, M>[]
  matchSeparator: Parse<T, M>[]
}

export interface OptionParse<T, M> extends OptionPattern<T> {
  match?: Parse<T, M>
}

export interface PrintLiteralParse<T, M> extends PrintLiteralPattern<T> {}

export interface PrintLineParse<T, M> extends PrintLinePattern<T> {}

export interface PrintIndentParse<T, M> extends PrintIndentPattern<T> {
  match: Parse<T, M>
}

export interface PrintGroupParse<T, M> extends PrintGroupPattern<T> {
  match: Parse<T, M>
}

export interface PrintIfParse<T, M> extends PrintIfPattern<T> {
  match: Parse<T, M>
}

export interface ThunkParse<T, M> extends ThunkPattern<T> {
  match: Parse<T, M>
}

export type Parse<T, M> =
  | ConsumeParse<T, M>
  | SequenceParse<T, M>
  | OrParse<T, M>
  | ManyParse<T, M>
  | OptionParse<T, M>
  | ThunkParse<T, M>
  // Printing
  | PrintLiteralParse<T, M>
  | PrintLineParse<T, M>
  | PrintIndentParse<T, M>
  | PrintGroupParse<T, M>
  | PrintIfParse<T, M>
