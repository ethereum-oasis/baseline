# Radish34

__Radish34__ is a product procurement application that utilizes the __Baseline Protocol__ to gain unprecedented data integrity while maintaining privacy and security for its users.

Disclaimer: This implementation is a demo, and production aspects of key management, wallet management, cloud hosting, integration to other third party tools and performance optimization are left out of scope to drive adoption and present a base set of tools for the community to provide inputs and take this further.

## Prerequisites to run the demo

Windows 10 users [should follow some initial setup instructions](windows_setup.md) first.

1. Install [Docker for Mac](https://www.docker.com/docker-mac), or
    [Docker for Windows](https://www.docker.com/docker-windows) (Windows users [using WSL](windows_setup.md) can skip this step).
    - It's recommended that you allocate 12.5GB of RAM in Docker (see 'Troubleshooting').
1. MacOS development environment (Catalina or later - 10.15.X). Note: It is possible it works in other environments/versions of MacOS
1. NodeJS version 11.15 installed (or use of NVM is recommended)
1. Use npm to install yarn `npm install -g yarn`

## Quickstart

A `Makefile` has been included for convenience; most of its targets wrap `npm` and `docker` commands.

Just want to get the __Baseline Protocol__ running locally? The following sequence will build the monorepo, start the __Baseline Protocol__ stack locally, deploy contracts and run the full test suite. *Note: this typically takes at least 20 minutes to complete.
```
make && make start && make test
```
or
```
npm run build && npm run start && npm run test
```
> Note: The file `./env.dev.env` contains environment variables that allow you to select between configurable options. For example, to speed up testing you can use "dummy" ZKP circuits (`createDummyMSA` and `createDummyPO`) instead of the `createMSA` and `createPO` by setting `BASELINE_ZKP_MODE="1"`. This shortens the integration test time significantly because the proof generation for the "dummy" circuits is trivial.

### The demo UI

After running the above (`npm run test` optional) you can view the Radish34 demo by opening [http://localhost:3000](http://localhost:3000) in your browser.

Here are the targets currently exposed by `Makefile` or `Npm`:

- `npm run build` `make`: Alias for `npm run build`
- `npm run build` `make build`: Build all modules within the monorepo and compile contracts.
- `npm run dockerize` `make build-containers`: Dockerize all modules within the monorepo.
- `npm run clean` `make clean`: Reclaim disk used by all modules (i.e. `node_modules/`) and the local docker environment. This effectively uninstalls your local __Baseline__ environment and will require building from scratch.
- `npm run build:contracts` `make contracts`: Compile the Solidity contracts.
- `npm run deploy` `make deploy-contracts`: Deploy the Solidity contracts. Requires the stack to be running.
- `npm run build:install` `make npm-install`: `npm i` wrapper for all modules in the monorepo.
- `npm run start` `make start`: Start the full __Baseline__ stack. Requires `docker` service to be running with at least 12 GB RAM allocation.
- `npm run stop` `make stop`: Stop the running __Baseline__ stack.
- `npm run system-check` `make system-check`: Verify that `docker` is configured properly.
- `npm run restart` `make restart`: Stop and start the `docker` stack.
- `npm run destroy` `make reset`: Clean the docker environment by pruning the docker networks and volumes.
- `npm run test` `make test`: Run the full test suite. Requires the stack to be running.
- `npm run zk-circuits` `make zk-circuits`: Perform zk-SNARK trusted setups for circuits contained within `zkp/circuits`

## Detailed Setup

The steps below illustrate the individual steps, that can be viewed as the breakdown of the `make` scripts.

1. As part of the development environment, we assume a procurement use-case with three users: (1) buyer and (2) supplier organizations.
2. Run `npm run build:install`. ** This takes about 6 minutes to clean install npm packages in root and all sub directories **
3. Run `docker-compose build` to create the latest versions of the docker containers. ** Only do this the first time or when service source code is changed **. ** This takes about 40 minutes for a fresh build **
4. Run `npm run setup-circuits` to perform zk-SNARK trusted setups for the circuits that are contained in the `/zkp/circuits`. ** This takes about 5-10 minutes to complete ** 
    <details> 
      <summary>Example logs</summary>
      <p> 

      ```
      *** Starting zokrates container ***
      radish-34_radish-zkp-watch_1 is up-to-date
      mongo-buyer is up-to-date
      radish-34_radish-zkp_1 is up-to-date

      *** Running setup for createMSA ***
      {"verificationKey":{"H":[["0x28cbb3929742ba7f874746fb890540017813ef404ae38c7073bf030be3577194","0x0974c59917efe8f2aa0049ded97d3103a300ca864c122b1d4c13197d2548c550"],["0x205078b5f99a3e041d75a8d3eb0cafe24da9649271275861bafbfa074a946f68","0x23c46a91322035df6f503929d00efc95ab970633c0b9cdd521f26831137ce398"]],"Galpha":["0x030cb162dc5bb2112b625de1cff121dc0e867068f496d3862d8d27e144c13c64","0x143e8abb0bcdb24417a01bc581bff336c2539f9b48c39c5b1447a5e4ca8a79c6"],"Hbeta":[["0x2e1a7b77ee31735d5b8dd25a032ea8bfda27c5905bec6d3ee3d0b01169ed7961","0x149b8fb268d495e15e642da2bd172791fd65bf9cdc49da8f1b16c34635ede869"],["0x2ccd66691257c87cdbd98efad37a0f60422a1e4d73dd2c18ebd87fc8522db9be","0x15437cb448e5bf0cf3067e2de941cf4ed73f6f732dac9cf19f0e89555f6d7a36"]],"Ggamma":["0x0c132ee8e18b7dd37a7332f6138d2c30826910652de0df3d188fe3597da2208d","0x2cced0ec0c467fac9b6774739b696d2fd1074cdef99da52c986838cea132bbe8"],"Hgamma":[["0x060ae04d4f50d8f01ca4fad8a29fd6d0d8f6eae762c1345bbebab3d8ca8cd993","0x0bb22b3de71c381a8bbd3b40633f3c2db119b75f5874a28bf4f221bae4fa9d73"],["0x13aa539b007374ee850da69ee1b91869ca4d64337a41e2cf4eaef844a28c251c","0x299c36c9cc3aab3c7df10bff199bb66c6d954dfa4ba30b5b33705a4b5bf0708e"]],"query":[["0x2ea45bf055ff829b0348d5c2b0619371de5835c0e28dd63c3d806aa06e3890f5","0x2aa391d2cb16b76693d1dfbbe0272861e38e7cf457f38d0f93d5a7751f3fa7a0"],["0x18c4fa762ba68bdaabb02658ad113cc22333107d73ebc0f508e4c4f2f5a3aaf2","0x075062f8a367e48fc22c99752a8e0211148462c8dab0c87d4c12c85545594e07"]]}}
      *** Running setup for createPO ***
      {"verificationKey":{"H":[["0x2d5f6d4b7d13b5cebd8d6cece9dbce5ecb04d3ea80217e0426c2b1d72c2d972d","0x02ff4a4667c3fead0b270277aba0fef1a8f2e94e85b160d19385c089ac7cf501"],["0x25ddb0f3266fc2b2efefa6247f24355a327353f6ccfb5ca9fb5ab1352370a21b","0x1c078f4b5447ef774133731e301b43a9c8657123409333efffa74486a86fb47f"]],"Galpha":["0x0d36fc5d69ce3f50ec40bb9d3540fb1d898a2f91d48932bf55cfcb304af635e3","0x1a555461b3ac218af5fca356d75b9d0eecce6bb8d44aab275141e1a980077a67"],"Hbeta":[["0x29a47d9266d3a915ba517cd2d099ef4872c568d86d69c63ff5fa55aa7a5f6284","0x1125edf840c07eda41a962f71f1e0d8b4c0052587c6b6918ebb3a267c43b6255"],["0x2d15aefb7f2a3374e28671f5b4b5dc1db80660656b16fd81953a6104a95b61ef","0x2e43d6f090a7402b948824568e69a956646a8ddc79eba4bfad65da4863663ce5"]],"Ggamma":["0x11cf0010dc05657a0933a3366efab90a055ef76c926af3c94cd79df0daace624","0x138c005e154787838b851afc869be363e089b2e3786c197c1a7a7f8023e2adcf"],"Hgamma":[["0x267470583b8333a4c8b81331d12d6badfd49c416810fd23006ec393f812c8a56","0x14321eed994c76846d2b8b532e7995d3cb76c022ab05af426a99e98a53076779"],["0x0cfcd3abdf0119481374bf209c71f7afcd8920b85de0e95294933ddd3c16c92a","0x23871104deb8a7c03efaf1ede048dd9f968b4602ea7f824a5c8d4aaa1e6f4143"]],"query":[["0x1a7251f3ac3930802d03eae0f4d8187a62bcf752b33cedd98defe74ddc07cd8f","0x06a13bbc659fae79a8e0ab7fa474d4ae451d42633116e42e17334ee21a847fc5"],["0x26620d77c65980fb18256ee17bc0e80adc30ddb4c54cd61154432d713889ea33","0x237af6ad935a45192f8a279e3543bca9b04aa547d16501c3c164c9ef38ad59c0"]]}}
      *** Setups complete ***
      ``` 
      </p>
    </details> 

5. Run `npm run build:contracts` to compile the smart contracts in `contracts/contracts` to JSON files (containing ABI and Bytecode key value pairs) in the `contracts/artifacts` folder needed for deployment. ** This takes less than 15 seconds to run **
6. Run `npm run deploy` to deploy the smart contracts. ** This takes about 2 minutes **
    - This docker container first deploys both the Registry contract and the OrgRegistry contract.
    - Then it registers (1) Buyer and (2) Supplier organizations. The corresponding `/config/config-${role}.json` files are updated with the newly deployed contract addresses.
    - The goal of deployment is to initialize the Radish34 system by pre-registering a buyer and 2 suppliers with an `OrgRegistry` smart contract, which holds the organization metadata to thus enable any ongoing procurement operations.
    - Essentially the deployment is based on deploying an `ERC1820Registry` client called the `Registrar`, followed by registering an interface for `OrgRegistry` with the `ERC1820Registry`, then registering the roles of the buyer and supplier with the `OrgRegistry`
    - In addition, the contracts that are necessary for privacy management, `Shield` and `Verifier` contract are deployed to the network
    - Any changes to the config files are updated in the individual db instances `mongo-${role}`
    <details> 
      <summary>Example logs</summary>
      <p> 

      ```
      [2020-05-20 13:41:05] [INFO] [DEPLOY]: ERC1820Registry deployed: 0x448de9B34ac4DD0901DCc3f2fF1a31822B51a397. 
      [2020-05-20 13:41:06] [INFO] [DEPLOY]: OrgRegistry deployed: 0x31088fd0eede771d5bda1558e06a666Cd9BF110c. 
      [2020-05-20 13:41:06] [INFO] [DEPLOY]: Verifier deployed: 0xDf3C747B74CeFe4ffEa5baa2D0eAFE2B0F86A8F3. 
      [2020-05-20 13:41:06] [INFO] [DEPLOY]: Shield deployed: 0x7370f1C710F3af6f28Be19ed99e0ed8f1B59b1CB. 
      [2020-05-20 13:41:06] [INFO] [DEPLOY]: Registering workgroup member: buyer.
      [2020-05-20 13:41:06] [INFO] [DEPLOY]: Registered buyer in the OrgRegistry with transaction hash: 0x0b5a4f46254f38c577ae825a7d4ba99538ad7a02cb5d17a7728bae51c24a585b. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered OrgRegistry as IOrgRegistry for buyer with transaction hash: 0x3ee64f6f3cac07525bb8679e36e77eea8302571ae535d9d715e495bed95b5501. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered Verifier as IVerifier for buyer with transaction hash: 0x3557222c9f37d466a97cbf8c2c9c24cf347b50b3e980eca4f4984e580a8b8314. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered Shield as IShield for buyer with transaction hash: 0xdd8da4e8de591e770e5f6b657298b4217726d44db10f5284436770cf03f30128. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Saving settings to config file for: buyer. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Updated settings in file /app/src/config/config-buyer.json. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Saved information about buyer:
      {
        rpcProvider: 'http://ganache:8545',
        organization: {
          name: 'Org 1',
          role: 1,
          zkpPublicKey: '0x15e365a0396f762f73d01cedffd525908093d0bfa5d1f6980670ce536b193f7e',
          zkpPrivateKey: '0x1f548aa7d67395da82addda4096d986314fc83c598302193b090f45a9b8d4aec',
          address: '0xB5630a5a119b0EAb4471F5f2d3632e996bf95d41',
          messengerKey: '0x04d5d2b119c8700f57497d707bf41cfd868a3c454520635e82082618377b479cccd4e663bf4966d85c18a688f35f57c644cd6947020756cf10b3d31cb15eb0a1cb'
        },
        addresses: {
          ERC1820Registry: '0x448de9B34ac4DD0901DCc3f2fF1a31822B51a397',
          OrgRegistry: '0x31088fd0eede771d5bda1558e06a666Cd9BF110c',
          Verifier: '0xDf3C747B74CeFe4ffEa5baa2D0eAFE2B0F86A8F3',
          Shield: '0x7370f1C710F3af6f28Be19ed99e0ed8f1B59b1CB'
        }
      }. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registering workgroup member: supplier1.
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered supplier1 in the OrgRegistry with transaction hash: 0x8a5e8879f2a57878bdcbc75efc3b420ba19eac205373b66ff4d8de7359596ced. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered OrgRegistry as IOrgRegistry for supplier1 with transaction hash: 0x24ccf076392d6cc4aa394a0d83ea27a3b11d01ae77c8ed39aa8d36d77c6bb40f. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered Verifier as IVerifier for supplier1 with transaction hash: 0xc40de8e3491599fe31bb42f57c557d6a9e7dd0c4b277d712410dda1d6c55c715. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registered Shield as IShield for supplier1 with transaction hash: 0xeae3c7a0edf0f29f21ecf9d7dcc79ceffc691c9d24bb52363580676e2dca7df7. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Saving settings to config file for: supplier1. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Updated settings in file /app/src/config/config-supplier1.json. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Saved information about supplier1:
      {
        rpcProvider: 'http://ganache:8545',
        organization: {
          name: 'Supplier 1',
          role: 2,
          zkpPublicKey: '0x9ad6a84232565704ec7b3c89fdb4e983d7f3c107fd70e0eaa99682a581cf3bf2',
          zkpPrivateKey: '0xb8ce0427c5ebe896787631dec285b3ada387a3597202cabe43b0cac20f4d3a6',
          address: '0x5ACcdCCE3E60BD98Af2dc48aaf9D1E35E7EC8B5f',
          messengerKey: '0x040547e919361631b8a1a13d3f3797e9c30cc44fa4010c923a0be0d4eaa8a019c4584eb4d884aa7464b157ee5dfcc891a6f222d1fc83c82ba8d8bcd313dc7d5af1'
        },
        addresses: {
          ERC1820Registry: '0x448de9B34ac4DD0901DCc3f2fF1a31822B51a397',
          OrgRegistry: '0x31088fd0eede771d5bda1558e06a666Cd9BF110c',
          Verifier: '0xDf3C747B74CeFe4ffEa5baa2D0eAFE2B0F86A8F3',
          Shield: '0x7370f1C710F3af6f28Be19ed99e0ed8f1B59b1CB'
        }
      }. 
      [2020-05-20 13:41:07] [INFO] [DEPLOY]: Registering workgroup member: supplier2.
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Registered supplier2 in the OrgRegistry with transaction hash: 0xb8e09bbfedfddc939d8d03898dfe45055b2684de70785f8b5679ab90b2c41d73. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Registered OrgRegistry as IOrgRegistry for supplier2 with transaction hash: 0xb19c3291ceb5cc4d6f5c501897881adfb9ab627f1ea28628a79520b84507b364. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Registered Verifier as IVerifier for supplier2 with transaction hash: 0x7ce3b1558d80501d2bbaa88aad481824d77ca18bb8467ba5139010cb08a85faa. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Registered Shield as IShield for supplier2 with transaction hash: 0x0feebf13e67015f3cb6f3216812272ae5cc70ddaff073ddd38b8afa157964602. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Saving settings to config file for: supplier2. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Updated settings in file /app/src/config/config-supplier2.json. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Saved information about supplier2:
      {
        rpcProvider: 'http://ganache:8545',
        organization: {
          name: 'Supplier 2',
          role: 2,
          zkpPublicKey: '0x9e7a93433acadb679c2d461ecb24d2d8ddb928f704e489a2d40dd55e9983399e',
          zkpPrivateKey: '0x264aad417c103f31ecee06d7b5bbb8bc89af9976cfea2f10e3d6aa5dfc223c6b',
          address: '0x3f7eB8a7d140366423e9551e9532F4bf1A304C65',
          messengerKey: '0x04b9a6f22f722aa75d0884b7ff78a18516f22bbad9c4d6f26fcd10262a46d28ad5ad28cb0a0695afbaf235503c49d9ff220206eada89c5a1f6f8d7fc9b8f27e7f4'
        },
        addresses: {
          ERC1820Registry: '0x448de9B34ac4DD0901DCc3f2fF1a31822B51a397',
          OrgRegistry: '0x31088fd0eede771d5bda1558e06a666Cd9BF110c',
          Verifier: '0xDf3C747B74CeFe4ffEa5baa2D0eAFE2B0F86A8F3',
          Shield: '0x7370f1C710F3af6f28Be19ed99e0ed8f1B59b1CB'
        }
      }. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Registered the Radish34 interface in the OrgRegistry with transaction hash: 0xe60f9406ae47c6eebc07bd874e122bebf7ffff238eab89de13aed1894ee1759c. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Registering zkp verification keys. 
      [2020-05-20 13:41:08] [INFO] [DEPLOY]: Polling... 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Registered verification key for createMSA with transaction hash: 0xe7b37aaafcb57fd4c13d130f9a26145f7fec2771083ad26c50dcfed32d00241c. 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Polling... 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Registered verification key for createPO with transaction hash: 0xb05f19d6c34955913b6c1a99028cc34018040e2d5c39c086bc7405bbe2cb9dbe. 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Network information: 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Radish network of 3 organizations have successfully been set up! 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Information about buyer: 
        Organisation Address: 0xB5630a5a119b0EAb4471F5f2d3632e996bf95d41
        Organisation Name: Org 1
        Organisation Role: 1
        Organisation MessagingKey: 0x04d5d2b119c8700f57497d707bf41cfd868a3c454520635e82082618377b479cccd4e663bf4966d85c18a688f35f57c644cd6947020756cf10b3d31cb15eb0a1cb
        Organisation zkpPublicKey: 0x15e365a0396f762f73d01cedffd525908093d0bfa5d1f6980670ce536b193f7e 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Information about supplier1: 
        Organisation Address: 0x5ACcdCCE3E60BD98Af2dc48aaf9D1E35E7EC8B5f
        Organisation Name: Supplier 1
        Organisation Role: 2
        Organisation MessagingKey: 0x040547e919361631b8a1a13d3f3797e9c30cc44fa4010c923a0be0d4eaa8a019c4584eb4d884aa7464b157ee5dfcc891a6f222d1fc83c82ba8d8bcd313dc7d5af1
        Organisation zkpPublicKey: 0x9ad6a84232565704ec7b3c89fdb4e983d7f3c107fd70e0eaa99682a581cf3bf2       
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Information about supplier2: 
        Organisation Address: 0x3f7eB8a7d140366423e9551e9532F4bf1A304C65
        Organisation Name: Supplier 2
        Organisation Role: 2
        Organisation MessagingKey: 0x04b9a6f22f722aa75d0884b7ff78a18516f22bbad9c4d6f26fcd10262a46d28ad5ad28cb0a0695afbaf235503c49d9ff220206eada89c5a1f6f8d7fc9b8f27e7f4
        Organisation zkpPublicKey: 0x9e7a93433acadb679c2d461ecb24d2d8ddb928f704e489a2d40dd55e9983399e      
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: ----------------- Deployment completed  ----------------- 
      [2020-05-20 13:41:09] [INFO] [DEPLOY]: Please restart the radish-apis for the config to take effect.
      ```
      </p>
    </details> 

7. Run `docker-compose up -d && docker-compose restart`
   - This will reinstate and restart all `radish` containers
   - Wait about 10 seconds to give containers time to complete their initialization routines
   - Run `docker-compose logs -f {SERVICE_NAME}` to check the logs of specific containers. Key ones to watch are api-{role} and ui. For example: `docker-compose logs -f api-buyer api-supplier1 api-supplier2 ui`
    <details> 
      <summary>Example api-buyer logs</summary>
      <p> 

      ```
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Conntected to mongo db. 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Mongoose connected to db. 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Loading config file ... 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Internal REST based express server listening at http://localhost:8101. 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Loading network http://ganache:8545... 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Whisper key: 0x04d5d2b119c8700f57497d707bf41cfd868a3c454520635e82082618377b479cccd4e663bf4966d85c18a688f35f57c644cd6947020756cf10b3d31cb15eb0a1cb. 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Loading wallet with address 0xB5630a5a119b0EAb4471F5f2d3632e996bf95d41. 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Connected to network: { chainId: 333, name: 'unknown' } 
      api-buyer              | [2020-05-20 13:45:18] [INFO] [API]: Wallet balance: 999.9970356. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Your organization has already been registered with the registry. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: All systems go. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Healthcheck Status: ready. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Server ready at http://localhost:8001/graphql. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Subscriptions ready at ws://localhost:8001/graphql. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Starting the merkle-tree microservice's event filters ... 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: contractAddress: 0x7370f1C710F3af6f28Be19ed99e0ed8f1B59b1CB. 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Polling... 
      api-buyer              | [2020-05-20 13:45:19] [INFO] [API]: Calling /start(Shield). 
      api-buyer              | [2020-05-20 13:45:19] [HTTP] [API]: 200 4ms HEAD /health
      api-buyer              | [2020-05-20 13:45:31] [INFO] [API]: Response from merkle-tree microservice for Shield:
      api-buyer              | { message: 'filter started' } 
      api-buyer              | [2020-05-20 13:45:34] [HTTP] [API]: 200 1ms HEAD /health
      ```
      </p>
    </details> 

8. Run integration tests: `npm run test`. ** This takes about 3-5 minutes to run to completion **
    <details> 
      <summary>Example logs</summary>
      <p> 

      ```
      > NODE_ENV=test jest --verbose --runInBand --forceExit
        
        console.log __tests__/integration.test.js:487
          Waiting for new MSA commitment in Shield contract. This can take up to 5 minutes...

        console.log __tests__/integration.test.js:490
          Checking for non-null MSA index, attempt: 0

        console.log __tests__/integration.test.js:490
          Checking for non-null MSA index, attempt: 1

        console.log __tests__/integration.test.js:490
          Checking for non-null MSA index, attempt: 2

        console.log __tests__/integration.test.js:490
          Checking for non-null MSA index, attempt: 3

        console.log __tests__/integration.test.js:495
          ...MSA commitment test complete.

        console.log __tests__/integration.test.js:527
          Buyer creating new PO for Supplier2. This test takes a few minutes...

      PASS  __tests__/integration.test.js (154.892s)
        Get organization settings from config files
          ✓ Buyer config retrieved (2ms)
          ✓ Supplier1 config retrieved (1ms)
          ✓ Supplier2 config retrieved
        Check that containers are ready
          Buyer containers
            ✓ Buyer messenger GET /health returns 200 (28ms)
            ✓ Buyer radish-api REST server GET /health returns 200 (19ms)
          Supplier1 containers
            ✓ Supplier1 messenger GET /health returns 200 (7ms)
            ✓ Supplier1 radish-api REST server GET /health returns 200 (21ms)
          Supplier2 containers
            ✓ Supplier2 messenger GET /health returns 200 (5ms)
            ✓ Supplier2 radish-api REST server GET /health returns 200 (15ms)
        Buyer sends new RFP to both suppliers
          Retrieve identities from messenger
            ✓ Buyer messenger GET /identities (7ms)
            ✓ Supplier2 messenger GET /identities (7ms)
          Create new RFP through buyer radish-api
            ✓ Buyer graphql mutation createRFP() returns 400 withOUT sku (75ms)
            ✓ Buyer graphql mutation createRFP() returns 200 (101ms)
          Check RFP existence through radish-api queries
            ✓ Buyer graphql query rfp() returns 200 (32ms)
            ✓ Supplier1 graphql query rfp() returns 200 (2115ms)
            ✓ Supplier2 graphql query rfp() returns 200 (106ms)
          Check that RFP creation messages exists in messenger databases
            ✓ Buyer messenger has raw message that delivered RFP to supplier1 (29ms)
            ✓ Buyer messenger has raw message that delivered RFP to supplier2 (17ms)
            ✓ Supplier1 messenger has raw message that delivered RFP from buyer (9ms)
            ✓ Supplier2 messenger has raw message that delivered RFP from buyer (8ms)
        Supplier2 sends new Proposal to buyer
          Create new Proposal through supplier2 radish-api
            ✓ Supplier2 graphql mutation createProposal() returns 200 (43ms)
          Check Proposal existence through radish-api queries
            ✓ Supplier2 graphql query proposal() returns 200 (23ms)
            ✓ Buyer graphql query proposal() returns 200 (3062ms)
        Buyer creates MSA, signs it, sends to Supplier2, Supplier2 responds with signed MSA
          Buyer creates new MSA for Supplier2 through radish-api
            ✓ Buyer graphql mutation createMSA() returns 400 without sku (16ms)
            ✓ Buyer graphql mutation createMSA() returns 200 (411ms)
            ✓ After a while, the commitment index should not be null (60153ms)
        Buyer creates PO for Supplier2 based on MSA
          Create new PO through buyer radish-api
            ✓ Buyer graphql mutation createPO() returns 400 without volume (12ms)
            ✓ Buyer graphql mutation createPO() returns 200 (86207ms)

      Test Suites: 1 passed, 1 total
      Tests:       28 passed, 28 total
      Snapshots:   0 total
      Time:        154.941s
      Ran all test suites.
      ```
      </p>
    </details> 

9. Within about 5 minutes, UI is loaded on `http://localhost:3000` on your local browser

## Collection of Log Commands

`docker-compose logs -f ui`  
`docker-compose logs -f zkp`
`docker-compose logs -f api-buyer`  
`docker-compose logs -f api-supplier1`
`docker-compose logs -f api-supplier2`
`docker-compose logs -f messenger-buyer`
`docker-compose logs -f messenger-supplier1`
`docker-compose logs -f messenger-supplier2`       
`docker-compose logs -f mongo-buyer`
`docker-compose logs -f mongo-supplier1`
`docker-compose logs -f mongo-supplier2`  
`docker-compose logs -f geth-node`   
`docker-compose logs -f geth-miner1`  
`docker-compose logs -f geth-miner2`  
`docker-compose logs -f geth-bootnode`

Access docker container via `docker exec -it <container_id> /bin/bash` and read logs in `/app/logs` via `cat <log_name>`.

## Troubleshooting

1. If you get errors during the `npm i` step, please ensure that you are running node version `11`. The `nvm` (node version manager) tool allows you to easily switch between versions:
```
nvm install 11
nvm use 11
```

2. Restart the test environment
   - Run `docker-compose down` to stop containers
   - Run this command to give the docker command a clean slate: `docker volume prune -f && echo volume pruned && docker system prune -f && echo system pruned && docker network prune -f && echo network pruned`
   - In some cases, due to stale images application may have build issues owing to existing images and packages that were a part of those builds. To get around such issues, run `docker-compose build --no-cache` to run a clean re-build of the docker images
   - Run through the 'steps to start the application' in __Development/Test Environment__
3. Increasing resource allocation for Docker
   - During set up, `npm run setup-circuits`, there are cases where the setup instruction might fail, and the logs of the `zkp` container (`docker-compose logs -f zkp`) throws babel compilation errors. This is due to the memory consumption needed for running the compute intensive set up process. In these cases, it is recommended to toggle memory and CPU cores consumption
   - Consider these steps if you are running many of the `radish` containers and your PC is bogged down
   - Check the memory usage by running `docker stats`
   - If the containers are using most of the RAM allocated to Docker, you can increase RAM available to Docker by clicking the Docker Desktop icon in the task bar. Choose `Preferences --> Advanced`, then increase `Memory` to a recommended `12.5GiB` (default is `2.0GiB`). Although not required in all cases, it is recommended to increase the swap memory to 4GB and CPU cores to 8 on Docker Preferences/Settings. It is also worth noting that due to Docker overhead (<0.5GB), you will not get to use 100% of the RAM allocated to Docker to run Baseline.
4. Running tests
   - In some cases, while running the test suite `npm run test` there could be a socket hang up error. This is potentially due to race conditions across the different containers for the API services. To resolve this issue run `docker-compose restart api-buyer api-supplier1 api-supplier2` to get rid of errors while running the test suite.

1. Check health of the containers. Running `docker ps` will show all the containers for the Radish34 demo and if they are healthy or not. To inspect the health check results of a container run the following `docker inspect --format='{{json .State.Health}}' your-container-name`

### Front-end Environment

1. When the above setup is run successfully, the UI is ready at `http://localhost:3000`
2. Typically, this process takes about a minute to two. Successful loading of UI at the url can be inspected based on the logs of the `ui` container.
    <details> 
      <summary>Example logs</summary>
      <p> 

      ```
      Compiled successfully!
      radish34-ui            | 
      radish34-ui            | You can now view radish34-ui in the browser.
      radish34-ui            | 
      radish34-ui            |   Local:            http://localhost:3000
      radish34-ui            |   On Your Network:  http://172.27.0.14:3000
      radish34-ui            | 
      radish34-ui            | Note that the development build is not optimized.
      radish34-ui            | To create a production build, use npm run build.
      radish34-ui            | 
      ```
      </p>
    </details> 
