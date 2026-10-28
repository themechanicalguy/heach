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
