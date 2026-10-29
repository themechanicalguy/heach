import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

/** Synthetic accounts seeded by migration 0002 and carried over by 0003 (test sign-in only). */
export const USERS = {
  patientA: '00000000-0000-4000-8000-000000000001',
  patientB: '00000000-0000-4000-8000-000000000002',
  provider: '00000000-0000-4000-8000-000000000003',
} as const;

export interface Login {
  token: string;
  cookie: string;
  setCookie: string;
}

export async function login(app: INestApplication<App>, userId: string): Promise<Login> {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/test-login')
    .send({ userId })
    .expect(200);
  return fromResponse(response);
}

export function fromResponse(response: request.Response): Login {
  const setCookie = ([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '';
  return {
    token: (response.body as { accessToken: string }).accessToken,
    cookie: setCookie.split(';')[0] ?? '',
    setCookie,
  };
}

export const bearer = (login: Login) => ({ Authorization: `Bearer ${login.token}` });
