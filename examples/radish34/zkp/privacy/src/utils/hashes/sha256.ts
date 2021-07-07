import crypto from 'crypto';
import { strip0x } from '../conversions';

/**
 * Utility function:
 *
 * hashes a concatenation of items but it does it by
 * breaking the items up into 432 bit chunks, hashing those, plus any remainder
 * and then repeating the process until you end up with a single hash.  That way
 * we can generate a hash without needing to use more than a single sha round.  It's
 * not the same value as we'd get using rounds but it's at least doable.
 *
 * @param {string} hexValue
 */
export const sha256 = (hexValue): string => {
  const preimage = strip0x(hexValue);

  const h = `0x${crypto
    .createHash('sha256')
    .update(preimage)
    .digest('hex')}`;
  return h;
};

/**
 * Utility function to concatenate two hex strings and return as buffer
 * Looks like the inputs are somehow being changed to decimal!
 *
 * @param {string} a - the 'a' part
 * @param {string} b - the 'b' part
 * @returns {string} - buffer
 */
export const concatenate = (a, b): Buffer => {
  const length = a.length + b.length;
  const buffer = Buffer.allocUnsafe(length); // creates a buffer object of length 'length'
  for (let i = 0; i < a.length; i += 1) {
    buffer[i] = a[i];
  }
  for (let j = 0; j < b.length; j += 1) {
    buffer[a.length + j] = b[j];
  }
  return buffer;
};

/**
 * Concats then hashes
 *
 * @param {string[]} hexValues - An array of hex values as strings to concat
 */
export const concatenateThenHash = (...hexValues): string => {
  const preimage = hexValues
    .map(item => Buffer.from(strip0x(item), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));

  return `0x${crypto
    .createHash('sha256')
    .update(preimage)
    .digest('hex')}`;
};
