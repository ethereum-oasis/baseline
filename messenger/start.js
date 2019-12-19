const { app, apiRouter } = require('./app.js');
const db = require('./src/db');
const Config = require('./config');

const nodeNum = process.env.NODE_NUM || 1;

let server;
const { dbUrl, apiPort } = Config.nodes[`node_${nodeNum}`];

async function startApiRouter() {
  await apiRouter.initialize();
  server = app.listen(apiPort, () => console.log(`Express server listening on port ${apiPort}`));
  return server;
}

async function terminate() {
  await server.close();
  await db.close();
}

const dbPromise = db.connect(dbUrl);
const serverPromise = dbPromise.then(startApiRouter);

module.exports = {
  serverPromise,
  terminate,
};
