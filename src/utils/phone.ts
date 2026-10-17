/**
 * Normalizes an Indian phone number to strict E.164 format (+91XXXXXXXXXX).
 * Validates that the number has exactly 10 digits and starts with 6, 7, 8, or 9.
 */
export function normalizeIndianPhoneNumber(input: string): {
  isValid: boolean;
  e164: string;
  masked: string;
  error?: string;
} {
  if (!input || typeof input !== 'string') {
    return { isValid: false, e164: '', masked: '', error: 'Phone number is required.' };
  }

  // Remove all non-numeric characters
  const digits = input.replace(/\D/g, '');

  let tenDigits = '';
  if (digits.length === 10) {
    tenDigits = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else {
    return {
      isValid: false,
      e164: '',
      masked: '',
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  // Indian mobile numbers must start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    return {
      isValid: false,
      e164: '',
      masked: '',
      error: 'Mobile number must start with 6, 7, 8, or 9.',
    };
  }

  const e164 = `+91${tenDigits}`;
  const masked = `+91******${tenDigits.slice(-4)}`;

  return {
    isValid: true,
    e164,
    masked,
  };
}
