import { assert } from 'chai';
import { promisedTimeout } from './utils';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const shouldBehaveLikeAWorkgroupOrganization = function () {
  describe(`organization details`, () => {
    let org;

    before(async () => {
      org = this.ctx.app.getOrganization();
      assert(org, 'org should not be null');
    });

    describe('topics', () => {
      let orgRegistryTopic;
      let workgroupTopic;
      let workflowTopic;
      let workflowIdentifier;

      before(async () => {
        orgRegistryTopic = await this.ctx.app.requireWorkgroupTopic('hedera_public_hcs_topic');
        workgroupTopic = this.ctx.app.requireWorkgroupTopic('hedera_hcs_topic');
        // workflowTopic = this.ctx.app.getWorkgroupTopic('workflow');
        workflowIdentifier = this.ctx.app.getWorkflowIdentifier();
      });

      it('should have a local reference to the on-chain organization registry HCS topic', async () => {
        assert(orgRegistryTopic, 'organization registry HCS topic should not be null');
        // assert(orgRegistry.address, 'should have a reference to the on-chain organization registry contract address');
      });

      it('should have a local reference to the on-chain workgroup HCS topic', async () => {
        assert(workgroupTopic, 'workgroup HCS topic should not be null');
        // assert(shield.address, 'should have a reference to the on-chain workgroup shield contract address');
      });

      it('should have a local reference to the workflow circuit identifier', async () => {
        assert(workflowIdentifier, 'workflow circuit identifier should not be null');
      });
    });

    describe('messaging', () => {
      let natsService;
      let natsSubscriptions;

      before(async () => {
        natsService = this.ctx.app.getMessagingService();
        natsSubscriptions = this.ctx.app.getProtocolSubscriptions();
      });

      it('should have an established NATS connection', async () => {
        assert(natsService, 'should not be null');
        assert(natsService.isConnected() === true, 'should have established a connection');
      });

      it('should have an established a subscription on the baseline.proxy subject', async () => {
        assert(natsSubscriptions, 'should not be null');
        assert(natsSubscriptions.length === 1, 'should have established a subscription');
      });
    });

    describe('registration', () => {
      let address;

      before(async () => {
        const keys = await this.ctx.app.fetchKeys();
        address = keys && keys.length >= 3 ? keys[2].address : null;
        assert(address, 'default ed25519 keypair should not be null');
      });

      it('should register the organization in the local registry', async () => {
        assert(org.id, 'org id should not be null');
      });

      it('should register the organization using the hcs registry using its default ed25519 address', async () => {
        const org = await this.ctx.app.requireOrganization(address);
        assert(org, 'org should be present in on-chain registry');
      });

      it('should associate the organization with the local workgroup', async () => {
        const orgs = await this.ctx.app.fetchWorkgroupOrganizations();
        assert(orgs.length === 1, 'workgroup should have associated org');
      });
    });

    describe('vault', () => {
      let address;
      let keys;

      before(async () => {
        keys = await this.ctx.app.fetchKeys();
        address = keys && keys.length >= 3 ? keys[2].address : null;
      });

      it('should create a default vault for the organization', async () => {
        const vaults = await this.ctx.app.fetchVaults();
        assert(vaults.length === 1, 'default vault not created');
      });

      it('should create a set of keypairs for the organization', async () => {
        assert(keys, 'default keypairs should not be null');
        assert(keys.length >= 4, 'minimum default keypairs not created');
        // assert(keys.length === 4, 'default keypairs not created');
      });

      it('should create a babyJubJub keypair for the organization', async () => {
        assert(keys[1].spec === 'babyJubJub', 'default babyJubJub keypair not created');
      });

      it('should create a Ed25519 keypair for the organization', async () => {
        assert(keys[2].spec === 'Ed25519', 'default Ed25519 keypair not created');
      });

      it('should resolve the created Ed25519 keypair as the organization address', async () => {
        const addr = await this.ctx.app.resolveOrganizationAddress();
        assert(keys[2].address === addr, 'default ed25519 keypair should resolve as the organization address');
      });

      it('should create a BIP39 HD wallet for the organization', async () => {
        assert(keys[3].spec === 'BIP39', 'default BIP39 HD wallet not created');
      });
    });

    describe('workflow privacy', () => {
      let circuit;

      describe('zkSNARK circuits', () => {
        describe('synchronization', () => {
          before(async () => {
            // We need to Wait fo the Sync
            while (this.ctx.app.getBaselineCircuit() === undefined) {
              await sleep(10000);
            }
            circuit = this.ctx.app.getBaselineCircuit();
            assert(circuit, 'setup artifacts should not be null');
          });

          it('should have a copy of the unique identifier for the circuit', async () => {
            assert(circuit.id, 'identifier should not be null');
          });

          it('should have a copy of the proving key id', async () => {
            assert(circuit.provingKeyId, 'proving key id should not be null');
          });

          it('should have a copy of the verifying key id', async () => {
            assert(circuit.verifyingKeyId, 'verifying key id should not be null');
          });

          it('should have a copy of the raw verifier source code', async () => {
            assert(circuit.verifierContract, 'verifier contract should not be null');
            assert(circuit.verifierContract.source, 'verifier source should not be null');
          });

          it('should store a reference to the workflow circuit identifier', async () => {
            assert(this.ctx.app.getWorkflowIdentifier() === circuit.id, 'workflow circuit identifier should have a reference');
          });

          it('should have a copy of the compiled circuit r1cs', async () => {
            assert(circuit.artifacts, 'circuit artifacts should not be null');
            assert(circuit.artifacts.binary, 'circuit r1cs artifact should not be null');
          });

          it('should have a copy of the keypair for proving and verification', async () => {
            assert(circuit.artifacts, 'circuit artifacts should not be null');
            assert(circuit.artifacts.proving_key, 'proving key artifact should not be null');
            assert(circuit.artifacts.verifying_key, 'verifying key artifact should not be null');
          });
        });
      });
    });
  });
};

