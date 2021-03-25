import { IBaselineRPC, IBlockchainService, IRegistry, IVault, MerkleTreeNode, baselineServiceFactory, baselineProviderProvide } from '@baseline-protocol/api';
import { IMessagingService, messagingProviderNats, messagingServiceFactory } from '@baseline-protocol/messaging';
import { IZKSnarkCircuitProvider, IZKSnarkCompilationArtifacts, IZKSnarkTrustedSetupArtifacts, zkSnarkCircuitProviderServiceFactory, zkSnarkCircuitProviderServiceZokrates, Element, elementify, rndHex, concatenateThenHash } from '@baseline-protocol/privacy';
import { Message as ProtocolMessage, Opcode, PayloadType, marshalProtocolMessage, unmarshalProtocolMessage } from '@baseline-protocol/types';
import { Application as Workgroup, Invite, Vault as ProvideVault, Organization, Token, Key as VaultKey } from '@provide/types';
import { Capabilities, Ident, NChain, Vault, capabilitiesFactory, nchainClientFactory } from 'provide-js';
import { readFileSync } from 'fs';
import { compile as solidityCompile } from 'solc';
import * as jwt from 'jsonwebtoken';
import * as log from 'loglevel';
import { sha256 } from 'js-sha256';
import { AuthService } from 'ts-natsutil';

// Persistance imports 
import { IPersistenceService, persistenceServiceFactory, persistenceProviderExcel } from './../../../../core/persistence/src/index';

// const baselineDocumentCircuitPath = '../../../lib/circuits/createAgreement.zok';
const baselineDocumentCircuitPath = '../../../lib/circuits/noopAgreement.zok';
const baselineProtocolMessageSubject = 'baseline.inbound';

const zokratesImportResolver = (location, path) => {
  let zokpath = `../../../lib/circuits/${path}`;
  if (!zokpath.match(/\.zok$/i)) {
    zokpath = `${zokpath}.zok`;
  }
  return {
    source: readFileSync(zokpath).toString(),
    location: path,
  };
};

export class ParticipantStack {

  private baseline?: IBaselineRPC & IBlockchainService & IRegistry & IVault;
  private baselineCircuitArtifacts?: IZKSnarkCompilationArtifacts;
  private baselineCircuitSetupArtifacts?: IZKSnarkTrustedSetupArtifacts;
  private baselineConfig?: any;
  private babyJubJub?: VaultKey;
  private hdwallet?: VaultKey;
  private initialized = false;
  private nats?: IMessagingService;
  private natsBearerTokens: { [key: string]: any } = {}; // mapping of third-party participant messaging endpoint => bearer token
  private natsConfig?: any;
  private protocolMessagesRx = 0;
  private protocolMessagesTx = 0;
  private protocolSubscriptions: any[] = [];
  private capabilities?: Capabilities;
  private contracts: any;
  private zk?: IZKSnarkCircuitProvider;

  private org?: any;
  private workgroup?: any;
  private workgroupCounterparties: string[] = [];
  private workgroupToken?: any; // workgroup bearer token; used for automated setup
  private workflowIdentifier?: string; // workflow identifier; specific to the workgroup
  //private workflowRecords: { [key: string]: any } = {}; // in-memory system of record
  private baselinePersistence?: IPersistenceService;
  private persistenceConfig?: any;

  constructor(baselineConfig: any, natsConfig: any, persistenceConfig?: any ) {
    this.baselineConfig = baselineConfig;
    this.natsConfig = natsConfig;
    if (persistenceConfig)
    this.persistenceConfig = persistenceConfig;
  }

  async init() {
    if (this.initialized) {
      throw new Error(`already initialized participant stack: ${this.org.name}`);
    }

    this.baseline = await baselineServiceFactory(baselineProviderProvide, this.baselineConfig);
    this.nats = await messagingServiceFactory(messagingProviderNats, this.natsConfig);
    this.zk = await zkSnarkCircuitProviderServiceFactory(zkSnarkCircuitProviderServiceZokrates, {
      importResolver: zokratesImportResolver,
    });

    if (this.natsConfig?.natsBearerTokens) {
      this.natsBearerTokens = this.natsConfig.natsBearerTokens;
    }

    this.contracts = {};
    this.startProtocolSubscriptions();

    if (this.baselineConfig.initiator) {
      if (this.baselineConfig.workgroup && this.baselineConfig.workgroupToken) {
        await this.setWorkgroup(this.baselineConfig.workgroup, this.baselineConfig.workgroupToken);
      } else if (this.baselineConfig.workgroupName) {
        await this.createWorkgroup(this.baselineConfig.workgroupName);
      }

      await this.registerOrganization(this.baselineConfig.orgName, this.natsConfig.natsServers[0]);
    }

    if (this.persistenceConfig) {
      this.baselinePersistence = await persistenceServiceFactory(persistenceProviderExcel, this.persistenceConfig);
    } else {
      this.baselinePersistence = await persistenceServiceFactory(persistenceProviderExcel);
    }
    this.initialized = true;
  }

