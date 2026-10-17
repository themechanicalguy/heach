import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: string | undefined;
  children: ReactNode;
}

/** A content block; with a title it is a labelled section. */
export function Card({ title, children, className, ...rest }: Readonly<CardProps>) {
  return (
    <section className={className ? `heach-card ${className}` : 'heach-card'} {...rest}>
      {title && <h2 className="heach-card__title">{title}</h2>}
      {children}
    </section>
  );
}
