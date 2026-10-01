/**
 * Normalizes phone numbers to standard E.164 string format.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned.startsWith('+')) {
    // Standard 10-digit Indian phone number default to +91
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = `+91${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }

  return cleaned;
}
