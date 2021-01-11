import { IZKSnarkCircuitProvider, IZKSnarkCompilationArtifacts, IZKSnarkWitnessComputation, IZKSnarkTrustedSetupArtifacts, IZKSnarkTrustedSetupKeypair } from '.';
import { compile, computeWitness, exportVerifier, generateProof, setup } from '@dingomacaroni/zokrates.js';
import { VerificationKey } from 'zokrates-js';
import { existsSync, lstatSync, mkdirSync, writeFileSync, readFileSync, unlink } from 'fs';
import { v4 as uuid } from 'uuid';

// NOTE: location for ZoKrates bin should be defined in the Dockerfile
// NOTE: location for ZoKrates stdlib should be defined in the Dockerfile
const defaultPath = '/app/zok/';

// NOTE: defaults exactly similar to zokrates.ts provider
const defaultCurve = 'bn128';
const defaultBackend = 'bellman';
const defaultProvingScheme = 'g16';
const defaultSolidityAbi = 'v2';

const deleteFile = (fileName) => {
  unlink(fileName, error => {
    if (error) throw error;
  });
}

export class ZoKratesCliWrapperService implements IZKSnarkCircuitProvider {

  private path: string;
  private curve: string;
  private backend: string;
  private provingScheme: string;
  private solidityAbi: string;

  constructor(
    path: string,
    curve: string,
    backend: string,
    provingScheme: string,
    solidityAbi: string
  ) {
    // NOTE: path must start from Dockerfile WORKDIR
    this.path = path;
    this.curve = curve;
    this.backend = backend;
    this.provingScheme = provingScheme;
    this.solidityAbi = solidityAbi;

    // Ensure path ends with /
    path = path.endsWith('/') ? path : `${path}/`;

    // Check if path exists and is directory, otherwise create
    if (!existsSync(path) || !lstatSync(path).isDirectory()) {
      mkdirSync(path, { recursive: true });
    }
  }

  async compile(source: string, location: string): Promise<IZKSnarkCompilationArtifacts> {
    // NOTE: location is not used, ZoKrates cli and therefore ZoKrates Node.js wrapper @dingomacaroni/zokrates.js assumes main as default location
    // NOTE: may improve performance using async instead of sync read/write
    return new Promise(async (resolve, reject) => {
      try {
        // Write source to file
        const timestamp = Date.now();
        writeFileSync(`${this.path}${timestamp}.zok`, source);

        // Compile zok file
        await compile(`${this.path}${timestamp}.zok`, this.path, `${timestamp}`, `${timestamp}_abi.json`, this.curve);

        // Read files
        const compilationArtifacts: IZKSnarkCompilationArtifacts = {
          program: readFileSync(`${this.path}${timestamp}`),
          abi: JSON.stringify(JSON.parse(readFileSync(`${this.path}${timestamp}_abi.json`).toString()))
        }

        // Clean
        deleteFile(`${this.path}${timestamp}.zok`);
        deleteFile(`${this.path}${timestamp}.ztf`);
        deleteFile(`${this.path}${timestamp}`);
        deleteFile(`${this.path}${timestamp}_abi.json`);

        resolve(compilationArtifacts);
      } catch (error) {
        reject(error);
      }
    });
  }

  async computeWitness(artifacts: IZKSnarkCompilationArtifacts, args: any[]): Promise<IZKSnarkWitnessComputation> {
    return new Promise(async (resolve, reject) => {
      try {
        // Write program bin and abi to file
        const timestamp = Date.now();
        writeFileSync(`${this.path}${timestamp}`, artifacts.program);
        writeFileSync(`${this.path}${timestamp}_abi.json`, artifacts.abi);

        // Compute witness
        const cliOutput = await computeWitness(`${this.path}${timestamp}`, `${this.path}${timestamp}_abi.json`, this.path, `${timestamp}_witness`, args, {verbose: true});

        // HACK: Parse witness.output from cli verbose output, since cli does not write it to file
        /*
        'Computing witness...\n' +
        'def main(_0) -> (1):\n' +
        '\t(1 * _0) * (1 * _0) == 1 * _1\n' +
        '\t(1 * ~one) * (1 * _1) == 1 * ~out_0\n' +
        '\t return ~out_0\n' +
        '\n' +
        'Witness: \n' +
        '\n' +
        '["4"]\n'
        */
        const indexAtWitnessStr = cliOutput.search('Witness:');
        const indexAfterWitnessStr = indexAtWitnessStr + 'Witness:'.length;
        const output = cliOutput.substring(indexAfterWitnessStr, cliOutput.length);
        const parsedOutput = output.trim();

        // Read file
        const witness: IZKSnarkWitnessComputation = {
          witness: readFileSync(`${this.path}${timestamp}_witness`).toString(),
          output: parsedOutput
        }

        // Clean
        deleteFile(`${this.path}${timestamp}`);
        deleteFile(`${this.path}${timestamp}_abi.json`);
        deleteFile(`${this.path}${timestamp}_witness`);

        resolve(witness);
      } catch (error) {
        reject(error);
      }
    });
  }

