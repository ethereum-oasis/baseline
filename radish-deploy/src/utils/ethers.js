const fs = require('fs');
const { ethers, utils } = require('ethers');
const { BigNumber } = require('ethers/utils');

let instance = null;
let networkId = null;

const getProvider = uri => {
  if (instance) return instance;
  instance = new ethers.providers.JsonRpcProvider(uri);
  return instance;
};

const getDefaultProvider = async uri => {
  if (networkId === uri && instance) {
    return instance;
  }
  networkId = uri;
  instance = ethers.getDefaultProvider(uri);
  return instance;
};

const getWallet = (uri, privateKey) => {
  if (!privateKey) throw new ReferenceError('No key provided for getWallet');
  const provider = getProvider(uri);
  return new ethers.Wallet(privateKey, provider);
};

const getSigner = address => {
  if (!address) throw new ReferenceError('No address provided for getSigner');
  const provider = getProvider();
  return provider.getSigner(address);
};

const sendSignedTransaction = async signedTransaction => {
  const provider = getProvider();
  const transaction = await provider.sendTransaction(signedTransaction);
  return provider.getTransactionReceipt(transaction.hash);
};

const getContractMetadata = filepath => JSON.parse(fs.readFileSync(filepath, 'utf8'));

const deployContract = async (contractFilepath, uri, privateKey, controllerAddress) => {
  const wallet = getWallet(uri, privateKey);
  let contract;

  const contractJson = getContractMetadata(contractFilepath);

  const factory = new ethers.ContractFactory(
    contractJson.compilerOutput.abi,
    contractJson.compilerOutput.evm.bytecode,
    wallet,
  );
  if (!controllerAddress) {
    contract = await factory.deploy();
  } else {
    contract = await factory.deploy(controllerAddress);
  }
  const { address } = contract;
  const { hash } = contract.deployTransaction;
  return { address: address, hash: hash };
};

const getUnsignedContractDeployment = (contractJson, args = []) => {
  const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode);

  const transaction = factory.getDeployTransaction(...args);
  return transaction.data;
};

const getContract = (contractJson, uri, address) => {
  try {
    const provider = getProvider(uri);
    return new ethers.Contract(address, contractJson.compilerOutput.abi, provider);
  } catch (e) {
    console.log('Failed to instantiate compiled contract', e);
  }
  return null;
};

const getContractWithWallet = (contractJson, contractAddress, uri, privateKey) => {
  let obt = null;
  try {
    const provider = getProvider(uri);
    const wallet = new ethers.Wallet(privateKey, provider);
    obt = new ethers.Contract(contractAddress, contractJson.compilerOutput.abi, provider);
    const contractWithWallet = obt.connect(wallet);
    return contractWithWallet;
  } catch (e) {
    console.log('Failed to instantiate compiled contract', e);
  }
  return obt;
};

const parseBigNumbers = object => {
  const output = { ...object };
  const entries = Object.entries(output);
  entries.forEach(([key, value]) => {
    if (key === '_hex') {
      output[key] = parseInt(value, 16);
    }
    if (value instanceof BigNumber) {
      output[key] = value.toNumber();
    }
  });
  return output;
};

const parseBigNumbersToIntArray = object => {
  const array = [];
  for (let i = 0; i < object.length; i += 1) {
    array.push(object[i].toNumber());
  }
  return array;
};

const parseBytes32ToStringArray = object => {
  const array = [];
  for (let i = 0; i < object.length; i += 1) {
    array.push(utils.parseBytes32String(object[i]));
  }
  return array;
};

const removeNumericKeys = obj => {
  if (typeof obj !== 'object') {
    throw new TypeError('Received something other than an object');
  }
  if (Array.isArray(obj)) {
    throw new TypeError('Received an array');
  }

  const newObject = {};
  const validKeys = Object.keys(obj).filter(key => Number.isNaN(Number(key)));
  validKeys.forEach(key => {
    newObject[key] = obj[key];
  });
  return newObject;
};

const getEvents = async (uri, contract, options) => {
  const { fromBlock = 0, toBlock = 'latest', topics } = options;

  const provider = getProvider(uri);

  const parsedTopic = topics ? ethers.utils.id(contract.interface.events[topics].signature) : null;

  const events = await provider.getLogs({
    fromBlock,
    toBlock,
    address: contract.address,
    topics: [parsedTopic],
  });

  const parsedEventData = events.map(log => contract.interface.parseLog(log));

  const combinedEventData = events.map((event, index) => {
    return {
      ...event,
      name: parsedEventData[index].name,
      values: parsedEventData[index].values,
    };
  });

  const output = combinedEventData.map(event => {
    return {
      ...event,
      values: removeNumericKeys(event.values),
    };
  });
  return output;
};

const retrieveEvents = (fromBlock, toBlock, eventType) => {
  let topics = eventType;
  if (eventType === 'allEvents') {
    topics = null;
  }
  const options = {
    fromBlock: fromBlock,
    toBlock: toBlock,
    topics: topics,
  };
  return getEvents(options);
};

const getTransactionCount = async (uri, address) => {
  const provider = getProvider(uri);
  const transactionCount = await provider.getTransactionCount(address);
  return transactionCount;
};

const getSignedTransaction = async (transaction, uri, privateKey) => {
  const wallet = await getWallet(uri, privateKey);
  const tx = {
    ...transaction,
    gasLimit: transaction.gasLimit || 100000000,
    nonce: transaction.nonce || (await getTransactionCount(uri, wallet.address)),
  };
  return wallet.sign(tx);
};

const getAccounts = async uri => {
  return getProvider(uri).listAccounts();
};

module.exports = {
  getProvider,
  getDefaultProvider,
  getWallet,
  getSigner,
  sendSignedTransaction,
  deployContract,
  getUnsignedContractDeployment,
  getContract,
  parseBigNumbers,
  getEvents,
  getSignedTransaction,
  getTransactionCount,
  getAccounts,
  retrieveEvents,
  getContractWithWallet,
  removeNumericKeys,
  parseBigNumbersToIntArray,
  parseBytes32ToStringArray,
  getContractMetadata,
};