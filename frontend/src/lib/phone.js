/* The mobile number, checked the way the backend checks it (hash f3a287c6 `utils/phone.js`): spaces,
   dashes, dots and brackets dropped, then an optional + and 10 to 15 digits. The cleaned form is sent. */
export const cleanPhone = (value) => String(value ?? "").trim().replace(/[\s\-().]/g, "");
export const isValidPhone = (value) => /^\+?\d{10,15}$/.test(cleanPhone(value));
