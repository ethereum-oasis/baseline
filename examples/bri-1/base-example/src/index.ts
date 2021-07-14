import { IBaselineRPC, IBlockchainService, IRegistry, IVault, MerkleTreeNode, baselineServiceFactory, baselineProviderProvide } from '@baseline-protocol/api';
import { IMessagingService, messagingProviderNats, messagingServiceFactory } from '@baseline-protocol/messaging';
import { zkSnarkCircuitProviderServiceFactory, zkSnarkCircuitProviderServiceProvide, Element, elementify, rndHex, concatenateThenHash } from '@baseline-protocol/privacy';
import { ICircuitProver, ICircuitRegistry, ICircuitVerifier } from '@baseline-protocol/privacy/dist/cjs/zkp';
import { Message as ProtocolMessage, Opcode, PayloadType, marshalProtocolMessage, unmarshalProtocolMessage } from '@baseline-protocol/types';
import { Application as Workgroup, BusinessObject, Circuit, Invite, Vault as ProvideVault, Organization, Token, Key as VaultKey } from '@provide/types';
import { Baseline, Capabilities, Ident, NChain, Vault, baselineClientFactory, capabilitiesFactory, nchainClientFactory } from 'provide-js';
import { compile as solidityCompile } from 'solc';
import * as jwt from 'jsonwebtoken';
import * as log from 'loglevel';
import { sha256 } from 'js-sha256';
import { AuthService } from 'ts-natsutil';
import { spawn } from 'child_process';
import fs from 'fs';
import { receiveMessageOnPort } from 'worker_threads';

// const baselineDocumentCircuitPath = '../../../lib/circuits/createAgreement.zok';
const baselineProtocolMessageSubject = 'baseline.proxy';
const baselineProtocolDefaultDomain = 'baseline.local';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class TryError extends Error {
  promiseErrors: any[] = []
}

const tryTimes = async <T>(prom: () => Promise<T>, times: number = 100000, wait: number = 500): Promise<T> => {
  const errors : any[] = [];
  for (let index = 0; index < times; index++) {
    try {
      return await prom()
    } catch (err) { 
      errors.push(err);
    }
    await sleep(wait);
  }
  const error = new TryError("Unfulfilled promises");
  error.promiseErrors = errors;
  throw error;
}


export class ParticipantStack {

  private baseline?: IBaselineRPC & IBlockchainService & IRegistry & IVault;
  private baselineProxy?: Baseline;
  private baselineCircuit?: Circuit;
  private baselineConfig?: any;
  private babyJubJub?: VaultKey;
  private domain?: string;
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
  private privacy?: ICircuitRegistry & ICircuitProver & ICircuitVerifier;

  private org?: any;
  private workgroup?: any;
  private workgroupCounterparties: string[] = [];
  private workgroupToken?: any; // workgroup bearer token; used for automated setup
  private workflowIdentifier?: string; // workflow identifier; specific to the workgroup
  private workflowRecords: { [key: string]: any } = {}; // in-memory system of record

  constructor(baselineConfig: any, natsConfig: any) {
    this.baselineConfig = baselineConfig;
    this.natsConfig = natsConfig;
  }

