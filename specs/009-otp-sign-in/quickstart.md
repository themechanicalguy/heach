# Quickstart: OTP sign-up and sign-in

For a developer once the code exists. Synthetic numbers only (`98765 4xxxx`).

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH   # this machine's Node 24
pnpm dev:up                                       # FEATURE_FLAGS includes otp-sign-in locally
open http://localhost:3000/or                     # language choice, then /or/sign-in
# The SMS fake keeps the last code per number; read it as the E2E tests do:
curl -s -X POST -H 'content-type: application/json' \
  -d '{"mobile":"9876543210"}' http://localhost:4000/api/v1/test/sms-outbox
pnpm --filter @heach/api test:int -- otp-sign-in reverify me authz-matrix
pnpm --filter @heach/web test:e2e -- sign-in
pnpm check
```

On dev, the outbox answers only through the loopback entry (SE-07.23), as test sign-in did.
