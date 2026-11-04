import { Icon } from '@heach/ui';

/**
 * Emergency guidance with a dark Call 108 button on a peach card (design reference, desktop home).
 * One look on every screen; a row on wide containers, stacked with a full-width call button in
 * narrow ones such as the home side column. Never dismissible: HEACH does not provide emergency care.
 */
export function EmergencyCard({
  title,
  body,
  call,
}: Readonly<{ title?: string; body: string; call: string }>) {
  return (
    <section className="emergency" aria-label={title ?? call}>
      <div className="emergency__card">
        <span className="emergency__icon">
          <Icon name="phone" size={22} />
        </span>
        <div className="emergency__text">
          {title && <h2 className="emergency__title">{title}</h2>}
          <p>{body}</p>
        </div>
        <a className="heach-button heach-button--emergency emergency__call" href="tel:108">
          {call}
        </a>
      </div>
    </section>
  );
}
