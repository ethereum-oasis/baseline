import express from 'express';

import { getZokratesService } from '../utils/zokratesService';
import { logger } from 'radish34-logger';
import { getArtifactsByKey, storeArtifactsByKey } from '../utils/dbUtils';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    // Proving scheme is not used, since baseline privacy package zokrates-js only supports g16 at the moment
    const { docId, filename, inputs, scheme } = req.body;
    logger.debug('filename = \n%o', filename, { service: 'ZKP' });
    logger.debug('docId = \n%o', docId, { service: 'ZKP' });
    logger.debug('inputs = \n%o', inputs, { service: 'ZKP' });

    const zokratesService = await getZokratesService();
    logger.debug('zokratesService = \n%o', zokratesService, { service: 'ZKP' });

    const artifacts = await getArtifactsByKey(process.env.MONGO_COLLECTION_SETUP, filename, true);
    logger.debug('artifacts = \n%o', artifacts, { service: 'ZKP' });

    const witnessComputation = await zokratesService.computeWitness(artifacts.compilationArtifacts, inputs);
    logger.debug('witnessComputation = \n%o', witnessComputation, { service: 'ZKP' });

    const proof = await zokratesService.generateProof(artifacts.compilationArtifacts.program, witnessComputation.witness, artifacts.setupArtifacts.keypair.pk);
    logger.debug('proof = \n%o', proof, { service: 'ZKP' });

    const proofArtifacts = {
      proofKey: docId,
      setupKey: filename,
      witnessComputation,
      proof,
      inputs
    }

    await storeArtifactsByKey(process.env.MONGO_COLLECTION_PROOFS, docId, proofArtifacts);
    // FIX: naming
    return res.send({
      docID: proofArtifacts.proofKey,
      verificationKeyID: proofArtifacts.setupKey,
      proof: proofArtifacts.proof,
      inputs: proofArtifacts.inputs
    });
  } catch (error) {
    logger.error('\n%o', error, { service: 'ZKP' });
    return next(error);
  }
});

router.post('/:circuitId', async (req, res, next) => {
  try {
    const { circuitId } = req.params;
    const { docId, inputs, scheme } = req.body;
    logger.debug('circuitId = \n%o', circuitId, { service: 'ZKP' });
    logger.debug('docId = \n%o', docId, { service: 'ZKP' });
    logger.debug('inputs = \n%o', inputs, { service: 'ZKP' });

    const zokratesService = await getZokratesService();
    logger.debug('zokratesService = \n%o', zokratesService, { service: 'ZKP' });

    const artifacts = await getArtifactsByKey(process.env.MONGO_COLLECTION_SETUP, circuitId, true);
    logger.debug('artifacts = \n%o', artifacts, { service: 'ZKP' });

    const witnessComputation = await zokratesService.computeWitness(artifacts.compilationArtifacts, inputs);
    logger.debug('witnessComputation = \n%o', witnessComputation, { service: 'ZKP' });

    const proof = await zokratesService.generateProof(artifacts.compilationArtifacts.program, witnessComputation.witness, artifacts.setupArtifacts.keypair.pk);
    logger.debug('proof = \n%o', proof, { service: 'ZKP' });

    const proofArtifacts = {
      proofKey: docId,
      setupKey: circuitId,
      witnessComputation,
      proof,
      inputs
    }

    await storeArtifactsByKey(process.env.MONGO_COLLECTION_PROOFS, docId, proofArtifacts);
    return res.send({
      docID: proofArtifacts.proofKey,
      verificationKeyID: proofArtifacts.setupKey,
      proof: proofArtifacts.proof,
      inputs: proofArtifacts.inputs
    });
  } catch (error) {
    logger.error('\n%o', error, { service: 'ZKP' });
    return next(error);
  }
});

export default router;