export const shouldBehaveLikeAWorkgroupCounterpartyOrganization = function () {
  describe('counterparties', async () => {
    let counterparties;
    let authorizedBearerTokens;
    let authorizedBearerToken;
    let messagingEndpoint;

    before(async () => {
      counterparties = this.ctx.app.getWorkgroupCounterparties();
      authorizedBearerTokens = this.ctx.app.getNatsBearerTokens();
      authorizedBearerToken = await this.ctx.app.resolveNatsBearerToken(counterparties[0]);
      messagingEndpoint = await this.ctx.app.resolveMessagingEndpoint(counterparties[0]);
      await this.ctx.app.requireOrganization(await this.ctx.app.resolveOrganizationAddress());
    });

    it('should have a local reference to the workgroup counterparties', async () => {
      assert(counterparties, 'workgroup counterparties should not be null');
      assert(counterparties.length === 1, 'workgroup counterparties should not be empty');
      assert(counterparties[0] !== await this.ctx.app.resolveOrganizationAddress(), 'workgroup counterparties should not contain local org address');
    });

    it('should have a local reference to peer-authorized messaging endpoints and associated bearer tokens', async () => {
      assert(authorizedBearerTokens, 'authorized bearer tokens should not be null');
      assert(Object.keys(authorizedBearerTokens).length === 1, 'a local reference should exist for a single authorized bearer token');
    });

    it('should have a local reference to the peer-authorized messaging endpoint', async () => {
      assert(messagingEndpoint, 'peer-authorized messaging endpoint should not be null');
    });

    it('should have a local reference to the peer-authorized bearer token', async () => {
      assert(authorizedBearerToken, 'peer-authorized bearer token should not be null');
    });
  });
};

export const shouldBehaveLikeAnInitialWorkgroupOrganization = function () {
  describe('baseline config', () => {
    let cfg;

    before(async () => {
      cfg = this.ctx.app.getBaselineConfig();
    });

    it('should have a non-null config', async () => {
      assert(cfg, 'config should not be null');
    });

    it('should indicate that this instance is the workgroup initiator', async () => {
      assert(cfg.initiator === true, 'config should indicate this instance is the workgroup initiator');
    });
  });

  describe('workflow privacy', () => {
    let circuit;

    describe('zkSNARK circuits', () => {
      describe('provisioning', () => {
        before(async () => {
          circuit = await this.ctx.app.deployBaselineCircuit();
          assert(circuit, 'setup artifacts should not be null');
        });

        it('should output a unique identifier for the circuit', async () => {
          assert(circuit.id, 'identifier should not be null');
        });

        it('should output the proving key id', async () => {
          assert(circuit.provingKeyId, 'proving key id should not be null');
        });

        it('should output the verifying key id', async () => {
          assert(circuit.verifyingKeyId, 'verifying key id should not be null');
        });

        it('should output the raw verifier source code', async () => {
          assert(circuit.verifierContract, 'verifier contract should not be null');
          assert(circuit.verifierContract.source, 'verifier source should not be null');
        });

        it('should store a reference to the workflow circuit identifier', async () => {
          assert(this.ctx.app.getWorkflowIdentifier() === circuit.id, 'workflow circuit identifier should have a reference');
        });

        it('should output the compiled circuit r1cs', async () => {
          assert(circuit.artifacts, 'circuit artifacts should not be null');
          assert(circuit.artifacts.binary, 'circuit r1cs artifact should not be null');
        });

        it('should output the keypair for proving and verification', async () => {
          assert(circuit.artifacts, 'circuit artifacts should not be null');
          assert(circuit.artifacts.proving_key, 'proving key artifact should not be null');
          assert(circuit.artifacts.verifying_key, 'verifying key artifact should not be null');
        });
      });
    });
  });
};

export const shouldBehaveLikeAnInvitedWorkgroupOrganization = function () {
  describe('baseline config', () => {
    let cfg;

    before(async () => {
      cfg = this.ctx.app.getBaselineConfig();
    });

    it('should have a non-null config', async () => {
      assert(cfg, 'config should not be null');
    });

    it('should indicate that this instance is not the workgroup initiator', async () => {
      assert(cfg.initiator === false, 'config should indicate this instance is not the workgroup initiator');
    });
  });

  describe('workgroup', () => {
    let workgroup;
    let workgroupToken;

    before(async () => {
      workgroup = this.ctx.app.getWorkgroup();
      workgroupToken = this.ctx.app.getWorkgroupToken();
    });

    it('should persist the workgroup in the local registry', async () => {
      assert(workgroup, 'workgroup should not be null');
      assert(workgroup.id, 'workgroup id should not be null');
    });

    it('should authorize a bearer token for the workgroup', async () => {
      assert(workgroupToken, 'workgroup token should not be null');
    });
  });
};
