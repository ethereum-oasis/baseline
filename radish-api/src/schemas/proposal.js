import gql from 'graphql-tag';

const ProposalSchema = gql`
  extend type Query {
    proposal(id: String!): Proposal
    getProposalsByRFPId(rfpId: String!): [Proposal]
    proposals: [Proposal]
  }

  extend type Mutation {
    createProposal(input: inputProposal!): Proposal
  }

  extend type Subscription {
    newProposal: Proposal
  }

  type Proposal {
    _id: String!
    rfpId: String!
    rates: [RateTable!]!
    sender: String!
  }

  input inputProposal {
    rfpId: String!
    rates: [inputRateTable!]!
    recipient: String!
  }

  type RateTable {
    startRange: Int!
    endRange: Int!
    price: Float!
    unitOfMeasure: String!
  }

  input inputRateTable {
    startRange: Int!
    endRange: Int!
    price: Float!
    unitOfMeasure: String!
  }
`;

export default ProposalSchema;
