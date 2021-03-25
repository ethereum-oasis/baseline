import { assert } from 'chai';
import { promisedTimeout } from './utils';

export const shouldBehaveLikeAWorkgroupOrganization = function () {
  describe(`organization details`, () => {
    let org;

    before(async () => {
      org = this.ctx.app.getOrganization();
      assert(org, 'org should not be null');
    });

    describe('contracts', () => {
      let erc1820Registry;
      let orgRegistry;
      let shield;
      let verifier;
      let workflowIdentifier;

      before(async () => {
        erc1820Registry = await this.ctx.app.requireWorkgroupContract('erc1820-registry');
        orgRegistry = await this.ctx.app.requireWorkgroupContract('organization-registry');
        shield = this.ctx.app.getWorkgroupContract('shield');
        verifier = this.ctx.app.getWorkgroupContract('verifier');
        workflowIdentifier = this.ctx.app.getWorkflowIdentifier();
      });

      it('should have a local reference to the on-chain ERC1820 registry contract', async () => {
        assert(erc1820Registry, 'ERC1820 registry contract should not be null');
        assert(erc1820Registry.address, 'should have a reference to the on-chain ERC1820 registry contract address');
      });

      it('should have a local reference to the on-chain organization registry contract', async () => {
        assert(orgRegistry, 'organization registry contract should not be null');
        assert(orgRegistry.address, 'should have a reference to the on-chain organization registry contract address');
      });

      it('should have a local reference to the on-chain workgroup shield contract', async () => {
        assert(shield, 'workgroup shield contract should not be null');
        assert(shield.address, 'should have a reference to the on-chain workgroup shield contract address');
      });

      it('should track the workgroup shield in an off-chain merkle tree database', async () => {
        const trackedShieldContracts = await this.ctx.app.baseline.getTracked();
        assert(trackedShieldContracts.indexOf(shield.address.toLowerCase()) !== -1, 'workgroup shield contract should have been tracked');
      });

      it('should have a local reference to the on-chain workflow circuit verifier contract', async () => {
        assert(verifier, 'workflow circuit verifier contract should not be null');
        assert(verifier.address, 'should have a reference to the on-chain workflow circuit verifier contract address');
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

      it('should have an established a subscription on the baseline.inbound subject', async () => {
        assert(natsSubscriptions, 'should not be null');
        assert(natsSubscriptions.length === 1, 'should have established a subscription');
      });
    });

    describe('registration', () => {
      let address;

      before(async () => {
        const keys = await this.ctx.app.fetchKeys();
        address = keys && keys.length >= 3 ? keys[2].address : null;
        assert(address, 'default secp256k1 keypair should not be null');
      });

      it('should register the organization in the local registry', async () => {
        assert(org.id, 'org id should not be null');
      });

      it('should register the organization in the on-chain registry using its default secp256k1 address', async () => {
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

      it('should create a secp256k1 keypair for the organization', async () => {
        assert(keys[2].spec === 'secp256k1', 'default secp256k1 keypair not created');
      });

      it('should resolve the created secp256k1 keypair as the organization address', async () => {
        const addr = await this.ctx.app.resolveOrganizationAddress();
        assert(keys[2].address === addr, 'default secp256k1 keypair should resolve as the organization address');
      });

      it('should create a BIP39 HD wallet for the organization', async () => {
        assert(keys[3].spec === 'BIP39', 'default BIP39 HD wallet not created');
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
    let circuitArtifacts;
    let setupArtifacts;

    describe('zkSNARK circuits', () => {
      describe('compile', () => {
        before(async () => {
          circuitArtifacts = await this.ctx.app.compileBaselineCircuit();
          assert(circuitArtifacts, 'compiled artifacts should not be null');
        });

        it('should output the compiled circuit', async () => {
          assert(circuitArtifacts.program, 'artifacts should contain the compiled circuit');
        });

        it('should output the ABI of the compiled circuit', async () => {
          assert(circuitArtifacts.abi, 'artifacts should contain the abi');
        });
      });

      describe('trusted setup', () => {
        before(async () => {
          setupArtifacts = await this.ctx.app.deployBaselineCircuit();
          assert(setupArtifacts, 'setup artifacts should not be null');
        });

        it('should output a unique identifier for the circuit', async () => {
          assert(setupArtifacts.identifier, 'identifier should not be null');
        });

        it('should output a keypair for proving and verification', async () => {
          assert(setupArtifacts.keypair, 'keypair should not be null');
        });

        it('should output the raw verifier source code', async () => {
          assert(setupArtifacts.verifierSource, 'verifier source should not be null');
        });

        it('should store a reference to the workflow circuit identifier', async () => {
          assert(this.ctx.app.getWorkflowIdentifier() === setupArtifacts.identifier, 'workflow circuit identifier should have a reference');
        });

        describe('on-chain artifacts', () => {
          let shield;
          let verifier;

          before(async () => {
            shield = this.ctx.app.getWorkgroupContract('shield');
            verifier = this.ctx.app.getWorkgroupContract('verifier');
          });

          it('should deposit the workgroup shield contract on-chain', async () => {
            assert(shield, 'workgroup shield contract should not be null');
            assert(shield.address, 'workgroup shield contract should have been deployed');
          });

          it('should track the workgroup shield in an off-chain merkle tree database', async () => {
            const trackedShieldContracts = await this.ctx.app.baseline.getTracked();
            assert(trackedShieldContracts.indexOf(shield.address.toLowerCase()) !== -1, 'workgroup shield contract should have been tracked');
          });

          it('should deposit the circuit verifier on-chain', async () => {
            assert(verifier, 'workflow circuit verifier contract should not be null');
            assert(verifier.address, 'workflow circuit verifier contract should have been deployed');
          });
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
