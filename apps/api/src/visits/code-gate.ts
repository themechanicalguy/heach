import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { reason } from '../common/error-response.js';
import { VisitCodes } from './visit-codes.js';
import { VisitsRepository } from './visits.repository.js';

/** Wrong codes before a booking's codes lock (HS-03, HS-05, LB-06). */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * Checks a patient's six-digit code for a visit, shift or sample collection. An attempt is taken
 * before the code is compared and given back only when it is right, so five wrong codes lock
 * the booking's codes however many requests arrive at once.
 */
@Injectable()
export class CodeGate {
  constructor(
    private readonly codes: VisitCodes,
    private readonly visits: VisitsRepository,
  ) {}

  async check(bookingId: string, moment: string, code: string): Promise<void> {
    if (!(await this.visits.takeCodeAttempt(bookingId, MAX_CODE_ATTEMPTS)))
      throw reason(ForbiddenException, 'code_locked');
    if (!this.codes.matches(bookingId, moment, code))
      throw reason(BadRequestException, 'code_incorrect');
    await this.visits.returnCodeAttempt(bookingId);
  }
}