  getBaselineCircuitArtifacts(): any | undefined {
    return this.baselineCircuitArtifacts;
  }

  getBaselineConfig(): any | undefined {
    return this.baselineConfig;
  }

  getBaselineService(): IBaselineRPC & IBlockchainService & IRegistry & IVault | undefined {
    return this.baseline;
  }

  getMessagingConfig(): any | undefined {
    return this.natsConfig;
  }

  getMessagingService(): IMessagingService | undefined {
    return this.nats;
  }

  getNatsBearerTokens(): { [key: string]: any } {
    return this.natsBearerTokens;
  }

  getOrganization(): any | undefined {
    return this.org;
  }

  getProtocolMessagesRx(): number {
    return this.protocolMessagesRx;
  }

  getProtocolMessagesTx(): number {
    return this.protocolMessagesTx;
  }

  getProtocolSubscriptions(): any[] {
    return this.protocolSubscriptions;
  }

  getWorkflowIdentifier(): any {
    return this.workflowIdentifier;
  }

  getWorkgroup(): any {
    return this.workgroup;
  }

  getWorkgroupToken(): any {
    return this.workgroupToken;
  }

  getWorkgroupContract(type: string): any {
    return this.contracts[type];
  }

  getWorkgroupContracts(): any[] {
    return this.contracts;
  }

  getWorkgroupCounterparties(): string[] {
    return this.workgroupCounterparties;
  }

  private async dispatchProtocolMessage(msg: ProtocolMessage): Promise<any> {
    if (msg.opcode === Opcode.Baseline) {
      const vault = await this.requireVault();
      const workflowSignatories = 2;

      const payload = JSON.parse(msg.payload.toString());
      if (payload.doc) {
        if (!payload.sibling_path) {
          payload.sibling_path = [];
        }
        if (!payload.signatures) {
          payload.signatures = [];
        }
        if (!payload.hash) {
          payload.hash = sha256(JSON.stringify(payload.doc));
        }

        if (payload.signatures.length === 0) {
          // baseline this new document
          payload.result = await this.generateProof('preimage', JSON.parse(msg.payload.toString()));
          const signature = (await this.signMessage(vault.id!, this.babyJubJub?.id!, payload.result.proof.proof)).signature;
          payload.signatures = [signature];
          this.workgroupCounterparties.forEach(async recipient => {
            this.sendProtocolMessage(msg.sender, Opcode.Baseline, payload);
          });
        } else if (payload.signatures.length < workflowSignatories) {
            if (payload.sibling_path && payload.sibling_path.length > 0) {
              // perform off-chain verification to make sure this is a legal state transition
              const root = payload.sibling_path[0];
              const verified = this.baseline?.verify(this.contracts['shield'].address, payload.leaf, root, payload.sibling_path);
              if (!verified) {
                console.log('WARNING-- off-chain verification of proposed state transition failed...');
                this.workgroupCounterparties.forEach(async recipient => {
                  this.sendProtocolMessage(recipient, Opcode.Baseline, { err: 'verification failed' });
                });
                return Promise.reject('failed to verify');
              }
            }

            // sign state transition
            const signature = (await this.signMessage(vault.id!, this.babyJubJub?.id!, payload.hash)).signature;
            payload.signatures.push(signature);
            this.workgroupCounterparties.forEach(async recipient => {
              this.sendProtocolMessage(recipient, Opcode.Baseline, payload);
            });
        } else {
          // create state transition commitment
          payload.result = await this.generateProof('modify_state', JSON.parse(msg.payload.toString()));
          const publicInputs = []; // FIXME
          const value = ''; // FIXME
          console.log(payload);

          const resp = await this.baseline?.verifyAndPush(
            msg.sender,
            this.contracts['shield'].address,
            payload.result.proof.proof,
            publicInputs,
            value,
          );

          const leaf = resp!.commitment as MerkleTreeNode;

          if (leaf) {
            console.log(`inserted leaf... ${leaf}`);
            payload.sibling_path = (await this.baseline!.getProof(msg.shield, leaf.location())).map(node => node.location());
            payload.sibling_path?.push(leaf.index);
            this.workgroupCounterparties.forEach(async recipient => {
              await this.sendProtocolMessage(recipient, Opcode.Baseline, payload);
            });
        } else {
            return Promise.reject('failed to insert leaf');
          }
        }
      } else if (payload.signature) {
        console.log(`NOOP!!! received signature in BLINE protocol message: ${payload.signature}`);
      }
    } else if (msg.opcode === Opcode.Join) {
      const payload = JSON.parse(msg.payload.toString());
      const messagingEndpoint = await this.resolveMessagingEndpoint(payload.address);
      if (!messagingEndpoint || !payload.address || !payload.authorized_bearer_token) {
        return Promise.reject('failed to handle baseline JOIN protocol message');
      }
      this.workgroupCounterparties.push(payload.address);
      this.natsBearerTokens[messagingEndpoint] = payload.authorized_bearer_token;
    }
  }

