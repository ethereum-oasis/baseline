import express from 'express';

import { getZokratesService } from '../utils/zokratesService';
import { logger } from 'radish34-logger';
import { storeArtifactsByKey } from '../utils/dbUtils';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, source, scheme } = req.body;
    const zokratesService = await getZokratesService();
    logger.debug('zokratesService = \n%o', zokratesService, { service: 'ZKP' });

    const compilationArtifacts = await zokratesService.compile(source, process.env.ZKP_ENTRYPOINT_LOCATION);
    logger.debug('compilationArtifacts = \n%o', compilationArtifacts, { service: 'ZKP' });

    const setupArtifacts = await zokratesService.setup(compilationArtifacts);
    logger.debug('setupArtifacts = \n%o', setupArtifacts, { service: 'ZKP' });

    const verifierContract = await zokratesService.exportVerifier(setupArtifacts.keypair.vk);
    logger.debug('verifierContract = \n%o', verifierContract, { service: 'ZKP' });

    const artifacts = {
      setupKey: name,
      source,
      compilationArtifacts,
      setupArtifacts,
      verifierContract
    }

    await storeArtifactsByKey(process.env.MONGO_COLLECTION_SETUP, name, artifacts);
    const response = { verificationKey: artifacts.setupArtifacts.keypair.vk };
    return res.send(response);
  } catch (error) {
    logger.error('\n%o', { error: error }, { service: 'ZKP' });
    return next(error);
  }
});

export default router;
