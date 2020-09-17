export type Result<V, E> =
  | {
      type: 'success'
      value: V
    }
  | { type: 'failure'; value: E }
