import { hashToken } from '../src/auth/token-hash.js';
import { purgeExpired } from '../src/jobs/purge-expired.js';
import { otpSignIn, requestCode, syntheticMobile, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';

describe('Purge of expired security records (default D-5)', () => {
  const { app, db, server } = useApp();

  it('D-5 deletes OTP challenges and sessions past their window and keeps live ones', async () => {
    const stale = syntheticMobile();
    const fresh = syntheticMobile();
    const staleChallenge = (await requestCode(app(), stale).expect(200)).body as {
      challengeId: string;
    };
    const freshChallenge = (await requestCode(app(), fresh).expect(200)).body as {
      challengeId: string;
    };
    const ended = await otpSignIn(app());
    await server()
      .post('/v1/auth/logout')
      .set(bearer(ended.login))
      .send({ allDevices: false })
      .expect(204);
    const live = await otpSignIn(app());
    await db().query(
      `UPDATE app.otp_challenge SET expires_at = now() - interval '25 hours' WHERE id = $1`,
      [staleChallenge.challengeId],
    );
    const endedHash = hashToken(ended.login.cookie.split('=')[1] ?? '');
    await db().query(
      `UPDATE app.session SET revoked_at = now() - interval '31 days'
        WHERE family_id = (SELECT family_id FROM app.session WHERE refresh_token_hash = $1)`,
      [endedHash],
    );

    const counts = await purgeExpired(db());
    expect(counts.otpChallenges).toBeGreaterThanOrEqual(1);
    expect(counts.sessions).toBeGreaterThanOrEqual(1);

    const { rows: challenges } = await db().query<{ id: string }>(
      'SELECT id FROM app.otp_challenge WHERE id = ANY($1)',
      [[staleChallenge.challengeId, freshChallenge.challengeId]],
    );
    expect(challenges.map((row) => row.id)).toEqual([freshChallenge.challengeId]);
    const { rows: sessions } = await db().query(
      'SELECT 1 FROM app.session WHERE refresh_token_hash = $1',
      [endedHash],
    );
    expect(sessions).toEqual([]);
    await server().get('/v1/me').set(bearer(live.login)).expect(200);
    await server().post('/v1/auth/refresh').set('Cookie', live.login.cookie).expect(200);
  });

  it('D-5 a second run finds nothing more to do (idempotent)', async () => {
    await purgeExpired(db());
    expect(await purgeExpired(db())).toEqual({
      otpChallenges: 0,
      sessions: 0,
      adminSessions: 0,
      invitationsExpired: 0,
      memberships: 0,
    });
  });
});
