import React from 'react';
import PropTypes from 'prop-types';
import { ApolloProvider } from 'react-apollo';
import { ApolloClient } from 'apollo-client';
import { getMainDefinition } from 'apollo-utilities';
import { ApolloLink, split } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ServerStatusProvider } from './server-status-context';
import { ServerSettingsProvider } from './server-settings-context';
import { PartnerProvider } from './partner-context';
import { MessageProvider } from './message-context';
import { RFQProvider } from './rfq-context';
import { QuoteProvider } from './quote-context';

const uri = window.localStorage.getItem('api') || 'radish-api-buyer.docker/graphql';

const httpLink = new HttpLink({
  uri: `http://${uri}`,
});

const wsLink = new WebSocketLink({
  uri: `ws://${uri}`,
  options: {
    reconnect: true,
  },
});

const terminatingLink = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === 'OperationDefinition' && operation === 'subscription';
  },
  wsLink,
  httpLink,
);

const link = ApolloLink.from([terminatingLink]);

const cache = new InMemoryCache();

const client = new ApolloClient({
  link,
  cache,
});

function AppProviders({ children }) {
  return (
    <ApolloProvider client={client}>
      <MessageProvider>
        <ServerSettingsProvider>
          <ServerStatusProvider>
            <PartnerProvider>
              <RFQProvider>
                <QuoteProvider>{children}</QuoteProvider>
              </RFQProvider>
            </PartnerProvider>
          </ServerStatusProvider>
        </ServerSettingsProvider>
      </MessageProvider>
    </ApolloProvider>
  );
}

AppProviders.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppProviders;
