import { isLocale, type Locale } from '@heach/i18n';
import { isService, type Service } from '../components/care/services';

/** Public only after an owner confirms the source, consent and absence of health details. */
export interface SiteMetrics {
  providers: number;
  visits: number;
  cities: number;
  asOf: string;
}
export interface SiteReview {
  firstName: string;
  service: Service;
  text: string;
  locale: Locale;
}
export interface SiteEvidence {
  metrics?: SiteMetrics;
  reviews?: SiteReview[];
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parse(value: string | undefined): unknown {
  try {
    return value ? (JSON.parse(value) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

/** No sample values and no unapproved content can become a public business claim. */
export function approvedEvidence(
  metricsJson: string | undefined,
  reviewsJson: string | undefined,
): SiteEvidence {
  const result: SiteEvidence = {};
  const metrics = parse(metricsJson);
  if (
    object(metrics) &&
    metrics.approved === true &&
    metrics.source === 'live' &&
    validMetrics(metrics)
  ) {
    result.metrics = {
      providers: metrics.providers,
      visits: metrics.visits,
      cities: metrics.cities,
      asOf: metrics.asOf,
    };
  }
  const reviews = parse(reviewsJson);
  if (
    object(reviews) &&
    reviews.approved === true &&
    reviews.consentConfirmed === true &&
    reviews.healthDetailsRemoved === true &&
    Array.isArray(reviews.items) &&
    reviews.items.length >= 3 &&
    reviews.items.length <= 4 &&
    reviews.items.every(validReview)
  ) {
    result.reviews = reviews.items.map(({ firstName, service, text, locale }) => ({
      firstName,
      service,
      text,
      locale,
    }));
  }
  return result;
}

function validMetrics(value: ObjectValue): value is ObjectValue & SiteMetrics {
  if (
    !['providers', 'visits', 'cities'].every(
      (key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0,
    )
  )
    return false;
  if (typeof value.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.asOf)) return false;
  const time = Date.parse(value.asOf);
  return (
    Number.isFinite(time) &&
    time <= Date.now() &&
    new Date(time).toISOString().slice(0, 10) === value.asOf
  );
}
function validReview(value: unknown): value is SiteReview {
  return (
    object(value) &&
    typeof value.firstName === 'string' &&
    /^[\p{L}\p{M}][\p{L}\p{M}-]{0,59}$/u.test(value.firstName) &&
    typeof value.service === 'string' &&
    isService(value.service) &&
    typeof value.text === 'string' &&
    value.text.length > 0 &&
    value.text.length <= 500 &&
    typeof value.locale === 'string' &&
    isLocale(value.locale)
  );
}