  async init() {
    if (this.initialized) {
      throw new Error(`already initialized participant stack: ${this.org.name}`);
    }

    this.baseline = await baselineServiceFactory(baselineProviderProvide, this.baselineConfig);
    this.nats = await messagingServiceFactory(messagingProviderNats, this.natsConfig);
    this.privacy = await zkSnarkCircuitProviderServiceFactory(zkSnarkCircuitProviderServiceProvide, {
      token: this.baselineConfig?.token,
      privacyApiScheme: this.baselineConfig?.privacyApiScheme,
      privacyApiHost: this.baselineConfig?.privacyApiHost,
    }) as unknown as ICircuitRegistry & ICircuitProver & ICircuitVerifier; // HACK

    if (this.natsConfig?.natsBearerTokens) {
      this.natsBearerTokens = this.natsConfig.natsBearerTokens;
    }

    if (this.baselineConfig?.domain) {
      this.domain = this.baselineConfig?.domain;
    } else {
      this.domain = baselineProtocolDefaultDomain;
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

    this.initialized = true;
  }

  getBaselineCircuit(): Circuit | undefined {
    return this.baselineCircuit;
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

  async disconnect() {
    await this.nats?.flush();
    await this.nats?.disconnect();
  }

  private async dispatchProtocolMessage(msg: ProtocolMessage): Promise<any> {
    if (msg.opcode === Opcode.Join) {
      const payload = JSON.parse(msg.payload.toString());
      const messagingEndpoint = await this.resolveMessagingEndpoint(payload.address);
      if (!messagingEndpoint || !payload.address || !payload.authorized_bearer_token) {
        return Promise.reject('failed to handle baseline JOIN protocol message');
      }
      this.workgroupCounterparties.push(payload.address);
      this.natsBearerTokens[messagingEndpoint] = payload.authorized_bearer_token;

      const circuit = JSON.parse(JSON.stringify(this.baselineCircuit));
      circuit.proving_scheme = circuit.provingScheme;
      circuit.verifier_contract = circuit.verifierContract;
      delete circuit.verifierContract;
      delete circuit.createdAt; 
      delete circuit.vaultId;
      delete circuit.provingScheme;
      delete circuit.provingKeyId;
      delete circuit.verifyingKeyId;
      delete circuit.status;

      // sync circuit artifacts
      this.sendProtocolMessage(payload.address, Opcode.Sync, {
        type: 'circuit',
        payload: circuit,
      });
    } else if (msg.opcode === Opcode.Sync) {
      const payload = JSON.parse(msg.payload.toString());
      if (payload.type === 'circuit') {
        this.baselineCircuit = await this.privacy?.deploy(payload.payload) as Circuit;
      }
    }
  }

  async baselineBusinessObject(params: object): Promise<BusinessObject> {
    return (await this.baselineProxy?.createBusinessObject(params)) as BusinessObject;
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

    await this.baseline?.track(invite.prvd.data.params.shield_contract_address).catch((err) => { });
    await this.registerOrganization(this.baselineConfig.orgName, this.natsConfig.natsServers[0]);
    await this.requireOrganization(await this.resolveOrganizationAddress());
    await this.sendProtocolMessage(counterpartyAddr, Opcode.Join, {
      address: await this.resolveOrganizationAddress(),
      authorized_bearer_token: await this.vendNatsAuthorization(),
      workflow_identifier: this.workflowIdentifier,
    });
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

    if (msg.id && !this.workflowRecords[msg.id]) {
      this.workflowRecords[msg.id] = msg;
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

  async createOrgRefreshToken(): Promise<Token> {
    return await Ident.clientFactory(
      this.baselineConfig?.token,
      this.baselineConfig?.identApiScheme,
      this.baselineConfig?.identApiHost,
    ).createToken({
      organization_id: this.org.id,
      scope: 'offline_access',
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
    var address;
    keys.forEach(key => {
      if (key.spec == 'secp256k1') {
        address = key.address; // HACK!
      }
    });

    if (address) {
      return Promise.resolve(address);
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
      // FIXME-- merge into metadata...
      org['address'] = resp['response'][0];
      org['config'] = JSON.parse(atob(resp['response'][5]));
      org['config']['domain'] = atob(resp['response'][2]);
      org['config']['messaging_endpoint'] = atob(resp['response'][3]);
      org['config']['zk_public_key'] = atob(resp['response'][4]);
      return Promise.resolve(org);
    }

    return Promise.reject(`failed to fetch organization ${address}`);
  }

  async requireCircuit(circuitId: string): Promise<Circuit> {
    let circuit: Circuit | undefined = undefined;
    const orgToken = await this.createOrgToken();
    const tkn = orgToken.accessToken || orgToken.token;

    let interval;
    const promises = [] as any;
    promises.push(new Promise<void>((resolve, reject) => {
      interval = setInterval(async () => {
        circuit = await this.privacy?.fetchCircuit(circuitId) as Circuit;
        if (circuit && circuit.verifierContract && circuit.verifierContract['source']) {
          resolve();
        }
      }, 2500);
    }));

    await Promise.all(promises);
    clearInterval(interval);
    interval = null;

    return circuit!;
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
    let tkn = token;
    if (!tkn) {
      const orgToken = await this.createOrgToken();
      tkn = orgToken.accessToken || orgToken.token;
    }

    return await tryTimes(async () => {
      const vaults = await Vault.clientFactory(
        tkn!,
        this.baselineConfig.vaultApiScheme!,
        this.baselineConfig.vaultApiHost!,
      ).fetchVaults({});
      if (vaults && vaults.length > 0) {
        return vaults[0];
      }
      throw new Error();
    });
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

  async fetchSecret(vaultId: string, secretId: string): Promise<any> {
    const orgToken = await this.createOrgToken();
    const token = orgToken.accessToken || orgToken.token;
    const vault = Vault.clientFactory(token!, this.baselineConfig?.vaultApiScheme, this.baselineConfig?.vaultApiHost);
    return (await vault.fetchVaultSecret(vaultId, secretId));
  }

  async deployBaselineCircuit(): Promise<Circuit> {
    // perform trusted setup and deploy verifier/shield contract
    const circuit = await this.privacy?.deploy({
      identifier: 'purchase_order',
      proving_scheme: 'groth16',
      curve: 'BN254',
      provider: 'gnark',
      name: 'my 1337 circuit',
    }) as Circuit;

    this.baselineCircuit = await this.requireCircuit(circuit.id!);
    this.workflowIdentifier = this.baselineCircuit?.id;
    const content = this.baselineCircuit?.verifierContract!['source'].replace(/\^0.5.0/g, '^0.7.3').replace(/view/g, '').replace(/gas,/g, 'gas(),').replace(/\\n/g, /\n/).replace(/uint256\[0\]/g, 'uint256[]')
    const input = {
      'language': 'Solidity',
      'settings': {
        'outputSelection': {
          '*': {
            '*': ['*']
          }
        }
      },
      'sources': {
        'verifier.sol': {
          'content': content
        }
      }
    };

    const compilerOutput = JSON.parse(solidityCompile(JSON.stringify(input)));
    if (!compilerOutput.contracts || !compilerOutput.contracts['verifier.sol']) {
      throw new Error('verifier contract compilation failed');
    }

    const contractParams = compilerOutput.contracts['verifier.sol']['Verifier'];
    await this.deployWorkgroupContract('Verifier', 'verifier', contractParams);
    await this.requireWorkgroupContract('verifier');
    await this.deployWorkgroupShieldContract();

    return this.baselineCircuit;
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
        // network: 'ropsten',
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
    const contractParams = registryContracts[3]; // "shuttle circuit" factory contract

    const argv = ['MerkleTreeSHA Shield', verifierContract.address, 32];

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
    return await tryTimes(async () => {
      if (this.capabilities?.getBaselineRegistryContracts()) {
        return;
      }
      throw new Error();
    })
  }

  async requireOrganization(address: string): Promise<Organization> {
    return await tryTimes(async () => {
      const org = await this.fetchOrganization(address);
      if (org && org['address'].toLowerCase() === address.toLowerCase()) {
        return org;
      }

      throw new Error();
    })
  }

  async requireWorkgroup(): Promise<void> {
    return await tryTimes(async () => {
      if (this.workgroup) {
        return this.workgroup;
      }
      throw new Error();
    })
  }

  async requireWorkgroupContract(type: string): Promise<any> {
    return await tryTimes(() => this.resolveWorkgroupContract(type))
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
        domain: this.domain,
        messaging_endpoint: messagingEndpoint,
      },
    });

    if (this.org) {
      console.log("before require vault")
      const vault = await this.requireVault();
      console.log(vault)
      this.babyJubJub = await this.createVaultKey(vault.id!, 'babyJubJub');
      await this.createVaultKey(vault.id!, 'secp256k1');
      this.hdwallet = await this.createVaultKey(vault.id!, 'BIP39');
      await this.createVaultKey(vault.id!, 'RSA-4096');
      await this.registerWorkgroupOrganization();
      await this.deployBaselineStack();
    }

    return this.org;
  }

  async deployBaselineStack(): Promise<any> {
    const orgToken = await this.createOrgToken();
    const tkn = orgToken.accessToken || orgToken.token;

    const orgRefreshToken = await this.createOrgRefreshToken();
    const registryContract = await this.requireWorkgroupContract('organization-registry');

    this.baselineProxy = baselineClientFactory(
      tkn!,
      this.baselineConfig?.baselineApiScheme,
      this.baselineConfig?.baselineApiHost
    );
    const orgAddress= await this.resolveOrganizationAddress()

    // Generate config file
    const tokenResp = await this.createWorkgroupToken();
    const configurationFileContents = `access-token: ${this.baselineConfig?.userAccessToken}\nrefresh-token: ${this.baselineConfig?.userRefreshToken}\n${this.workgroup.id}:\n  api-token: ${tokenResp.token}\n`;
    const provideConfigFileName=`${process.cwd()}/.prvd-${this.baselineConfig?.orgName.replace(/\s+/g, '')}-cli.yaml`;
    fs.writeFileSync(provideConfigFileName, configurationFileContents);

    var runcmd = `LOG_LEVEL=TRACE IDENT_API_HOST=${this.baselineConfig?.identApiHost} IDENT_API_SCHEME=${this.baselineConfig?.identApiScheme} NCHAIN_API_HOST=${this.baselineConfig?.nchainApiHost} NCHAIN_API_SCHEME=${this.baselineConfig?.nchainApiScheme} VAULT_API_HOST=${this.baselineConfig?.vaultApiHost} VAULT_API_SCHEME=${this.baselineConfig?.vaultApiScheme} PROVIDE_ORGANIZATION_REFRESH_TOKEN=${orgRefreshToken.refreshToken}`
    runcmd += ` prvd baseline stack run`
    runcmd += ` --api-endpoint="${this.baselineConfig?.baselineApiScheme}://${this.baselineConfig?.baselineApiHost}"`
    runcmd += ` --config="${provideConfigFileName}"`
    runcmd += ` --ident-host="${this.baselineConfig?.identApiHost}"`
		runcmd += ` --ident-scheme="${this.baselineConfig?.identApiScheme}"`
    runcmd += ` --messaging-endpoint="nats://localhost:${this.baselineConfig?.baselineMessagingPort}"`
    runcmd += ` --name="${this.baselineConfig?.orgName.replace(/\s+/g, '')}"`
    runcmd += ` --nats-auth-token="${this.natsConfig?.bearerToken}"`
    runcmd += ` --nats-port=${this.baselineConfig?.baselineMessagingPort}`
    runcmd += ` --nats-streaming-port=${this.baselineConfig?.baselineMessagingStreamingPort}`
    runcmd += ` --nats-ws-port=${this.baselineConfig?.baselineMessagingWebsocketPort}`
    runcmd += ` --nchain-host="${this.baselineConfig?.nchainApiHost}"`
		runcmd += ` --nchain-scheme="${this.baselineConfig?.nchainApiScheme}"`
		runcmd += ` --nchain-network-id="${this.baselineConfig?.networkId}"`
		runcmd += ` --organization="${this.org.id}"`,
    runcmd += ` --organization-address="${orgAddress}"`
    runcmd += ` --organization-refresh-token="${orgRefreshToken.refreshToken}"`
    runcmd += ` --port="${this.baselineConfig?.baselineApiHost.split(':')[1]}"`
    runcmd += ` --privacy-host="${this.baselineConfig?.privacyApiHost}"`
		runcmd += ` --privacy-scheme="${this.baselineConfig?.privacyApiScheme}"`
    runcmd += ` --redis-hostname=${this.baselineConfig?.redisHost}`
    runcmd += ` --redis-port=${this.baselineConfig?.redisPort}`
		runcmd += ` --registry-contract-address="${registryContract.address}"`
    runcmd += ` --sor="ephemeral"`
    runcmd += ` --vault-host="${this.baselineConfig?.vaultApiHost}"`
		runcmd += ` --vault-refresh-token="${orgRefreshToken.refreshToken}"`
		runcmd += ` --vault-scheme="${this.baselineConfig?.vaultApiScheme}"`
		runcmd += ` --workgroup="${this.workgroup?.id}"`

    runcmd.replace(/localhost/ig, 'host.docker.internal')
    console.log(runcmd)

    var child = spawn(runcmd, [], { detached: true, stdio: 'inherit', shell: true });
    child.unref()
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
        allow: [`baseline.proxy`],
      },
    };

    return await authService.vendBearerJWT(
      baselineProtocolMessageSubject,
      5000,
      permissions,
    );
  }
}
