export interface Option {
  value: string;
  label: string;
}

export const BUSINESS_TYPES: readonly Option[] = [
  { value: 'SOLE_PROPRIETOR', label: 'Sole proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'PRIVATE_LIMITED', label: 'Private limited company' },
  { value: 'PUBLIC_LIMITED', label: 'Public limited company' },
];

export const CATEGORIES: readonly Option[] = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'FOOD_BEVERAGE', label: 'Food & beverage' },
  { value: 'TRAVEL', label: 'Travel & hospitality' },
  { value: 'SERVICES', label: 'Professional services' },
  { value: 'DIGITAL_GOODS', label: 'Digital goods' },
];

/** Postal code format per supported country (used by a cross-field validator). */
export const COUNTRIES: readonly (Option & { postalCode: RegExp; postalHint: string })[] = [
  { value: 'NP', label: 'Nepal', postalCode: /^\d{5}$/, postalHint: '5 digits, e.g. 44600' },
  { value: 'IN', label: 'India', postalCode: /^\d{6}$/, postalHint: '6 digits, e.g. 110001' },
  {
    value: 'GB',
    label: 'United Kingdom',
    postalCode: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
    postalHint: 'e.g. SW1A 1AA',
  },
  { value: 'US', label: 'United States', postalCode: /^\d{5}(-\d{4})?$/, postalHint: 'e.g. 94105' },
];

export const labelOf = (options: readonly Option[], value: string): string =>
  options.find((o) => o.value === value)?.label ?? value;
