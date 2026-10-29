import type { SetupDraft } from '@heach/types';
import type { Gender } from './roles';
import { isProviderChoice } from './roles';

export interface DetailsForm {
  fullName: string;
  gender: Gender | '';
  languages: string[];
  organisationName: string;
  adultDeclared: boolean;
}

export type DetailsError = 'fullName' | 'gender' | 'languages' | 'organisation' | 'adult';

// Letters and marks of any script (Odia, Devanagari, Latin), spaces, dot, apostrophe, hyphen.
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,99}$/u;

export function detailsFrom(draft: SetupDraft): DetailsForm {
  return {
    fullName: draft.fullName ?? '',
    gender: draft.gender ?? '',
    languages: [...draft.languages],
    organisationName: draft.organisationName ?? '',
    adultDeclared: draft.adultDeclared,
  };
}

/** The same rules as the API (setup-rules.ts), checked before sending (A11Y-04 error summary). */
export function detailsErrors(form: DetailsForm, role: string | null): DetailsError[] {
  const errors: DetailsError[] = [];
  if (!NAME.test(form.fullName.trim())) errors.push('fullName');
  if (!form.gender) errors.push('gender');
  if (isProviderChoice(role) && form.languages.length === 0) errors.push('languages');
  if (role === 'lab' && form.organisationName.trim() === '') errors.push('organisation');
  if (!form.adultDeclared) errors.push('adult');
  return errors;
}

/** Only the fields that pass, so "save and continue later" never sends something invalid. */
export function validPart(form: DetailsForm, role: string | null): Record<string, unknown> {
  const errors = detailsErrors(form, role);
  const part: Record<string, unknown> = { languages: form.languages };
  if (!errors.includes('fullName')) part.fullName = form.fullName.trim();
  if (form.gender) part.gender = form.gender;
  if (form.organisationName.trim()) part.organisationName = form.organisationName.trim();
  part.adultDeclared = form.adultDeclared;
  return part;
}

/** What a correction after setup sends (AC-06): only the fields the account's role uses. */
export function correctionFrom(form: DetailsForm, role: string | null): Record<string, unknown> {
  return {
    fullName: form.fullName.trim(),
    gender: form.gender,
    ...(isProviderChoice(role) ? { languages: form.languages } : {}),
    ...(role === 'lab' ? { organisationName: form.organisationName.trim() } : {}),
  };
}