  // HACK!! workgroup/contracts should be synced via protocol
  async acceptWorkgroupInvite(inviteToken: string, contracts: any): Promise<void> {
    if (this.workgroup || this.workgroupToken || this.org || this.baselineConfig.initiator) {
      return Promise.reject('failed to accept workgroup invite');
    }

    const invite = jwt.decode(inviteToken) as { [key: string]: any };

    await this.createWorkgroup(this.baselineConfig.workgroupName);

    this.contracts = {
      'erc1820-registry': {
        address: invite.prvd.data.params.erc1820_registry_contract_address,
        name: 'ERC1820Registry',
        network_id: this.baselineConfig?.networkId,
        params: {
          compiled_artifact: contracts['erc1820-registry'].params?.compiled_artifact
        },
        type: 'erc1820-registry',
      },
      'organization-registry': {
        address: invite.prvd.data.params.organization_registry_contract_address,
        name: 'OrgRegistry',
        network_id: this.baselineConfig?.networkId,
        params: {
          compiled_artifact: contracts['organization-registry'].params?.compiled_artifact
        },
        type: 'organization-registry',
      },
      'shield': {
        address: invite.prvd.data.params.shield_contract_address,
        name: 'Shield',
        network_id: this.baselineConfig?.networkId,
        params: {
          compiled_artifact: contracts['shield'].params?.compiled_artifact
        },
        type: 'shield',
      },
      'verifier': {
        address: invite.prvd.data.params.verifier_contract_address,
        name: 'Verifier',
        network_id: this.baselineConfig?.networkId,
        params: {
          compiled_artifact: contracts['verifier'].params?.compiled_artifact
        },
        type: 'verifier',
      },
    };

    const nchain = nchainClientFactory(
      this.workgroupToken,
      this.baselineConfig?.nchainApiScheme,
      this.baselineConfig?.nchainApiHost,
    );

    this.contracts['erc1820-registry'] = await nchain.createContract(this.contracts['erc1820-registry']);
    this.contracts['organization-registry'] = await nchain.createContract(this.contracts['organization-registry']);
    this.contracts['shield'] = await nchain.createContract(this.contracts['shield']);
    this.contracts['verifier'] = await nchain.createContract(this.contracts['verifier']);

    const counterpartyAddr = invite.prvd.data.params.invitor_organization_address;
    this.workgroupCounterparties.push(counterpartyAddr);

    const messagingEndpoint = await this.resolveMessagingEndpoint(counterpartyAddr);
    this.natsBearerTokens[messagingEndpoint] = invite.prvd.data.params.authorized_bearer_token;
    this.workflowIdentifier = invite.prvd.data.params.workflow_identifier;

    await this.baseline?.track(invite.prvd.data.params.shield_contract_address).catch((err) => {});
    await this.registerOrganization(this.baselineConfig.orgName, this.natsConfig.natsServers[0]);
    await this.requireOrganization(await this.resolveOrganizationAddress());
    await this.sendProtocolMessage(counterpartyAddr, Opcode.Join, {
      address: await this.resolveOrganizationAddress(),
      authorized_bearer_token: await this.vendNatsAuthorization(),
      workflow_identifier: this.workflowIdentifier,
    });
  }

