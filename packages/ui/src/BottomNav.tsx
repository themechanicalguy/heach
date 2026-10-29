import type { ReactNode } from 'react';

export interface BottomNavItem {
  href: string;
  label: string;
  icon?: ReactNode | undefined;
  current?: boolean | undefined;
}

export interface BottomNavProps {
  label: string;
  items: readonly BottomNavItem[];
}

/**
 * Primary navigation fixed to the bottom edge on phones, in the thumb zone (UX-03); from the
 * tablet breakpoint it sits inline where it is placed, which is the page header.
 */
export function BottomNav({ label, items }: Readonly<BottomNavProps>) {
  return (
    <nav className="heach-bottom-nav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} aria-current={item.current ? 'page' : undefined}>
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
