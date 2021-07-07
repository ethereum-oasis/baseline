import db from './utils/db';
import app from './app';
import { logger } from 'radish34-logger';

const main = async () => {
  const port = 80;
  try {
    await db.connect();
    app.listen(port, () => logger.info(`REST based zkp microservice server listening on port ${port}.`, { service: 'ZKP' }));
  } catch (err) {
    logger.error('\n%o', err, { service: 'ZKP' });
    process.exit(1);
  }
};

main();
