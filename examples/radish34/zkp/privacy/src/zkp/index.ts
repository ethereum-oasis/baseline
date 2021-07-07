import { Circuit } from '@baseline-protocol/types';
import { provideServiceFactory } from './provide';
import { zokratesServiceFactory } from './zokrates';
import { VerificationKey } from 'zokrates-js/node';

export const zkSnarkCircuitProviderServiceProvide = 'provide';
export const zkSnarkCircuitProviderServiceZokrates = 'zokrates';

export interface ICircuitProver {
  prove(circuitId: any, params: any): Promise<any>;
}

export interface ICircuitRegistry {
  deploy(params: any): Promise<Circuit>; // deploy a circuit to the registry
  fetchCircuit(circuitId: string): Promise<Circuit>;
  fetchCircuits(params: any): Promise<Circuit[]>;
}

export interface ICircuitVerifier {
  verify(circuitId: any, params: any): Promise<any>;
}

export interface IZKSnarkCircuitProvider {
  compile(source: string, location: string): Promise<IZKSnarkCompilationArtifacts>;
  computeWitness(artifacts: IZKSnarkCompilationArtifacts, argv: any[]): Promise<IZKSnarkWitnessComputation>;
  exportVerifier(verifyingKey: VerificationKey): Promise<any>;
  generateProof(circuit: any, params: any, provingKey?: any): Promise<any>;
  setup(circuit: any): Promise<IZKSnarkTrustedSetupArtifacts>;
}

export interface IZKSnarkCompilationArtifacts {
  program: Uint8Array,
  abi: string,
}

export type IZKSnarkTrustedSetupArtifacts = {
  identifier?: string;
  keypair?: IZKSnarkTrustedSetupKeypair;
  verifierSource?: string;
}

export type IZKSnarkTrustedSetupKeypair = {
  vk: VerificationKey;
  pk: Uint8Array;
}

export type IZKSnarkWitnessComputation = {
  witness: string;
  output: string;
}

export async function zkSnarkCircuitProviderServiceFactory(
  provider: string,
  config?: any,
): Promise<IZKSnarkCircuitProvider> {
  let service;

  switch (provider) {
    case zkSnarkCircuitProviderServiceProvide:
      service = await provideServiceFactory(config);
      break;
    case zkSnarkCircuitProviderServiceZokrates:
      service = await zokratesServiceFactory(config);
      break;
    default:
      throw new Error('zkSnark circuit provider service required');
  }

  return service;
}
