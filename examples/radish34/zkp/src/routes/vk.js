import express from 'express';
import { logger } from 'radish34-logger';
import { getArtifactsByKey } from '../utils/dbUtils';

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  try {
    // id is the name of the circuit used as key in mongodb
    const { id } = req.params;

    const artifacts = await getArtifactsByKey(process.env.MONGO_COLLECTION_SETUP, id, true);
    const vk = artifacts.setupArtifacts.keypair.vk;
    logger.debug('vk = \n%o', vk, { service: 'ZKP'});

    // FIX: naming to verificationKey { verficationKey: VerificationKey }
    const response = { vk };
    return res.send(response);
  } catch (error) {
    logger.error('\n%o', error, { service: 'ZKP' });
    return next(error);
  }
});

export default router;
