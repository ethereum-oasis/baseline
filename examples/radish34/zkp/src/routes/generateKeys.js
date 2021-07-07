import express from 'express';
import fs from 'fs';
import path from 'path';

import { getZokratesService } from '../utils/zokratesService';
import { logger } from 'radish34-logger';
import { storeArtifactsByKey } from '../utils/dbUtils';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { filepath, scheme } = req.body; // filepath relative to /app/circuits/ or /zkp/circuits/
    const filename = path.basename(filepath, '.zok'); // filename without '.zok'
    const zokratesService = await getZokratesService();
    logger.debug('zokratesService = \n%o', zokratesService, { service: 'ZKP' });
    logger.debug(`filepath = ${filepath}`, { service: 'ZKP' });

    const source = fs.readFileSync(`./circuits/${filepath}`).toString();
    logger.debug('source = \n%o', source, { service: 'ZKP' });

    const compilationArtifacts = await zokratesService.compile(source, process.env.ZKP_ENTRYPOINT_LOCATION);
    logger.debug('compilationArtifacts = \n%o', compilationArtifacts, { service: 'ZKP' });

    const setupArtifacts = await zokratesService.setup(compilationArtifacts);
    logger.debug('setupArtifacts = \n%o', setupArtifacts, { service: 'ZKP' });

    const verifierContract = await zokratesService.exportVerifier(setupArtifacts.keypair.vk);
    logger.debug('verifierContract = \n%o', verifierContract, { service: 'ZKP' });

    const artifacts = {
      setupKey: filename,
      source,
      compilationArtifacts,
      setupArtifacts,
      verifierContract
    }

    await storeArtifactsByKey(process.env.MONGO_COLLECTION_SETUP, filename, artifacts);
    const response = { verificationKey: artifacts.setupArtifacts.keypair.vk };
    return res.send(response);
  } catch (error) {
    logger.error('\n%o', { error: error }, { service: 'ZKP' });
    return next(error);
  }
});

export default router;
