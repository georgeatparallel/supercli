export interface SdkErrorOptions {
  code?: string
  cause?: unknown
}

export class SdkError extends Error {
  readonly code: string
  readonly cause?: unknown

  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message)
    this.name = new.target.name
    this.code = options.code ?? "SDK_ERROR"
    this.cause = options.cause
  }
}

export class ConnectionError extends SdkError {
  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message, { code: options.code ?? "CONNECTION_ERROR", cause: options.cause })
  }
}

export class AuthError extends SdkError {
  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message, { code: options.code ?? "AUTH_ERROR", cause: options.cause })
  }
}

export class ModelUnavailableError extends SdkError {
  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message, { code: options.code ?? "MODEL_UNAVAILABLE", cause: options.cause })
  }
}

export class ToolPackError extends SdkError {
  constructor(message: string, options: SdkErrorOptions = {}) {
    super(message, { code: options.code ?? "TOOL_PACK_ERROR", cause: options.cause })
  }
}
