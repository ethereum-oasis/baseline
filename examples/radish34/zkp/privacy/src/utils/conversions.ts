import BI from 'big-integer';
import hexToBinaryUtil from 'hex-to-binary';
import { Buffer } from 'safe-buffer';
import crypto from 'crypto';

// CONVERSION FUNCTIONS

/** Helper function for the converting any base to any base
 */
export const parseToDigitsArray = (str, base): number[] | null => {
  const digits = str.split('');
  const ary: number[] = [];
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const n = parseInt(digits[i], base);
    if (Number.isNaN(n)) {
      return null;
    }
    ary.push(n);
  }
  return ary;
};

/** Helper function for the converting any base to any base
 */
export const add = (x, y, base): number[] => {
  const z: number[] = [];
  const n = Math.max(x.length, y.length);
  let carry = 0;
  let i = 0;
  while (i < n || carry) {
    const xi = i < x.length ? x[i] : 0;
    const yi = i < y.length ? y[i] : 0;
    const zi = carry + xi + yi;
    z.push(zi % base);
    carry = Math.floor(zi / base);
    i += 1;
  }
  return z;
};

/**
 * Helper function for the converting any base to any base Returns a*x,
 * where x is an array of decimal digits and a is an ordinary JavaScript
 * number. base is the number base of the array x.
 */
export const multiplyByNumber = (num, x, base): number[] | null => {
  if (num < 0) {
    return null;
  }
  if (num === 0) {
    return [];
  }

  let result: number[] = [];
  let power = x;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-bitwise
    if (num & 1) {
      result = add(result, power, base);
    }
    num >>= 1; // eslint-disable-line
    if (num === 0) {
      break;
    }
    power = add(power, power, base);
  }
  return result;
};

/**
 * Helper function for the converting any base to any base
 */
export const convertBase = (str, fromBase, toBase): string | null => {
  const digits = parseToDigitsArray(str, fromBase);
  if (digits === null) {
    return null;
  }

  let outArray: number[] = [];
  let power: number[] = [1];

  for (let i = 0; i < digits.length; i += 1) {
    // invariant: at this point, fromBase^i = power
    if (digits[i]) {
      outArray = add(outArray, multiplyByNumber(digits[i], power, toBase), toBase);
    }
    power = multiplyByNumber(fromBase, power, toBase) as number[];
  }

  let out = '';
  for (let i = outArray.length - 1; i >= 0; i -= 1) {
    out += outArray[i].toString(toBase);
  }

  // if the original input was equivalent to zero, then 'out' will still be empty ''. Let's check for zero.
  if (out === '') {
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
      sum += digits[i];
    }
    if (sum === 0) {
      out = '0';
    }
  }

  return out;
};

// FUNCTIONS ON HEX VALUES

/**
function to generate a promise that resolves to a string of hex
@param {int} bytes - the number of bytes of hex that should be returned
*/
export const rndHex = bytes => {
  const buf = crypto.randomBytes(bytes);
  return `0x${buf.toString('hex')}`;
};

/**
utility function to remove a leading 0x on a string representing a hex number.
If no 0x is present then it returns the string un-altered.
*/
export const strip0x = (hex): string => {
  if (typeof hex === 'undefined') {
    return '';
  }
  if (typeof hex === 'string' && hex.indexOf('0x') === 0) {
    return hex.slice(2).toString();
  }
  return hex.toString();
};

/**
utility function to check that a string has a leading 0x (which the Solidity
compiler uses to check for a hex string).  It adds it if it's not present. If
it is present then it returns the string unaltered
*/
export const ensure0x = (hex = ''): string => {
  const hexString = hex.toString();
  if (typeof hexString === 'string' && hexString.indexOf('0x') !== 0) {
    return `0x${hexString}`;
  }
  return hexString;
};

export const isHex = value => {
  const regexp = /^[0-9a-fA-F]+$/;
  return regexp.test(strip0x(value));
};

export const requireHex = (value): void => {
  if (isHex(value) === false) {
    throw new Error('value is not hex');
  }
};

/**
 * Utility function to convert a string into a hex representation of fixed length.
 *
 * @param {string} str - the string to be converted
 * @param {int} outLength - the length of the output hex string in bytes
 *
 * If the string is too short to fill the output hex string, it is padded on the left with 0s.
 * If the string is too long, an error is thrown.
*/
export const utf8ToHex = (str, outLengthBytes): string => {
  const outLength = outLengthBytes * 2; // work in characters rather than bytes
  const buf = Buffer.from(str, 'utf8');
  let hex = buf.toString('hex');
  if (outLength < hex.length) {
    throw new Error('String is to long, try increasing the length of the output hex');
  }
  hex = hex.padStart(outLength, '00');
  return ensure0x(hex);
};

export const hexToUtf8 = (hex): string => {
  const cleanHex = strip0x(hex).replace(/00/g, '');

  const buf = Buffer.from(cleanHex, 'hex');
  return buf.toString('utf8');
};