  private marshalCircuitArg(val: string, fieldBits?: number): string[] {
    const el = elementify(val) as Element;
    return el.field(fieldBits || 128, 1, true);
  }

  async generateProof(type: string, msg: any): Promise<any> {
    const senderZkPublicKey = this.babyJubJub?.publicKey!;
    let commitment: string;
    let root: string | null = null;
    const salt = msg.salt || rndHex(32);
    if (msg.sibling_path && msg.sibling_path.length > 0) {
      const siblingPath = elementify(msg.sibling_path) as Element;
      root = siblingPath[0].hex(64);
    }

    console.log(`generating ${type} proof...\n`, msg);

    switch (type) {
      case 'preimage': // create agreement
        const preimage = concatenateThenHash({
          erc20ContractAddress: this.marshalCircuitArg(this.contracts['erc1820-registry'].address),
          senderPublicKey: this.marshalCircuitArg(senderZkPublicKey),
          name: this.marshalCircuitArg(msg.doc.name),
          url: this.marshalCircuitArg(msg.doc.url),
          hash: this.marshalCircuitArg(msg.hash),
        });
        console.log(`generating state genesis with preimage: ${preimage}; salt: ${salt}`);
        commitment = concatenateThenHash(preimage, salt);
        break;

      case 'modify_state': // modify commitment state, nullify if applicable, etc.
        const _commitment = concatenateThenHash({
          senderPublicKey: this.marshalCircuitArg(senderZkPublicKey),
          name: this.marshalCircuitArg(msg.doc.name),
          url: this.marshalCircuitArg(msg.doc.url),
          hash: this.marshalCircuitArg(msg.hash),
        });
        console.log(`generating state transition commitment with calculated delta: ${_commitment}; root: ${root}, salt: ${salt}`);
        commitment = concatenateThenHash(root, _commitment, salt);
        break;

      default:
        throw new Error('invalid proof type');
    }

    const args = [
      this.marshalCircuitArg(commitment), // should == what we are computing in the circuit
      {
        value: [
          this.marshalCircuitArg(commitment.substring(0, 16)),
          this.marshalCircuitArg(commitment.substring(16)),
        ],
        salt: [
          this.marshalCircuitArg(salt.substring(0, 16)),
          this.marshalCircuitArg(salt.substring(16)),
        ],
      },
      {
        senderPublicKey: [
          this.marshalCircuitArg(senderZkPublicKey.substring(0, 16)),
          this.marshalCircuitArg(senderZkPublicKey.substring(16)),
        ],
        agreementName: this.marshalCircuitArg(msg.doc.name),
        agreementUrl: this.marshalCircuitArg(msg.doc.url),
      }
    ];

    const proof = await this.zk?.generateProof(
      this.baselineCircuitArtifacts?.program,
      (await this.zk?.computeWitness(this.baselineCircuitArtifacts!, args)).witness,
      this.baselineCircuitSetupArtifacts?.keypair?.pk,
    );

    return {
      doc: msg.doc,
      proof: proof,
      salt: salt,
    };
  }

  async resolveMessagingEndpoint(addr: string): Promise<string> {
    const org = await this.fetchOrganization(addr);
    if (!org) {
      return Promise.reject(`organization not resolved: ${addr}`);
    }

    const messagingEndpoint = org['config'].messaging_endpoint;
    if (!messagingEndpoint) {
      return Promise.reject(`organization messaging endpoint not resolved for recipient: ${addr}`);
    }

    return messagingEndpoint;
  }

  // bearer auth tokens authorized by third parties are keyed on the messaging endpoint to which access is authorized
  async resolveNatsBearerToken(addr: string): Promise<string> {
    const endpoint = await this.resolveMessagingEndpoint(addr);
    if (!endpoint) {
      return Promise.reject(`failed to resolve messaging endpoint for participant: ${addr}`);
    }
    return this.natsBearerTokens[endpoint];
  }

