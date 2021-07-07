import {
  leftPadHex,
  strip0x,
  ensure0x,
  hexToBinaryArray,
  hexToBinary,
  hexToBytes,
  hexToDec,
  hexToFieldLimbs,
  hexToAscii,
  hexToUtf8,
  decToHex,
  utf8ToHex,
  asciiToHex,
} from './conversions';

/**
 * This class defines a 'convertible' element.  That's basically an object that can be converted
 * into many common types: 'hex', 'integer', 'field', 'binary', 'bits', 'bytes', 'ascii', 'utf8'.
 *
 * @param {string} value the input value
 * @param {string} type enum of: ['hex', 'binary', 'integer', 'ascii', 'utf8']
 * @param {integer} limbBitLength - optional - when converting to a field, specify the default
 * limbBitLength of each limb. A different limb parameter can always be specified at the time
 * of 'getting' this.field().
 * @param {integer} numberOfLimbs - optional - when converting to a field, specify the default
 * numberOfLimbs. A different limb parameter can always be specified at the time of 'getting' this.field().
*/
export class Element {
  private limbBitLength: number;
  private numberOfLimbs: number;
  private _hex: string;

  constructor(value, type = inferType(value), limbBitLength = 128, numberOfLimbs = 2) {
    if (value === undefined) {
      throw new Error('Input value was undefined');
    }
    if (value === '') {
      throw new Error('Input was empty');
    }
    // regardless of the input type, we convert it to hex and store it as hex:
    switch (type) {
      default:
        // hex
        this._hex = ensure0x(value);
        break;
      case 'hex':
        this._hex = ensure0x(value);
        break;
      // DISALLOWING binary input, because it can be confused with decimal when inferring.
      // case 'binary':
      //   this._hex = binToHex(value);
      //   break;
      case 'integer':
        this._hex = decToHex(value.toString());
        break;
      case 'ascii':
        this._hex = asciiToHex(value, 32);
        break;
      case 'utf8':
        this._hex = utf8ToHex(value, 32);
        break;
    }

    this.limbBitLength = limbBitLength;
    this.numberOfLimbs = numberOfLimbs;
  }

  get binary() {
    return hexToBinary(this._hex);
  }

  get bits() {
    return hexToBinaryArray(this._hex);
  }

  get bytes() {
    return hexToBytes(this._hex);
  }

  get integer() {
    return hexToDec(this._hex);
  }

  get ascii() {
    return hexToAscii(this._hex);
  }

  get utf8() {
    return hexToUtf8(this._hex);
  }

  hex(octetLength) {
    if (octetLength) {
      return leftPadHex(this._hex, octetLength);
    }
    return this._hex;
  }

  field(limbBitLength = this.limbBitLength, numberOfLimbs = this.numberOfLimbs, suppressWarnings) {
    const outputField = hexToFieldLimbs(this._hex, limbBitLength, numberOfLimbs, suppressWarnings);
    return outputField;
  }
}

/**
 * A very broad stroke: converts all values of an object to the element class.
 *
 * TODO: WARNING: Types are inferred within the Element class constructor. Types might be mistaken in rare cases.
*/
export const elementifyObject = (_object): any => {
  const object = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(_object)) {
    if (Array.isArray(value)) {
      object[key] = value.map(item => new Element(item));
    } else if (typeof value === 'object') {
      object[key] = elementifyObject(value);
    } else if (typeof value === 'undefined') {
      object[key] = value;
    } else if (typeof value === 'boolean') {
      object[key] = value;
    } else {
      object[key] = new Element(value);
    }
  }
  return object;
};

export const elementify = (thing): Element | Element[] => {
  if (Array.isArray(thing)) {
    const array = thing.map(item => new Element(item));
    return array;
  }
  if (typeof thing === 'object') {
    const object = elementifyObject(thing);
    return object as Element;
  }
  return new Element(thing);
};

/**
 * TODO WARNING: THIS IS NOT FOOL PROOF. IT MIGHT INFER THE WRONG TYPE - e.g. if a hex number
 * has no '0x' and no 'abcdef' values
*/
const inferType = (value): string => {
  if (/^[0-9]+$/.test(value)) {
    return 'integer';
  }
  if (value.indexOf('0x') === 0 || /^[0-9a-fA-F]+$/.test(strip0x(value)) === true) {
    return 'hex';
  }
  if (/^[\x00-\x7F]*$/.test(value) === true) {
    return 'ascii'; // eslint-disable-line no-control-regex
  }
  return 'utf8';
};