/**
 * Utility function to convert a string into a hex representation of fixed length.
 *
 * @param {string} str - the string to be converted
 * @param {int} outLength - the length of the output hex string in bytes
 *
 * If the string is too short to fill the output hex string, it is padded on the left with 0s.
 * If the string is too long, an error is thrown.
*/
export const asciiToHex = (str, outLengthBytes): string => {
  const outLength = outLengthBytes * 2; // work in characters rather than bytes
  const buf = Buffer.from(str, 'ascii');
  let hex = buf.toString('hex');
  if (outLength < hex.length) {
    throw new Error('String is to long, try increasing the length of the output hex');
  }
  hex = hex.padStart(outLength, '00');
  return ensure0x(hex);
};

export const hexToAscii = (hex): string => {
  const cleanHex = strip0x(hex).replace(/00/g, '');

  const buf = Buffer.from(cleanHex, 'hex');
  return buf.toString('ascii');
};

/**
Converts hex strings into binary, so that they can be passed into merkle-proof.code
for example (0xff -> [1,1,1,1,1,1,1,1])
*/
export const hexToBinaryArray = (hex): number[] => {
  return hexToBinaryUtil(strip0x(hex)).split('');
};

// the hexToBinaryUtil library was giving some funny values with 'undefined' elements
// within the binary string. Using convertBase seems to be working nicely. THe 'Simple'
// suffix is to distinguish from hexToBinaryArray, which outputs an array of bit elements.
export const hexToBinary = hex => {
  const bin = convertBase(strip0x(hex), 16, 2);
  return bin;
};

/**
Converts hex strings into byte (decimal) values.  This is so that they can
be passed into  merkle-proof.code in a more compressed fromat than bits.
Each byte is invididually converted so 0xffff becomes [15,15]
*/
export const hexToBytes = (hex): string[] => {
  const cleanHex = strip0x(hex);
  const out: string[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const h = ensure0x(cleanHex[i] + cleanHex[i + 1]);
    out.push(parseInt(h, 10).toString());
  }
  return out;
};

// Converts hex strings to decimal values
export const hexToDec = (hexStr): string | null => {
  if (hexStr.substring(0, 2) === '0x') {
    return convertBase(hexStr.substring(2).toLowerCase(), 16, 10);
  }
  return convertBase(hexStr.toLowerCase(), 16, 10);
};

/** converts a hex string to an element of a Finite Field GF(fieldSize) (note, decimal representation is used for all field elements)
@param {string} hexStr A hex string.
@param {integer} fieldSize The number of elements in the finite field.
@return {string} A Field Value (decimal value) (formatted as string, because they're very large)
*/
export const hexToField = (hexStr, fieldSize): string => {
  const cleanHexStr = strip0x(hexStr);
  const decStr = hexToDec(cleanHexStr) as string;
  const q = BI(fieldSize);
  return BI(decStr).mod(q).toString();
};

/**
Left-pads the input hex string with zeros, so that it becomes of size N octets.
@param {string} hexStr A hex number/string.
@param {integer} N The string length (i.e. the number of octets).
@return A hex string (padded) to size N octets, (plus 0x at the start).
*/
export const leftPadHex = (hexStr, n): string => {
  return ensure0x(strip0x(hexStr).padStart(n, '0'));
};

// function to pad out a Hex value with leading zeros to l bits total length,
// preserving the '0x' at the start
export const padHex = (A, l) => {
  if (l % 8 !== 0) {
    throw new Error('cannot convert bits into a whole number of bytes');
  }
  return ensure0x(strip0x(A).padStart(l / 4, '0'));
};

/**
Used by splitAndPadBitsN function.
Left-pads the input binary string with zeros, so that it becomes of size N bits.
@param {string} bitStr A binary number/string.
@param {integer} N The 'chunk size'.
@return A binary string (padded) to size N bits.
 */
export const leftPadBits = (bitStr, n): string => {
  const len = bitStr.length;
  if (len > n) {
    throw new Error(`String larger than ${n} bits passed to leftPadBitsN`);
  }
  if (len === n) {
    return bitStr;
  }
  return bitStr.padStart(n, '0');
};

/**
 * Used by split'X'ToBitsN functions.
 * Checks whether a binary number is larger than N bits, and splits its binary representation into chunks
 * of size = N bits. The left-most (big endian) chunk will be the only chunk of size <= N bits. If the
 * inequality is strict, it left-pads this left-most chunk with zeros.
 *
 * @param {string} bitStr A binary number/string.
 * @param {integer} N The 'chunk size'.
 * @return An array whose elements are binary 'chunks' which altogether represent the input binary number.
 */
export const splitAndPadBits = (bitStr, n): string[] => {
  let a: string[] = [];
  const len = bitStr.length;
  if (len <= n) {
    return [leftPadBits(bitStr, n)];
  }
  const nStr = bitStr.slice(-n); // the rightmost N bits
  const remainderStr = bitStr.slice(0, len - n); // the remaining rightmost bits

  a = [...splitAndPadBits(remainderStr, n), nStr, ...a];

  return a;
};

