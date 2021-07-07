import { zkSnarkCircuitProviderServiceFactory, zkSnarkCircuitProviderServiceZokrates } from '@baseline-protocol/privacy';
import { readFileSync } from 'fs';

const zokratesImportResolver = (location, path) => {
  let zokpath = `./${path}`;
  if (!zokpath.match(/\.zok$/i)) {
    zokpath = `${zokpath}.zok`;
  }
  return {
    source: readFileSync(zokpath).toString(),
    location: path,
  };
};

let service = null;

export const getZokratesService = async () => {
  if (!service) {
    service = await zkSnarkCircuitProviderServiceFactory(zkSnarkCircuitProviderServiceZokrates, { importResolver: zokratesImportResolver });
  }
  return service;
}