  // this will accept recipients (string[]) for multi-party use-cases
  async sendProtocolMessage(
    recipient: string,
    opcode: Opcode,
    msg: any,
  ): Promise<any> {
    const messagingEndpoint = await this.resolveMessagingEndpoint(recipient);
    if (!messagingEndpoint) {
      return Promise.reject(`protocol message not sent; organization messaging endpoint not resolved for recipient: ${recipient}`);
    }

    const bearerToken = this.natsBearerTokens[messagingEndpoint];
    if (!bearerToken) {
      return Promise.reject(`protocol message not sent; no bearer authorization cached for endpoint of recipient: ${recipient}`);
    }

    const recipientNatsConn = await messagingServiceFactory(messagingProviderNats, {
      bearerToken: bearerToken,
      natsServers: [messagingEndpoint],
    });
    await recipientNatsConn.connect();

    //if (msg.id && !this.workflowRecords[msg.id]) {
    //  this.workflowRecords[msg.id] = msg;
    //}

    if (msg.id) {

      // just changes id key to identifier key used in ram records
      const msgFomated = Object.keys(msg).reduce((s, item) =>
        item == 'id' ? ({ ...s, ['identifier']: msg['id'] }) : ({ ...s, [item]: msg[item] }), {});
      
      const params = {
        records: [msgFomated]
      }
    
      if (this.baselinePersistence){
        this.baselinePersistence.publish(params);
      }else{
        throw Error('baseline Persistence is undefined');
      }
    
    }


    // this will use protocol buffers or similar
    const wiremsg = marshalProtocolMessage(
      await this.protocolMessageFactory(
        opcode,
        recipient,
        this.contracts['shield'].address,
        this.workflowIdentifier!,
        Buffer.from(JSON.stringify(msg)),
      ),
    );

    const result = recipientNatsConn.publish(baselineProtocolMessageSubject, wiremsg);
    this.protocolMessagesTx++;
    recipientNatsConn.disconnect();
    return result;
  }

  async createWorkgroup(name: string): Promise<Workgroup> {
    if (this.workgroup) {
      return Promise.reject(`workgroup not created; instance is associated with workgroup: ${this.workgroup.name}`);
    }

    this.workgroup = await this.baseline?.createWorkgroup({
      config: {
        baselined: true,
      },
      name: name,
      network_id: this.baselineConfig?.networkId,
    });

    const tokenResp = await this.createWorkgroupToken();
    this.workgroupToken = tokenResp.accessToken || tokenResp.token;

    if (this.baselineConfig.initiator) {
      await this.initWorkgroup();
    }

    return this.workgroup;
  }

  private async initWorkgroup(): Promise<void> {
    if (!this.workgroup) {
      return Promise.reject('failed to init workgroup');
    }

    this.capabilities = capabilitiesFactory();
    await this.requireCapabilities();

    const registryContracts = JSON.parse(JSON.stringify(this.capabilities?.getBaselineRegistryContracts()));
    const contractParams = registryContracts[2]; // "shuttle" launch contract
    // ^^ FIXME -- load from disk -- this is a wrapper to deploy the OrgRegistry contract

    await this.deployWorkgroupContract('Shuttle', 'registry', contractParams);
    await this.requireWorkgroupContract('organization-registry');
  }

  async registerWorkgroupOrganization(): Promise<Organization> {
    if (!this.workgroup || !this.workgroupToken || !this.org) {
      return Promise.reject('failed to register workgroup organization');
    }

    return (await Ident.clientFactory(
      this.workgroupToken,
      this.baselineConfig?.identApiScheme,
      this.baselineConfig?.identApiHost,
    )).createApplicationOrganization(this.workgroup.id, {
      organization_id: this.org.id,
    });
  }

  async setWorkgroup(workgroup: any, workgroupToken: any): Promise<void> {
    if (!workgroup || !workgroupToken || !this.workgroup || this.workgroupToken) {
      return Promise.reject('failed to set workgroup');
    }

    this.workgroup = workgroup;
    this.workgroupToken = workgroupToken;

    return this.initWorkgroup();
  }

  async fetchWorkgroupOrganizations(): Promise<Organization[]> {
    if (!this.workgroup || !this.workgroupToken) {
      return Promise.reject('failed to fetch workgroup organizations');
    }

    return (await Ident.clientFactory(
      this.workgroupToken,
      this.baselineConfig?.identApiScheme,
      this.baselineConfig?.identApiHost,
    ).fetchApplicationOrganizations(this.workgroup.id, {}));
  }

  async createOrgToken(): Promise<Token> {
    return await Ident.clientFactory(
      this.baselineConfig?.token,
      this.baselineConfig?.identApiScheme,
      this.baselineConfig?.identApiHost,
    ).createToken({
      organization_id: this.org.id,
    });
  }