/**
 * Checks whether a hex number is larger than N bits, and splits its binary representation into chunks
 * of size = N bits. The left-most (big endian) chunk will be the only chunk of size <= N bits. If the
 * inequality is strict, it left-pads this left-most chunk with zeros.
 *
 * @param {string} hexStr A hex number/string.
 * @param {integer} N The 'chunk size'.
 * @return An array whose elements are binary 'chunks' which altogether represent the input hex number.
 */
export const splitHexToBits = (hexStr, n): string[] => {
  const strippedHexStr = strip0x(hexStr);
  const bitStr = hexToBinary(strippedHexStr.toString());
  let a: string[] = [];
  a = splitAndPadBits(bitStr, n);
  return a;
};

// Converts binary value strings to decimal values
export const binToDec = (binStr): string | null => {
  const dec = convertBase(binStr, 2, 10);
  return dec;
};

// Converts binary value strings to hex values
export const binToHex = (binStr): string => {
  const hex = ensure0x(convertBase(binStr, 2, 16) as string);
  return hex;
};

// Converts binary value strings to hex values
export const decToHex = (decStr): string => {
  const hex = ensure0x(convertBase(decStr, 10, 16) as string);
  return hex;
};

// Converts decimal value strings to binary values
export const decToBin = (decStr): string => {
  return convertBase(decStr, 10, 2) as string;
};

/**
 * Preserves the magnitude of a hex number in a finite field, even if the order of the field is smaller
 * than hexStr. hexStr is converted to decimal (as fields work in decimal integer representation) and
 * then split into limbs of length limbBitLength. Relies on a sensible limbBitLength being provided.
 *
 * If the result has fewer limbs than it would need for compatibiity with the dsl, it's padded to the left with '0' limbs.
 */
export const hexToFieldLimbs = (hexStr, limbBitLength, numberOfLimbs, silenceWarnings): string[] => {
  requireHex(hexStr);

  // we first convert to binary, so that we can split into limbs of specific bit-lengths:
  let bitsArr: string[] = [];
  bitsArr = splitHexToBits(hexStr, limbBitLength.toString());

  // then we convert each limb into a decimal:
  let decArr: string[] = []; // decimal array
  decArr = bitsArr.map(item => binToDec(item.toString()) as string);

  // fit the output array to the desired numberOfLimbs:
  if (numberOfLimbs !== undefined) {
    if (numberOfLimbs < decArr.length) {
      const overflow = decArr.length - numberOfLimbs;
      if (!silenceWarnings) {
        throw new Error(
          `Field split into an array of ${decArr.length} limbs: ${decArr}
          , but this exceeds the requested number of limbs of ${numberOfLimbs}. Data would have been lost; possibly unexpectedly. To silence this warning, pass '1' or 'true' as the final parameter.`,
        );
      }
      // remove extra limbs (dangerous!):
      for (let i = 0; i < overflow; i += 1) {
        decArr.shift();
      }
    } else {
      const missing = numberOfLimbs - decArr.length;
      // if the number of limbs required is greater than the number so-far created, prefix any missing limbs to the array as '0' elements.
      for (let i = 0; i < missing; i += 1) {
        decArr.unshift('0');
      }
    }
  }
  return decArr;
};

// UTILITY FUNCTIONS:

/* flattenDeep converts a nested array into a flattened array. We use this to pass our proofs and vks into the verifier contract.
Example:
A vk of the form:
[
  [
    [ '1','2' ],
    [ '3','4' ]
  ],
    [ '5','6' ],
    [
      [ '7','8' ], [ '9','10' ]
    ],
  [
    [ '11','12' ],
    [ '13','14' ]
  ],
    [ '15','16' ],
    [
      [ '17','18' ], [ '19','20' ]
    ],
  [
    [ '21','22' ],
    [ '23','24' ]
  ],
  [
    [ '25','26' ],
    [ '27','28' ],
    [ '29','30' ],
    [ '31','32' ]
  ]
]

is converted to:
['1','2','3','4','5','6',...]
 */
export const flattenDeep = (arr) => {
  return arr.reduce(
    (acc, val) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)),
    [],
  );
};

export default {
  ensure0x,
  strip0x,
  rndHex,
  isHex,
  requireHex,
  utf8ToHex,
  hexToUtf8,
  asciiToHex,
  hexToAscii,
  hexToBinaryArray,
  hexToBinary,
  hexToBytes,
  hexToDec,
  hexToField,
  hexToFieldLimbs,
  binToDec,
  binToHex,
  decToHex,
  decToBin,
  add,
  parseToDigitsArray,
  convertBase,
  splitHexToBits,
  splitAndPadBits,
  leftPadBits,
  padHex,
  leftPadHex,
  flattenDeep,
};
