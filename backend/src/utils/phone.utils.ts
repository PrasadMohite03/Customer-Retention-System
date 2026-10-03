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

/**
 * Masks phone number for staff/operational display.
 * e.g., +919876543210 -> +91 ••••• ••3210
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = normalizePhone(phone);
  if (cleaned.length <= 4) return cleaned;
  const lastFour = cleaned.slice(-4);
  const prefix = cleaned.startsWith('+') ? cleaned.slice(0, 3) : '';
  return `${prefix} ••••• ••${lastFour}`;
}
