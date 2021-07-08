# Zether
Private transactions on Qtum blockchain via smart contracts.

This project implements the research paper [Zether:  Towards Privacy in a Smart Contract World](https://crypto.stanford.edu/~buenz/papers/zether.pdf) by referencing [JP Morgan's implementation](https://github.com/jpmorganchase/anonymous-zether) and provides a way to execute private transactions on the Qtum chain. 

Zether is an private value-tracking system, in which a smart contract maintains encrypted account balances. Each Zether Smart Contract (ZSC) must, upon deployment, "attach" to some already-deployed QRC-20 contract; once deployed, this contract establishes special "Zether" accounts into / out of which users may deposit or withdraw QRC-20 funds. Having credited funds to a Zether account, its owner may privately send these funds to other Zether accounts, confidentially (transferred amounts are private) and anonymously (identities of transactors are private). Only the owner of each account's secret key may spend its funds, and overdraws are impossible.


For a high level theoretical overview of how Zether works and it's performance with Qtum, please check the [accompanying blog post](https://medium.com/@siddhanjay/private-and-anonymous-transactions-on-qtum-blockchain-2d84f573d0b0).To understand the working principles with further details, please read the [Zether paper](https://crypto.stanford.edu/~buenz/papers/zether.pdf)

The project also implements a node.js client which can be used to simulate the entire process of minting tokens,depositing to Zether , transferring an amount privately and withdrawing funds while also adding multiple accounts in your friend(anonymity) set.


## Getting Started

To use Zether for private transfers of Qtum tokens, the Zether smart contracts need to be deployed first on Qtum.
Alternatively, you can use the pre-deployed contracts on the testnet as listed [here](https://github.com/siddhanjay/zether/tree/master/src/contract-artifacts/artifacts)


### Prerequisites

Softwares that need to be installed to deploy and run:

* [Solc](https://github.com/ethereum/solidity) - Solidity compiler
* [Solar](https://github.com/qtumproject/solar) - Smart contract deployment on Qtum
* Qtumd - Run a qtum node
* [npm](https://www.npmjs.com/) - package manager
* [node.js](https://nodejs.org/en/) - For the demo client

### Usage instructions

1. Compiling the contracts :

There are 4 contracts that need to be compiled and deployed , namely ZetherVerifier.sol, CashToken.sol,BurnVerifier.sol and ZSC.sol
Compile each of them with ```solc contract_name.sol ``` 

2. Start the Qtum node on testnet with username:password as hello:hello

```sudo qtumd -testnet -rpcuser=hello -rpcpassword=hello```

Note: The contact deployment doesn't work with the Qtum docker image as it used an outdated solidity compiler.

3. Use solar to deploy all the contracts (set the contract deployer address first ```export QTUM_SENDER=your_address``` 

```solar deploy softwares/zether/packages/protocol/contracts/ZetherVerifier.sol```

```solar deploy softwares/zether/packages/protocol/contracts/CashToken.sol```

```solar deploy softwares/zether/packages/protocol/contracts/ZSC.sol '["zether_verifier_address","cashtoken_address",epoch length]'```

  Epoch length of atleast 4 is recommended.

4. Install dependencies for the client demo 
``` npm install```

5. Update the sender address in [index.js](https://github.com/siddhanjay/zether/blob/master/src/example/index.js)

6. Run the demo client
``` node src/example/```


## Demo client

The node.js demo client performs 4 operations. 
1. It firsts mints and approves a few ZSC tokens for your address. 
2. Makes a deposit to Zether contract
3. Adds a few public addresses in the friend's anonymity set.
   Observers outside this set won't be able to distinguish between the transacting parties.
4. Transfers a few ZSC tokens to a friend
5. Withdraw the remaing ZSC to get back Qtum tokens

