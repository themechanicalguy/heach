import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController, REFRESH_COOKIE } from './auth.controller.js';
import type { SessionService } from './session.service.js';

function refreshWith(failure: Error) {
  const sessions = { refresh: vi.fn().mockRejectedValue(failure) };
  const controller = new AuthController(sessions as unknown as SessionService);
  const response = { clearCookie: vi.fn(), cookie: vi.fn(), setHeader: vi.fn() };
  const request = { header: () => `${REFRESH_COOKIE}=token` };
  const call = controller.refresh(request as unknown as Request, response as unknown as Response);
  return { call, response };
}

describe('AuthController.refresh', () => {
  it('SE-07.16 clears the refresh cookie on 401', async () => {
    const { call, response } = refreshWith(new UnauthorizedException());
    await expect(call).rejects.toBeInstanceOf(UnauthorizedException);
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, { path: '/api/v1/auth' });
  });

  it('SE-07.16 keeps the refresh cookie on any other failure', async () => {
    const { call, response } = refreshWith(new Error('database unavailable'));
    await expect(call).rejects.toThrow('database unavailable');
    expect(response.clearCookie).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
