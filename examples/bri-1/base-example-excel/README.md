# shuttle-app

## Overview

[**Provide**](https://provide.services/) has contributed a complete reference implementation of the core interfaces as specified in the v0.1.0 release of the [Baseline Protocol](https://baseline-protocol.org/). This reference implementation will inform the OASIS standard.

The reference implementation runs on the Ethereum Ropsten testnet and can be configured to run on many other public or permissioned EVM-based blockchains; a complete list of supported Ethereum clients will be curated over the coming months.

## Running Locally

Run the following to install local packages and run the test suite against the Ropsten testnet:

```
npm install
npm test
```

In a separate terminal window, run the following command to view all container logs while the tests are running:

```
make logs
```

## Provide Architecture

‌The Provide stack is a containerized microservices architecture written in Golang. The core microservices depend on NATS, NATS streaming, PostgreSQL and Redis. Note that the NATS server component is a [fork](https://github.com/kthomas/nats-server) that supports decentralized, ephemeral bearer authorization using signed JWTs.

![](https://gblobscdn.gitbook.com/assets%2F-MBA_rcUTy5_dw26I_Hw%2F-MFBjZgx01uyHt7tN0Em%2F-MFBjbrOKLq2F69PGZ9k%2Fprovide-platform.png?alt=media&token=cbe4dbf9-56e5-4311-9e2b-73130595d2bd)
<sup>The core Provide microservices architecture fully-implements the Baseline Protocol spec.</sup>

### Core Microservices

**Ident** provides identity and authorization services for applications (i.e., workgroups in the context of the Baseline Protocol), organizations and users. Read more about how authorization works [here](/@provide/s/shuttle/baseline/reference-implementation#authorization).

[**Vault**](https://docs.provide.services/vault) provides key management for traditional symmetric and asymmetric encrypt/decrypt and sign/verify operations in addition to support for elliptic curves required for advanced messaging and privacy applications.

**NChain** provides [various APIs](https://docs.provide.services/api/c2/container-runtime) for building decentralized applications and deploying and managing peer-to-peer infrastructure. The service also provides daemons for (i) monitoring reachability of network infrastructure and (ii) creating durable, real-time event and analytics streams by subscribing to various networks (i.e., EVM-based block headers and log events).

### Dependencies

‌Each microservice has an isolated PostgreSQL database; each service connects to a configured PostgreSQL endpoint with unique credentials. When running the stack locally (i.e., via `docker-compose`), each isolated database runs within a single PostgreSQL container.

NATS and NATS streaming are used as a fault-tolerant messaging backplane to dispatch and scale idempotent tasks asynchronously. Each NATS subject is configured with a `ttl` for the specific message type which will be published to subscribers of the subject; if no positive acknowledgement has been received for a redelivered message when its `ttl` expires, the message will be negatively acknowledged and dead-lettered.

Redis is used to cache frequently-updated and frequently-accessed key/value pairs (i.e., real-time network metrics).

### Authorization

Each microservice requires the presence of a `bearer` API token to authorize most API calls. A `bearer` API token is an encoded JWT which contains a subject claim (`sub`) which references the authorized entity (i.e., a `User`, `Application` or `Organization`). The encoded JWT token will, in most cases, include an expiration (`exp`) after which the token is no longer valid. Tokens issued without an expiration date (i.e., certain machine-to-machine API tokens) can be explicitly revoked. The standard and application-specific JWT claims are signed using the `RS256` algorithm. The authorized entity may use the signed bearer `Token` to access one or more resources for which the `Token` was authorized. Unless otherwise noted, all API endpoints require the presence of a bearer `Authorization` header.

## Baseline Architecture

This implementation of the Baseline Protocol leverages the Provide stack for security (i.e., authn and authz), managing key material, signing transactions, subsidizing transaction fees  (i.e., if a gas/subsidy faucet is configured at runtime), etc. The various APIs provided by the core Provide microservices fully-implement the interfaces defined in the Baseline Protocol specification (i.e., `IRegistry` and `IVault` interfaces, for example).

![](https://gblobscdn.gitbook.com/assets%2F-MBA_rcUTy5_dw26I_Hw%2F-MFEky36z84VRzzAjcR7%2F-MFElMJLPxwJiW6Xfj8d%2Fprovide-platform-baseline-protocol-architecture.png?alt=media&token=0ab0ed1f-4ca3-4e68-8c63-45f4ec4b99b3)

‌As illustrated above, NATS is used to facilitate the handling of inbound and outbound protocol messages; in the context of the Baseline Protocol, NATS acts as a control plane to route inbound protocol messages to an appropriate asynchronous handler. Such handlers could, for example, ensure `BLINE` protocol messages represent verifiable, valid state transitions (i.e., as governed by the business process and privacy protocol) prior to updating _baselined_ records within a system of record such as SAP or Microsoft Dynamics.

### Messaging

This reference implementation provides a complete, robust implementation of the Baseline Protocol specification; it is important to note that a subset of the specification can be implemented using the core concepts demonstrated in this reference implementation without depending on the entire Provide stack.

For example, implementing only NATS as a control plane for dispatching inbound protocol messages is possible using only the `@baseline-protocol/messaging` package. In such a case, the entire protocol as demonstrated within this reference implementation would be far from complete, but protocol messages could start being sent and delivered, for example.

### API

_Documentation forthcoming._

### Privacy

_Documentation forthcoming._

### Types

_Documentation forthcoming._

## Alice & Bob

The reference implementation illustrates Alice & Bob, respective owners of Alice Corp and Bob Corp, establishing a workgroup and _baselining_ an in-memory record (i.e., a JSON object) using the Provide stack.

The following high-level architecture diagram illustrates how the concepts discussed in previous sections (i.e., the [Provide](/@provide/s/shuttle/baseline/reference-implementation#provide-architecture) and [Baseline](/@provide/s/shuttle/baseline/reference-implementation#baseline-architecture) architecture sections) fit together in the context of two organizations deploying the Baseline Protocol using Provide as a common technology stack and their own cloud infrastructure vendors (i.e., AWS and Azure). The reference implementation deploys these same two distinct stacks to your local machine using `docker-compose` when running the test suite.

![](https://gblobscdn.gitbook.com/assets%2F-MBA_rcUTy5_dw26I_Hw%2F-MFEzy6Xs7Zt3tNSl0ZR%2F-MFF14bT8o62oCH1Hefc%2Fimage.png?alt=media&token=cb1c432e-3025-4f57-99ba-64a2d7e59b2d)
<sup>This reference implementation supports cloud-agnostic experiments out-of-the-box.</sup>

### Initiating the Workgroup

Bob is designated as the initiator of the workgroup and the end-to-end test suite makes assertions as Bob Corp deploys the ERC1820 organization registry contract to the Ropsten testnet, compiles and performs the trusted setup of a zero-knowledge circuit to govern an initial business process among workgroup participants and invites Alice to join the workgroup.

### Decoded Workgroup Invitation JWT

The following JSON object represents the decoded invitation JWT signed by Bob Corp and delivered to Alice. The invitation has everything Alice needs to join Bob's new Baseline workgroup, register Alice Corp with the on-chain `OrgRegistry` contract and use the protocol to synchronize her local Provide stack.

```
{
  "aud":"https://provide.services/api/v1",
  "exp":1598074664,
  "iat":1597988264,
  "iss":"https://ident.provide.services",
  "jti":"6341cb1b-823c-4308-a3c3-48e2d21a1f12",
  "nats":{
    "permissions":{
      "subscribe":{
        "allow":[
          "network.*.connector.*",
          "network.*.status",
          "platform.>"
        ]
      }
    }
  },
  "prvd":{
    "data":{
      "application_id":"b9ad090b-8d3b-4840-a6cf-5e644b242510",
      "email":"alice1597987999175@baseline.local",
      "first_name":null,
      "invitor_id":"33cec010-8950-4dc9-b1cc-b18550769d03",
      "invitor_name":"Bob Baseline",
      "last_name":null,
      "organization_id":null,
      "organization_name":null,
      "params":{
        "erc1820_registry_contract_address":"0x90D50ab6B999d87AD0F10E9ac4479Cc3faa95FF7",
        "invitor_organization_address":"0x5D42A0791dfFf981e9873A4C96a7B3BF4ece6095",
        "organization_registry_contract_address":"0xddF48Bc68e8fE031f3799E67fAF412aD43e3Af78",
        "shield_contract_address":"0xf2e246bb76df876cef8b38ae84130f4f55de395b",
        "verifier_contract_address":"0xAaBcF47EA01800892954131F73aC1105C734C846",
        "workflow_identifier":"59e0ab88-1d7f-4e3c-aa87-856fedbdd544"
      },
      "user_id":null
    },
    "permissions":0
  },
  "sub":"invite:alice1597987999175@baseline.local"
}
```

### Accepting the Workgroup Invitation

‌Alice accepts the invitation and synchronizes with the on- and off-chain state of the workgroup. Following Alice's acceptance of Bob's invitation on behalf of Alice Corp, both organizations have been registered with the on-chain `OrgRegistry` contract; both organizations are running their own local, off-chain copy of the organization registry, workgroup contracts registry and merkle tree database.
