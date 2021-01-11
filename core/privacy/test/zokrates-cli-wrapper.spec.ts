import { shouldBehaveLikeZKSnarkCircuit } from './shared';
import { zkSnarkCircuitProviderServiceFactory, zkSnarkCircuitProviderServiceZokratesCliWrapper } from '../src/index';
import { flattenDeep } from '../src/utils/conversions';

const noopAgreementCircuitPath = './lib/circuits/noopAgreement.zok';
const createAgreementPath = './lib/circuits/createAgreement.zok';
const createAgreementOwnedPath = './lib/circuits/createAgreementOwned.zok';
const signAgreementPath = './lib/circuits/signAgreement.zok';
const proofOfOwnershipPath = './lib/circuits/prove-ownership-of-sk.zok';

let provider;

describe('when the underlying zokrates-cli-wrapper provider is available', () => {
  beforeEach(async () => {
    provider = await zkSnarkCircuitProviderServiceFactory(zkSnarkCircuitProviderServiceZokratesCliWrapper);
  });

  it('runs the noopAgreement circuit lifecycle successfully', () => {
    shouldBehaveLikeZKSnarkCircuit(provider, noopAgreementCircuitPath, ['2']);
  });

  it('runs the createAgreement circuit lifecycle successfully', () => {
    const args = [
      '1',
      ['3', '1'],
      ['3', '5'],
      ['6', '7'],
      '8',
      '9'
    ]
    shouldBehaveLikeZKSnarkCircuit(provider, createAgreementPath, flattenDeep(args));
  });

  it('runs the proof of ownership circuit lifecycle successfully', () => {
    const args = [['1', '2'], '3'];
    shouldBehaveLikeZKSnarkCircuit(provider, proofOfOwnershipPath, flattenDeep(args));
  });

  it('runs the createAgreementOwned circuit lifecycle successfully', () => {
   const args = [
    '1',
    ['2', '3'],
    ['4', '5'],
    ['6', '7'],
    ['8', '9'],
    '10',
    '11',
    '12'
   ]
    shouldBehaveLikeZKSnarkCircuit(provider, createAgreementOwnedPath, flattenDeep(args));
  });

  it('runs the signAgreement circuit lifecycle successfully', () => {
   const args = [
    ['1', '2', '3', '4', '5', '6', '7', '8'],
    ['9', '10'],
    ['1', '2'],
    '3',
   ]
    shouldBehaveLikeZKSnarkCircuit(provider, signAgreementPath, flattenDeep(args));
  });
});