  async createWorkgroupToken(): Promise<Token> {
    return await Ident.clientFactory(
      this.baselineConfig?.token,
      this.baselineConfig?.identApiScheme,
      this.baselineConfig?.identApiHost,
    ).createToken({
      application_id: this.workgroup.id,
    });
  }

  async resolveOrganizationAddress(): Promise<string> {
    const keys = await this.fetchKeys();
    if (keys && keys.length >= 3) {
      return keys[2].address; // HACK!
    }
    return Promise.reject('failed to resolve organization address');
  }

  async fetchOrganization(address: string): Promise<Organization> {
    const orgRegistryContract = await this.requireWorkgroupContract('organization-registry');

    const nchain = nchainClientFactory(
      this.workgroupToken,
      this.baselineConfig?.nchainApiScheme,
      this.baselineConfig?.nchainApiHost,
    );

    const signerResp = (await nchain.createAccount({
      network_id: this.baselineConfig?.networkId,
    }));

    const resp = await NChain.clientFactory(
      this.workgroupToken,
      this.baselineConfig?.nchainApiScheme,
      this.baselineConfig?.nchainApiHost,
    ).executeContract(orgRegistryContract.id, {
      method: 'getOrg',
      params: [address],
      value: 0,
      account_id: signerResp['id'],
    });

    if (resp && resp['response'] && resp['response'][0] !== '0x0000000000000000000000000000000000000000') {
      const org = {} as Organization;
      org.name = resp['response'][1].toString();
      org['address'] = resp['response'][0];
      org['config'] = JSON.parse(atob(resp['response'][5]));
      org['config']['messaging_endpoint'] = atob(resp['response'][2]);
      org['config']['zk_public_key'] = atob(resp['response'][4]);
      return Promise.resolve(org);
    }

    return Promise.reject(`failed to fetch organization ${address}`);
  }

  async fetchVaults(): Promise<ProvideVault[]> {
    const orgToken = await this.createOrgToken();
    const token = orgToken.accessToken || orgToken.token;
    return (await Vault.clientFactory(
      token!,
      this.baselineConfig.vaultApiScheme!,
      this.baselineConfig.vaultApiHost!,
    ).fetchVaults({}));
  }

  async createVaultKey(vaultId: string, spec: string, type?: string, usage?: string): Promise<VaultKey> {
    const orgToken = await this.createOrgToken();
    const token = orgToken.accessToken || orgToken.token;
    const vault = Vault.clientFactory(
      token!,
      this.baselineConfig?.vaultApiScheme,
      this.baselineConfig?.vaultApiHost,
    );
    return (await vault.createVaultKey(vaultId, {
      'type': type || 'asymmetric',
      'usage': usage || 'sign/verify',
      'spec': spec,
      'name': `${this.org.name} ${spec} keypair`,
      'description': `${this.org.name} ${spec} keypair`,
    }));
  }

  async requireVault(token?: string): Promise<ProvideVault> {
    let vault;
    let tkn = token;
    if (!tkn) {
      const orgToken = await this.createOrgToken();
      tkn = orgToken.accessToken || orgToken.token;
    }

    let interval;
    const promises = [] as any;
    promises.push(new Promise((resolve, reject) => {
      interval = setInterval(async () => {
        const vaults = await Vault.clientFactory(
          tkn!,
          this.baselineConfig.vaultApiScheme!,
          this.baselineConfig.vaultApiHost!,
        ).fetchVaults({});
        if (vaults && vaults.length > 0) {
          vault = vaults[0];
          resolve();
        }
      }, 2500);
    }));

    await Promise.all(promises);
    clearInterval(interval);
    interval = null;

    return vault;
  }

  async signMessage(vaultId: string, keyId: string, message: string): Promise<any> {
    const orgToken = await this.createOrgToken();
    const token = orgToken.accessToken || orgToken.token;
    const vault = Vault.clientFactory(token!, this.baselineConfig?.vaultApiScheme, this.baselineConfig?.vaultApiHost);
    return (await vault.signMessage(vaultId, keyId, message));
  }

  async fetchKeys(): Promise<any> {
    const orgToken = await this.createOrgToken();
    const token = orgToken.accessToken || orgToken.token;
    const vault = Vault.clientFactory(token!, this.baselineConfig?.vaultApiScheme, this.baselineConfig?.vaultApiHost);
    const vlt = await this.requireVault(token!);
    return (await vault.fetchVaultKeys(vlt.id!, {}));
  }

