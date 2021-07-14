import { exec } from 'child_process';
import * as log from 'loglevel';
import { Client } from 'pg';
import { domain } from 'process';
import { Ident } from 'provide-js';
import { AuthService } from 'ts-natsutil';
import { ParticipantStack } from '../src/index';

export const promisedTimeout = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const authenticateUser = async (identHost, email, password) => {
  const auth = await Ident.authenticate({
    email: email,
    password: password,
    scope: 'offline_access',
  }, 'http', identHost);
  return auth;
};

export const baselineAppFactory = async (
  userAccessToken,
  userRefreshToken,
  orgName,
  domain,
  initiator,
  identHost,
  natsHost,
  natsPrivateKey,
  natsPublicKey,
  nchainHost,
  networkId,
  vaultHost,
  privacyHost,
  baselineHost,
  baselineMessagingPort,
  baselineMessagingStreamingPort,
  baselineMessagingWebsocketPort,
  rpcEndpoint,
  rpcScheme,
  redisHost,
  redisPort,
  workgroup,
  workgroupName,
  workgroupToken,
  vaultSealUnsealKey,
): Promise<ParticipantStack> => {
  const natsConfig = {
    bearerToken: '',
    natsServers: [natsHost],
    privateKey: natsPrivateKey,
    publicKey: natsPublicKey,
  };
  natsConfig.bearerToken = await vendNatsAuthorization(natsConfig, 'baseline.proxy');

  return new ParticipantStack(
    {
      baselineApiScheme: 'http',
      baselineApiHost: baselineHost,
      baselineMessagingPort: baselineMessagingPort,
      baselineMessagingStreamingPort: baselineMessagingStreamingPort,
      baselineMessagingWebsocketPort: baselineMessagingWebsocketPort,
      domain: domain,
      identApiScheme: 'http',
      identApiHost: identHost,
      initiator: initiator,
      nchainApiScheme: 'http',
      nchainApiHost: nchainHost,
      privacyApiScheme: 'http',
      privacyApiHost: privacyHost,
      networkId: networkId, // FIXME-- boostrap network genesis if no public testnet faucet is configured...
      orgName: orgName,
      rpcEndpoint: rpcEndpoint,
      rpcScheme: rpcScheme,
      redisHost: redisHost,
      redisPort: redisPort,
      token: userAccessToken, // HACK
      userAccessToken: userAccessToken,
      userRefreshToken: userRefreshToken,
      vaultApiScheme: 'http',
      vaultApiHost: vaultHost,
      vaultSealUnsealKey: vaultSealUnsealKey,
      workgroup: workgroup,
      workgroupName: workgroupName,
      workgroupToken: workgroupToken,
    },
    natsConfig,
  );
};

export const configureTestnet = async (dbport, networkId) => {
  const nchainPgclient = new Client({
    user: 'nchain',
    host: '0.0.0.0',
    database: 'nchain_dev',
    password: 'nchain',
    port: dbport,
  });

  try {
    await nchainPgclient.connect();
    await nchainPgclient.query(`UPDATE networks SET enabled = true WHERE id = '${networkId}'`);
  } finally {
    await nchainPgclient.end();
    return true;
  }
};

export const createUser = async (identHost, firstName, lastName, email, password) => {
  const user = await Ident.createUser({
    first_name: firstName,
    last_name: lastName,
    email: email,
    password: password,
  }, 'http', identHost);
  return user;
};

export const scrapeInvitationToken = async (container) => {
  await promisedTimeout(800);

  let logs;
  exec(`docker logs ${container}`, (err, stdout, stderr) => {
   logs = stderr.toString();
  });

  await promisedTimeout(800);
  const matches = logs.match(/\"dispatch invitation\: (.*)\"/);
  if (matches && matches.length > 0) {
    return matches[matches.length - 1];
  }
  return null;
};

export const vendNatsAuthorization = async (natsConfig, subject): Promise<string> => {
  const authService = new AuthService(
    log,
    natsConfig?.audience || natsConfig.natsServers[0],
    natsConfig?.privateKey,
    natsConfig?.publicKey,
  );

  const permissions = {
    publish: {
      allow: ['baseline.>'],
    },
    subscribe: {
      allow: [`baseline.proxy`],
    },
  };

  return await authService.vendBearerJWT(
    subject,
    5000,
    permissions,
  );
};
