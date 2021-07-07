import fs from 'fs';
import db from './db';
import { logger } from 'radish34-logger';

const reorderArtifacts = artifacts => {
  const { name, source, compilationArtifacts, setupArtifacts, verifierContract } = artifacts;
  // Reordering only for compliation and setup artifacts
  // Proving scheme G16 assumed, zokrates-js default atow
  return {
    name,
    source,
    compilationArtifacts: {
      program: compilationArtifacts.program,
      abi: compilationArtifacts.abi
    },
    setupArtifacts: {
      identifier: setupArtifacts.identifier,
      keypair: {
        vk: {
          alpha: setupArtifacts.keypair.vk.alpha,
          beta: setupArtifacts.keypair.vk.beta,
          gamma: setupArtifacts.keypair.vk.gamma,
          delta: setupArtifacts.keypair.vk.delta,
          gamma_abc: setupArtifacts.keypair.vk.gamma_abc
        },
        pk: setupArtifacts.keypair.pk
      },
      verifierSource: setupArtifacts.verifierSource
    },
    verifierContract
  }
}

export const getArtifactsByKey = async (collection, key, needToReorder) =>{
  const artifacts = await db
    .collection(collection)
    .findOne({ _id: key }, { projection: { _id: 0 } });
  return (artifacts != null && needToReorder) ? reorderArtifacts(artifacts) : artifacts;
}

export const storeArtifactsByKey = async (collection, key, artifacts) => {
  try {
    await db.collection(collection).updateOne({ _id: key }, { $set: artifacts }, { upsert: true });
  } catch(error) {
    logger.error('\n%o', { error: err }, { service: 'ZKP' });
  }
}

export default {
  getArtifactsByKey,
  storeArtifactsByKey
};
