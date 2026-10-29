import type { Request, Response } from 'express';
import { deviceId } from '../auth/session-cookie.js';
import type { OtpOrigin } from './otp.service.js';

/** The client address, used only for throttling (SE-08). */
export function clientAddress(request: Request): string {
  return request.ip ?? 'unknown';
}

/** Device cookie and address of an OTP request (SE-08). */
export function otpOrigin(request: Request, response: Response): OtpOrigin {
  return { deviceId: deviceId(request, response), address: clientAddress(request) };
}
