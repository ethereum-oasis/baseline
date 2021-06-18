const { ethers, utils } = require('ethers');
const { BigNumber } = require('ethers/utils');
const { logger } = require('radish34-logger');
import { IBlockchainService} from '@baseline-protocol/api';

let instance = null;
let networkId = null;

const getProvider = uri => {
  if (instance) return instance;
  instance = new IBlockchainService.rpcExec(uri);
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

const deployContract = async (contractJson, uri, privateKey, controllerAddress) => {
  const wallet = getWallet(uri, privateKey);
  let contract;
  const factory = new ethers.ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
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
    return new ethers.Contract(address, contractJson.abi, provider);
  } catch (error) {
    logger.error('Failed to instantiate compiled contract.\n%o', error, { service: 'API' });
  }
  return null;
};

const getContractWithWallet = (contractJson, contractAddress, uri, privateKey) => {
  let contract = null;
  try {
    const provider = getProvider(uri);
    const wallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, contractJson.abi, provider);
    const contractWithWallet = contract.connect(wallet);
    return contractWithWallet;
  } catch (error) {
    logger.error('Failed to instantiate compiled contract.\n%o', error, { service: 'API' });
  }
  return contract;
};

const parseBigNumbers = object => {
  const output = { ...object };
  const entries = Object.entries(output);
  entries.forEach(([key, value]) => {
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

/**
 * Parses an event log for a particular eventName, and returns the values.
 *
 * @param {string} eventName - event to pull from the logs
 * @param {Object} contract - an ethers contract instance i.e. `const contract = new ethers.Contract(...)`
 * @param {Object} txReceipt - not to be confused with an ethers transaction response.
 * @returns {Object}
 */
const getEventValuesFromTxReceipt = (eventName, contract, txReceipt) => {
  const { logs } = txReceipt;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const logDescription = contract.interface.parseLog(log);
    if (logDescription && logDescription.name === eventName) {
      let { values } = logDescription;
      values = removeNumericKeys(values); // values contains duplicate numeric keys for each event parameter.
      values = parseBigNumbers(values); // convert uints (returned as BigNumber) to numbers.

      logger.debug(`Event '${eventName}' and extracted values:\n%o`, values, { service: 'API' });
      return values;
    }
  }
  return {};
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
  getEventValuesFromTxReceipt,
};