  async exportVerifier(verifyingKey: VerificationKey): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // Write vk to file
        const timestamp = Date.now();
        //writeFileSync(`${this.path}${timestamp}_vk.key`, JSON.stringify(verifyingKey, null, '  '));
        writeFileSync(`${this.path}${timestamp}_vk.key`, JSON.stringify(verifyingKey));

        // Export verifier
        await exportVerifier(`${this.path}${timestamp}_vk.key`, this.path, `${timestamp}_verifier.sol`, this.provingScheme, this.curve, this.solidityAbi);

        // Read file
        const verifierSource = readFileSync(`${this.path}${timestamp}_verifier.sol`).toString();

        // Clean
        deleteFile(`${this.path}${timestamp}_vk.key`);
        deleteFile(`${this.path}${timestamp}_verifier.sol`);

        resolve(verifierSource);
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateProof(circuit: any, witness: string, provingKey: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        // Write program bin, witness and proving key to file
        const timestamp = Date.now();
        writeFileSync(`${this.path}${timestamp}`, circuit);
        writeFileSync(`${this.path}${timestamp}_witness`, witness);
        writeFileSync(`${this.path}${timestamp}_pk.key`, provingKey);

        // Generate proof
        await generateProof(`${this.path}${timestamp}`, `${this.path}${timestamp}_pk.key`, `${this.path}${timestamp}_witness`, this.path, `${timestamp}_proof.json`, this.provingScheme, this.backend);

        // Read file
        const proof = JSON.parse(readFileSync(`${this.path}${timestamp}_proof.json`).toString());

        // Clean
        deleteFile(`${this.path}${timestamp}`);
        deleteFile(`${this.path}${timestamp}_witness`);
        deleteFile(`${this.path}${timestamp}_pk.key`);
        deleteFile(`${this.path}${timestamp}_proof.json`);

        resolve(proof);
      } catch (error) {
        reject(error);
      }
    });
  }

  async setup(artifacts: IZKSnarkCompilationArtifacts): Promise<IZKSnarkTrustedSetupArtifacts> {
    return new Promise(async (resolve, reject) => {
      try {
        // Write program bin and abi to file
        const timestamp = Date.now();
        writeFileSync(`${this.path}${timestamp}`, artifacts.program);
        // NOTE: ABI is not used
        writeFileSync(`${this.path}${timestamp}_abi.json`, artifacts.abi);

        // Perform setup
        await setup(`${this.path}${timestamp}`, this.path, this.provingScheme, this.backend, `${timestamp}_vk.key`, `${timestamp}_pk.key`);

        // Read files
        const keypair:IZKSnarkTrustedSetupKeypair = {
          vk: JSON.parse(readFileSync(`${this.path}${timestamp}_vk.key`).toString()),
          pk: readFileSync(`${this.path}${timestamp}_pk.key`)
        }

        const artifact: IZKSnarkTrustedSetupArtifacts = {
          identifier: uuid(),
          keypair: keypair,
          verifierSource: await this.exportVerifier(keypair.vk),
        };

        // Clean
        deleteFile(`${this.path}${timestamp}`);
        deleteFile(`${this.path}${timestamp}_abi.json`);
        deleteFile(`${this.path}${timestamp}_pk.key`);
        deleteFile(`${this.path}${timestamp}_vk.key`);

        resolve(artifact);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const zokratesCliWrapperServiceFactory = async (config?: any): Promise<ZoKratesCliWrapperService> => {
  return new ZoKratesCliWrapperService(config?.path || defaultPath, config?.curve || defaultCurve, config?.backend || defaultBackend, config?.provingScheme || defaultProvingScheme, config?.solidityAbi || defaultSolidityAbi);
};
