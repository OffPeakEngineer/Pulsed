export type BridgeErrorCode =
  | 'adapter-conflict'
  | 'adapter-not-found'
  | 'invalid-config'
  | 'invalid-response'
  | 'request-failed'

export class BridgeError extends Error {
  readonly code: BridgeErrorCode
  readonly details: Readonly<Record<string, string | number | boolean>>

  constructor(
    code: BridgeErrorCode,
    message: string,
    details: Readonly<Record<string, string | number | boolean>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'BridgeError'
    this.code = code
    this.details = details
  }
}
