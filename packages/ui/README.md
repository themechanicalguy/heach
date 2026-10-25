# @heach/ui

Shared React components for the web and admin apps (UX-01).

```tsx
import { Button } from '@heach/ui';
import '@heach/ui/ui.css';

<Button onClick={save}>{t('form.save')}</Button>;
```

Components: `Button`, `TextField`, `OtpField`, `Card`, `Sheet`, `Table`, `Toast`, `BottomNav` and the
states `EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton`. Design tokens are in `src/tokens.ts`;
`ui.css` mirrors them as CSS variables. Each component has a story and an axe test (UX-01, TS-02).
Touch targets are at least 48 px (A11Y-03). Labels always come from messages, never hard-coded.
Extend these components rather than writing new ones in an app.
