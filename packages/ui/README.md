# @heach/ui

Shared React components and design tokens for the web and admin apps (UX-01, UX-02).

```tsx
import { Button, Notice } from '@heach/ui';
import '@heach/ui/ui.css';

<Button onClick={save}>{t('form.save')}</Button>;
```

- **Tokens:** `tokens.ts` (colours, breakpoints, radii, 48 px touch target); `ui.css` mirrors them
  as `--heach-*` custom properties, and a test keeps the two in step.
- **Components:** `Button`, `TextField`, `OtpField`, `CheckboxField`, `ChoiceGroup`, `Card`,
  `Sheet`, `Table`, `Toast`, `Notice`, `Progress`, `BottomNav`, `Icon` (decorative line icons;
  `ICON_NAMES` lists them).
- **States:** `EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton`.

Every component has Storybook stories and axe checks (A11Y-07). Labels always come from messages,
never hard-coded. Extend these components rather than writing new ones in an app.