  async compileBaselineCircuit(): Promise<any> {
    const src = readFileSync(baselineDocumentCircuitPath).toString();
    this.baselineCircuitArtifacts = await this.zk?.compile(src, 'main');
    return this.baselineCircuitArtifacts;
  }

  async deployBaselineCircuit(): Promise<any> {
    // compile the circuit...
    await this.compileBaselineCircuit();

    // perform trusted setup and deploy verifier/shield contract
    const setupArtifacts = await this.zk?.setup(this.baselineCircuitArtifacts);
    const compilerOutput = JSON.parse(solidityCompile(JSON.stringify({
      language: 'Solidity',
      sources: {
        'verifier.sol': {
          content: setupArtifacts?.verifierSource?.replace(/\^0.6.1/g, '^0.7.3').replace(/view/g, ''),
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*'],
          },
        }
      },
    })));

    if (!compilerOutput.contracts || !compilerOutput.contracts['verifier.sol']) {
      throw new Error('verifier contract compilation failed');
    }

    const contractParams = compilerOutput.contracts['verifier.sol']['Verifier'];
    await this.deployWorkgroupContract('Verifier', 'verifier', contractParams);
    await this.requireWorkgroupContract('verifier');

    const shieldAddress = await this.deployWorkgroupShieldContract();
    const trackedShield = await this.baseline?.track(shieldAddress);
    if (!trackedShield) {
      console.log('WARNING: failed to track baseline shield contract');
    }

    this.baselineCircuitSetupArtifacts = setupArtifacts;
    this.workflowIdentifier = this.baselineCircuitSetupArtifacts?.identifier;

