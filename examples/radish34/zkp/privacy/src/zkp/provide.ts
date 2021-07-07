import { ICircuitVerifier, ICircuitRegistry, ICircuitProver } from '.';
import { Privacy } from 'provide-js';
import { Circuit } from '@baseline-protocol/types';
import { ProveResponse, VerifyResponse } from '@provide/types';

/**
 * This class is the Provide Privacy implementation
 * for the core baseline privacy package.
 */
export class ProvideService implements ICircuitProver, ICircuitRegistry, ICircuitVerifier {

  // Provide enterprise-grade privacy API
  private provide: Privacy;

  constructor(
    private readonly config: any,
  ) {
    if (!config || !config.token) {
      throw new Error('privacy service requires config and bearer authorization token');
    }

    // this.circuitId = config.circuitId;
    this.provide = Privacy.clientFactory(config.token, config.privacyApiScheme, config.privacyApiHost);
  }

  // all-in-one convenience of compiling, running trusted setup (if applicable) and registering artifacts (i.e. r1cs, pk, vk)
  async deploy(params: any): Promise<Circuit> {
    return await this.provide.deployCircuit(params) as Circuit;
  }

  async fetchCircuit(circuitId: string): Promise<Circuit> {
    return await this.provide.fetchCircuitDetails(circuitId) as Circuit;
  }

  async fetchCircuits(params: any): Promise<Circuit[]> {
    return await this.provide.fetchCircuits(params) as Circuit[];
  }

  async prove(circuitId: string, params: any): Promise<ProveResponse> {
    return await this.provide.prove(circuitId, params);
  }

  async verify(circuitId: string, params: any): Promise<VerifyResponse> {
    return await this.provide.verify(circuitId, params);
  }
}

export const provideServiceFactory = async (config?: any): Promise<ProvideService> => {
  return new ProvideService(config);
};
