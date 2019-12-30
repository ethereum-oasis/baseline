import { date, company } from 'faker';
import { generate, getRandomInt } from './helpers';
import generateSKU from './sku';
import generatePartner from './partner';

const generateRFP = overrides => ({
  sentBy: company.companyName(),
  sentDate: date.recent(),
  neededBy: date.recent(),
  supplier: generatePartner(),
  skus: generateSKU(getRandomInt(1, 5)),
  ...overrides,
});

export default (n = 1, overrides = {}) => generate(() => generateRFP(overrides), n);