    return setupArtifacts;
  }

  async deployWorkgroupContract(name: string, type: string, params: any, arvg?: any[]): Promise<any> {
    if (!this.workgroupToken) {
      return Promise.reject('failed to deploy workgroup contract');
    }

    if (!params.bytecode && params.evm) { // HACK
      params.bytecode = `0x${params.evm.bytecode.object}`;
    }

    const nchain = nchainClientFactory(
      this.workgroupToken,
      this.baselineConfig?.nchainApiScheme,
      this.baselineConfig?.nchainApiHost,
    );

    const signerResp = (await nchain.createAccount({
      network_id: this.baselineConfig?.networkId,
    }));

    const resp = await nchain.createContract({
      address: '0x',
      params: {
        account_id: signerResp['id'],
        compiled_artifact: params,
        // network: 'kovan',
        argv: arvg || [],
      },
      name: name,
      network_id: this.baselineConfig?.networkId,
      type: type,
    });
    if (resp && resp) {
      this.contracts[type] = resp;
      this.contracts[type].params = {
        compiled_artifact: params,
      };
    }
    return resp;
  }

  async deployWorkgroupShieldContract(): Promise<any> {
    const verifierContract = await this.requireWorkgroupContract('verifier');
    const registryContracts = JSON.parse(JSON.stringify(this.capabilities?.getBaselineRegistryContracts()));
    const contractParams = registryContracts[3]; // "shuttle circle" factory contract

    const argv = ['MerkleTreeSHA Shield', verifierContract.address, 32];

    console.log(contractParams);

    // deploy EYBlockchain's MerkleTreeSHA contract (see https://github.com/EYBlockchain/timber)
    await this.deployWorkgroupContract('ShuttleCircuit', 'circuit', contractParams, argv);
    const shieldContract = await this.requireWorkgroupContract('shield');

    return shieldContract.address;
  }

  async inviteWorkgroupParticipant(email: string): Promise<Invite> {
    return await Ident.clientFactory(
      this.baselineConfig?.token,
      this.baselineConfig?.identApiScheme,
      this.baselineConfig?.identApiHost,
    ).createInvitation({
      application_id: this.workgroup.id,
      email: email,
      permissions: 0,
      params: {
        erc1820_registry_contract_address: this.contracts['erc1820-registry'].address,
        invitor_organization_address: await this.resolveOrganizationAddress(),
        authorized_bearer_token: await this.vendNatsAuthorization(),
        organization_registry_contract_address: this.contracts['organization-registry'].address,
        shield_contract_address: this.contracts['shield'].address,
        verifier_contract_address: this.contracts['verifier'].address,
        workflow_identifier: this.workflowIdentifier,
      },
    });
  }

  private async requireCapabilities(): Promise<void> {
    let interval;
    const promises = [] as any;
    promises.push(new Promise((resolve, reject) => {
      interval = setInterval(async () => {
        if (this.capabilities?.getBaselineRegistryContracts()) {
          resolve();
        }
      }, 2500);
    }));

    await Promise.all(promises);
    clearInterval(interval);
    interval = null;
  }

  async requireOrganization(address: string): Promise<Organization> {
    let organization;
    let interval;

    const promises = [] as any;
    promises.push(new Promise((resolve, reject) => {
      interval = setInterval(async () => {
        this.fetchOrganization(address).then((org) => {
          if (org && org['address'].toLowerCase() === address.toLowerCase()) {
            organization = org;
            resolve();
          }
        }).catch((err) => { });
      }, 5000);
    }));

    await Promise.all(promises);
    clearInterval(interval);
    interval = null;

    return organization;
  }

  async requireWorkgroup(): Promise<void> {
    let interval;
    const promises = [] as any;
    promises.push(new Promise((resolve, reject) => {
      interval = setInterval(async () => {
        if (this.workgroup) {
          resolve();
        }
      }, 2500);
    }));

    await Promise.all(promises);
    clearInterval(interval);
    interval = null;
  }

  async requireWorkgroupContract(type: string): Promise<any> {
    let contract;
    let interval;

    const promises = [] as any;
    promises.push(new Promise((resolve, reject) => {
      interval = setInterval(async () => {
        this.resolveWorkgroupContract(type).then((cntrct) => {
          contract = cntrct;
          resolve();
        }).catch((err) => { });
      }, 5000);
    }));

    await Promise.all(promises);
    clearInterval(interval);
    interval = null;

    return contract;
  }

  async resolveWorkgroupContract(type: string): Promise<any> {
    const nchain = nchainClientFactory(
      this.workgroupToken,
      this.baselineConfig?.nchainApiScheme,
      this.baselineConfig?.nchainApiHost,
    );

    const contracts = await nchain.fetchContracts({
      type: type,
    });

    if (contracts && contracts.length === 1 && contracts[0]['address'] !== '0x') {
      const contract = await nchain.fetchContractDetails(contracts[0].id!);
      this.contracts[type] = contract;
      return Promise.resolve(contract);
    }
    return Promise.reject();
  }

  async registerOrganization(name: string, messagingEndpoint: string): Promise<any> {
    this.org = await this.baseline?.createOrganization({
      name: name,
      metadata: {
        messaging_endpoint: messagingEndpoint,
      },
    });

    if (this.org) {
      const vault = await this.requireVault();
      this.babyJubJub = await this.createVaultKey(vault.id!, 'babyJubJub');
      await this.createVaultKey(vault.id!, 'secp256k1');
      this.hdwallet = await this.createVaultKey(vault.id!, 'BIP39');
      await this.registerWorkgroupOrganization();
    }

    return this.org;
  }

  async startProtocolSubscriptions(): Promise<any> {
    if (!this.nats?.isConnected()) {
      await this.nats?.connect();
    }

    const subscription = await this.nats?.subscribe(baselineProtocolMessageSubject, (msg, err) => {
      this.protocolMessagesRx++;
      this.dispatchProtocolMessage(unmarshalProtocolMessage(Buffer.from(msg.data)));
    });

    this.protocolSubscriptions.push(subscription);
    return this.protocolSubscriptions;
  }

  async protocolMessageFactory(
    opcode: Opcode,
    recipient: string,
    shield: string,
    identifier: string,
    payload: Buffer,
  ): Promise<ProtocolMessage> {
    const vaults = await this.fetchVaults();
    const signature = (await this.signMessage(
      vaults[0].id!,
      this.hdwallet!.id!,
      sha256(payload.toString()),
    )).signature;

    return {
      opcode: opcode,
      sender: await this.resolveOrganizationAddress(),
      recipient: recipient,
      shield: shield,
      identifier: identifier,
      signature: signature,
      type: PayloadType.Text,
      payload: payload,
    };
  }

  async vendNatsAuthorization(): Promise<string> {
    const authService = new AuthService(
      log,
      this.natsConfig?.audience || this.natsConfig.natsServers[0],
      this.natsConfig?.privateKey,
      this.natsConfig?.publicKey,
    );

    const permissions = {
      publish: {
        allow: ['baseline.>'],
      },
      subscribe: {
        allow: [`baseline.inbound`],
      },
    };

    return await authService.vendBearerJWT(
      baselineProtocolMessageSubject,
      5000,
      permissions,
    );
  }
}
