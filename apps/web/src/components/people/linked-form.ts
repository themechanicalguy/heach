import type { LinkedPatientInput } from '@heach/types';

export const RELATIONSHIPS = [
  'parent',
  'child',
  'spouse',
  'sibling',
  'grandparent',
  'grandchild',
  'other_relative',
  'other',
] as const;

export interface LinkedForm {
  fullName: string;
  birthYear: string;
  gender: string;
  relationship: string;
}

export type LinkedError = 'fullName' | 'birthYear' | 'gender' | 'relationship';

const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,99}$/u;

export const EMPTY_LINKED: LinkedForm = {
  fullName: '',
  birthYear: '',
  gender: '',
  relationship: '',
};

export function linkedFrom(person: LinkedPatientInput): LinkedForm {
  return { ...person, birthYear: String(person.birthYear) };
}

/** The same rules as the API (AC-03), checked before sending (A11Y-04). */
export function linkedErrors(form: LinkedForm, thisYear: number): LinkedError[] {
  const errors: LinkedError[] = [];
  if (!NAME.test(form.fullName.trim())) errors.push('fullName');
  const year = Number(form.birthYear);
  if (!/^\d{4}$/.test(form.birthYear) || year < 1900 || year > thisYear) errors.push('birthYear');
  if (!form.gender) errors.push('gender');
  if (!form.relationship) errors.push('relationship');
  return errors;
}

export function linkedBody(form: LinkedForm): LinkedPatientInput {
  return {
    fullName: form.fullName.trim(),
    birthYear: Number(form.birthYear),
    gender: form.gender as LinkedPatientInput['gender'],
    relationship: form.relationship as LinkedPatientInput['relationship'],
  };
}
