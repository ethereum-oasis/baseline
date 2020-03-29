import {
  // getPartnerByID,
  getPartnerByIdentity,
  getAllPartners,
  // getMyPartners,
  setPartner,
} from '../../db/models/baseline/organizations';

const PARTNERS_UPDATE = 'PARTNERS_UPDATE';

export default {
  Query: {
    partner(_parent, args) {
      // TODO: Reconnect this
      // return getPartnerByID(args.address).then(res => res);
    },
    async getPartnerByIdentity(_parent, args) {
      const { identity } = args;
      const res = await getPartnerByIdentity(identity);
      return res;
    },
    partners() {
      return getAllPartners();
    },
    myPartners() {
      // TODO: Reconnect this
      // return getMyPartners();
    },
  },
  Partner: {
    name: root => root.name,
    address: root => root.address,
    role: root => root.role,
  },
  Mutation: {
    addPartner: async (_parent, args) => {
      const { input } = args;
      await setPartner(input, true);
      // TODO: Reconnect this
      // const partners = await getMyPartners();
      // return partners;
    },
    removePartner: async (_parent, args) => {
      const { input } = args;
      await setPartner(input, false);
      // TODO: Reconnect this
      // const partners = await getMyPartners();
      // return partners;
    },
  },
  Subscription: {
    getPartnerUpdate: {
      subscribe: () => {
        return pubsub.asyncIterator(PARTNERS_UPDATE);
      },
    },
  },
};
