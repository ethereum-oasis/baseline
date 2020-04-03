import { pubsub } from '../subscriptions';
import {
  registerToOrgRegistry,
  listOrganizations,
  getRegisteredOrganization,
  getOrganizationCount,
  getInterfaceAddress,
} from '../services/organization';
import { getServerSettings } from '../utils/serverSettings';
import db from '../db';

const NEW_ORG = 'NEW_ORG';

const getOrganizationById = async address => {
  const organization = await db.collection('organization').findOne({ _id: address });
  return organization;
};

const getAllOrganizations = async () => {
  const organizations = await db
    .collection('organization')
    .find({})
    .toArray();
  return organizations;
};

export default {
  Query: {
    async organization(_parent, args) {
      const res = await getOrganizationById(args.address);
      return res;
    },
    organizations() {
      return getAllOrganizations();
    },
    organizationList() {
      return listOrganizations();
    },
    registeredOrganization(_parent, args) {
      return getRegisteredOrganization(args.address);
    },
    organizationCount() {
      return getOrganizationCount();
    },
    orgRegistryAddress(_parent, args) {
      const { registrarAddress, managerAddress } = args;
      return getInterfaceAddress(registrarAddress, managerAddress, 'IOrgRegistry');
    },
  },
  Organization: {
    name: root => root.name,
    address: root => root.address,
    role: root => root.role,
  },
  Mutation: {
    registerOrganization: async (_root, args) => {
      const settings = await getServerSettings();
      const { zkpPublicKey, messengerKey, address } = settings.organization;
      const { organizationName, organizationRole } = args;

      const orgRegistryTxHash = await registerToOrgRegistry(
        address,
        organizationName,
        organizationRole,
        messengerKey,
        zkpPublicKey,
      );

      console.log('Registering Organization with tx:', orgRegistryTxHash);
    },
  },
  Subscription: {
    newOrganization: {
      subscribe: () => {
        return pubsub.asyncIterator(NEW_ORG);
      },
    },
  },
};
