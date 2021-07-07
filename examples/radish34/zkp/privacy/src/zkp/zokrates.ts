import { initialize, ResolveCallback, ZoKratesProvider, VerificationKey } from 'zokrates-js/node';
import { IZKSnarkCircuitProvider, IZKSnarkCompilationArtifacts, IZKSnarkWitnessComputation, IZKSnarkTrustedSetupArtifacts } from '.';
import { readFileSync } from 'fs';
import { v4 as uuid } from 'uuid';

const defaultImportResolver = (location, path) => {
  let zokpath = `../../lib/circuits/${path}`;
  if (!zokpath.match(/\.zok$/i)) {
    zokpath = `${zokpath}.zok`;
  }
  return {
    source: readFileSync(zokpath).toString(),
    location: path,
  };
};

export class ZoKratesService implements IZKSnarkCircuitProvider {

  private importResolver: ResolveCallback;
  private zokrates: ZoKratesProvider;

  constructor(
    zokrates: ZoKratesProvider,
    importResolver: ResolveCallback,
  ) {
    this.zokrates = zokrates;
    this.importResolver = importResolver;
  }

  async compile(source: string, location: string): Promise<IZKSnarkCompilationArtifacts> {
    return this.zokrates.compile(source, {location: location, resolveCallback: this.importResolver});
  }

  async computeWitness(artifacts: IZKSnarkCompilationArtifacts, args: any[]): Promise<IZKSnarkWitnessComputation> {
    return this.zokrates.computeWitness(artifacts, args);
  }

  async exportVerifier(verifyingKey: VerificationKey): Promise<string> {
    return this.zokrates.exportSolidityVerifier(verifyingKey, "v2");
  }

  async generateProof(circuit: any, witness: string, provingKey: any): Promise<any> {
    return this.zokrates.generateProof(circuit, witness, provingKey);
  }

  async setup(artifacts: IZKSnarkCompilationArtifacts): Promise<IZKSnarkTrustedSetupArtifacts> {
    const keypair = this.zokrates.setup(artifacts.program);
    if (!keypair || !keypair.pk || !keypair.vk) {
      return Promise.reject('failed to perform trusted setup');
    }

    const artifact: IZKSnarkTrustedSetupArtifacts = {
      identifier: uuid(),
      keypair: keypair,
      verifierSource: await this.exportVerifier(keypair.vk),
    };

    if (!artifact.verifierSource) {
      return Promise.reject('failed to export verifier');
    }

    return artifact;
  }
}

export const zokratesServiceFactory = async (config?: any): Promise<ZoKratesService> => {
  const zokratesProvider = await initialize();
  return new ZoKratesService(zokratesProvider, config?.importResolver || defaultImportResolver);
};
