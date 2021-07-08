const { AbiCoder } = require('web3-eth-abi');

const { GeneratorParams, GeneratorVector, FieldVector } = require('../algebra.js');
const bn128 = require('../../utils/bn128.js');
const utils = require('../../utils/utils.js');

class SigmaProof {
    constructor() {
        this.serialize = () => {
            var result = "0x";
            result += bn128.bytes(this.challenge).slice(2);
            result += bn128.bytes(this.sX).slice(2);
            result += bn128.bytes(this.sR).slice(2);
            return result;
        };
    }
}

class SigmaProver {
    constructor() {
        var abiCoder = new AbiCoder();

        this.generateProof = (statement, witness, salt) => {
            var y = statement['y'][0].getVector()[0];
            var yBar = statement['y'][1].getVector()[0];
            var z = statement['z'];
            var zSquared = z.redMul(z);
            var zCubed = z.redMul(zSquared);

            var kR = bn128.randomScalar();
            var kX = bn128.randomScalar();

            var Ay = statement['gPrime'].mul(kX);
            var AD = statement['gPrime'].mul(kR);
            var AL = statement['y'].map((y_i) => new GeneratorVector(y_i.times(kR).getVector().slice(1)));
            var Au = utils.gEpoch(statement['epoch']).mul(kX);
            var ADiff = y.add(yBar).mul(kR);
            var At = statement['CRn'].mul(zCubed).add(statement['inOutR'].mul(zSquared).neg()).mul(kX);

            var proof = new SigmaProof();

            proof.challenge = utils.hash(abiCoder.encodeParameters([
                'bytes32',
                'bytes32[2][2][]',
                'bytes32[2]',
                'bytes32[2]',
                'bytes32[2]',
                'bytes32[2]',
                'bytes32[2]',
            ], [
                bn128.bytes(salt),
                AL[0].getVector().map((point, i) => [point, AL[1].getVector()[i]].map(bn128.serialize)), // unusual---have to transpose
                bn128.serialize(Ay),
                bn128.serialize(AD),
                bn128.serialize(Au),
                bn128.serialize(ADiff),
                bn128.serialize(At),
            ]));

            proof.sX = kX.redAdd(proof.challenge.redMul(witness['x']));
            proof.sR = kR.redAdd(proof.challenge.redMul(witness['r']));

            return proof;
        };
    }
}

module.exports = SigmaProver;