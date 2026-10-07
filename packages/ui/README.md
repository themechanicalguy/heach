# @heach/ui

Shared React components for the web and admin apps (UX-01).

```tsx
import { Button } from '@heach/ui';
import '@heach/ui/ui.css';

<Button onClick={save}>{t('form.save')}</Button>;
```

Now: `Button`, a native `<button>` that defaults to `type="button"`, with a 48 px minimum target
(A11Y-03) and a visible focus ring. Labels always come from messages, never hard-coded.

Step 2 replaces `ui.css` with design tokens and Tailwind, adds the base components (input, OTP
field, card, sheet, table, toast), Storybook and axe checks (UX-01 to UX-05, A11Y-07).
Extend these components rather than writing new ones in an app.
