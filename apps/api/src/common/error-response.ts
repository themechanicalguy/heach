/** The one error shape every API error uses. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  /** Stable machine-readable reason the client maps to a translated message; never personal data. */
  code?: string;
  path: string;
  timestamp: string;
}

/** An HTTP error carrying a stable reason code the client translates; never personal data. */
export function reason(Exception: new (body: object) => Error, code: string): Error {
  return new Exception({ error: Exception.name.replace('Exception', ''), message: code, code });
}
