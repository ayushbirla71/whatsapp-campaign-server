const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

/**
 * Phone number utility functions
 * Centralized phone number formatting and validation
 */

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber - Phone number to format
 * @param {string} defaultCountry - Default country code (default: 'US')
 * @returns {string|null} Formatted phone number or null if invalid
 */
function formatPhoneNumber(phoneNumber, defaultCountry = 'US') {
  try {
    if (!phoneNumber) return null;

    // Remove any non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    if (isValidPhoneNumber(cleaned, defaultCountry)) {
      const parsed = parsePhoneNumber(cleaned, defaultCountry);
      return parsed.format('E.164');
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract country code from phone number
 * @param {string} phoneNumber - Phone number in E.164 format
 * @returns {string|null} Country calling code or null
 */
function extractCountryCode(phoneNumber) {
  try {
    if (!phoneNumber || !phoneNumber.startsWith('+')) return null;

    const parsed = parsePhoneNumber(phoneNumber);
    return parsed.countryCallingCode;
  } catch (error) {
    return null;
  }
}

/**
 * Validate phone number
 * @param {string} phoneNumber - Phone number to validate
 * @param {string} defaultCountry - Default country code
 * @returns {boolean} True if valid, false otherwise
 */
function isValidPhone(phoneNumber, defaultCountry = 'US') {
  try {
    if (!phoneNumber) return false;
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    return isValidPhoneNumber(cleaned, defaultCountry);
  } catch (error) {
    return false;
  }
}

module.exports = {
  formatPhoneNumber,
  extractCountryCode,
  isValidPhone
};

