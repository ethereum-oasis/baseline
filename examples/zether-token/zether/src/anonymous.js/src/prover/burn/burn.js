const { AbiCoder } = require('web3-eth-abi');
const BN = require('bn.js');

const bn128 = require('../../utils/bn128.js');
const utils = require('../../utils/utils.js');
const { GeneratorParams, GeneratorVector, FieldVector, FieldVectorPolynomial, PolyCommitment } = require('../algebra.js');
const SigmaProver = require('./sigma.js');
const InnerProductProver = require('../innerproduct.js');

class BurnProof {
    constructor() {
        this.serialize = () => { // please initialize this before calling this method...
            var result = "0x";
            result += bn128.representation(this.a).slice(2);
            result += bn128.representation(this.s).slice(2);
            this.tCommits.getVector().forEach((commit) => {
                result += bn128.representation(commit).slice(2);
            });
            result += bn128.bytes(this.t).slice(2);
            result += bn128.bytes(this.tauX).slice(2);
            result += bn128.bytes(this.mu).slice(2);
            result += this.sigmaProof.serialize().slice(2);
            result += this.ipProof.serialize().slice(2);
            return result;
        }
    };
}

class BurnProver {
    constructor() {
        var abiCoder = new AbiCoder();

        var params = new GeneratorParams();
        params.extend(32);

        var sigmaProver = new SigmaProver();
        var ipProver = new InnerProductProver();

        this.generateProof = (statement, witness, salt) => { // salt probably won't be used
            var proof = new BurnProof();

            var aL = new FieldVector(new BN(witness['bDiff']).toString(2, 32).split("").reverse().map((i) => new BN(i, 2).toRed(bn128.q)));
            var aR = aL.plus(new BN(1).toRed(bn128.q).redNeg());
            var alpha = bn128.randomScalar();
            proof.a = params.commit(aL, aR, alpha);
            var sL = new FieldVector(Array.from({ length: 32 }).map(bn128.randomScalar));
            var sR = new FieldVector(Array.from({ length: 32 }).map(bn128.randomScalar));

            var rho = bn128.randomScalar(); // already reduced
            proof.s = params.commit(sL, sR, rho);

            var statementHash = utils.hash(abiCoder.encodeParameters(['uint256', 'uint256', 'bytes32[2]', 'bytes32[2]', 'bytes32[2]'], [statement['bTransfer'], statement['epoch'], statement['y'], statement['CLn'], statement['CRn']]));
            statement['CLn'] = bn128.unserialize(statement['CLn']);
            statement['CRn'] = bn128.unserialize(statement['CRn']);
            statement['y'] = bn128.unserialize(statement['y']); // actually, y will never be used in what follows...!
            // leave bTransfer (and bDiff) as is for now

            var y = utils.hash(abiCoder.encodeParameters(['bytes32', 'bytes32[2]', 'bytes32[2]'], [bn128.bytes(statementHash), bn128.serialize(proof.a), bn128.serialize(proof.s)]));
            var ys = [new BN(1).toRed(bn128.q)];
            for (var i = 1; i < 32; i++) { // it would be nice to have a nifty functional way of doing this.
                ys.push(ys[i - 1].redMul(y));
            }
            ys = new FieldVector(ys); // could avoid this line by starting ys as a fieldvector and using "plus". not going to bother.
            var z = utils.hash(bn128.bytes(y));
            var twos = [new BN(1).toRed(bn128.q)];
            for (var i = 1; i < 32; i++) {
                twos.push(twos[i - 1].redMul(new BN(2).toRed(bn128.q)));
            }
            var twoTimesZs = new FieldVector(twos).times(z.redMul(z));

            var l0 = aL.plus(z.redNeg());
            var l1 = sL;
            var lPoly = new FieldVectorPolynomial(l0, l1);
            var r0 = ys.hadamard(aR.plus(z)).add(twoTimesZs);
            var r1 = sR.hadamard(ys);
            var rPoly = new FieldVectorPolynomial(r0, r1);
            var tPolyCoefficients = lPoly.innerProduct(rPoly); // just an array of BN Reds... should be length 3
            var polyCommitment = new PolyCommitment(params, tPolyCoefficients);
            var x = utils.hash(abiCoder.encodeParameters(['bytes32', 'bytes32[2]', 'bytes32[2]'], [bn128.bytes(z), ...polyCommitment.getCommitments().map(bn128.serialize)]));
            var evalCommit = polyCommitment.evaluate(x);
            proof.tCommits = new GeneratorVector(polyCommitment.getCommitments()); // just 2 of them?
            proof.t = evalCommit.getX();
            proof.tauX = evalCommit.getR();
            proof.mu = alpha.redAdd(rho.redMul(x));

            var sigmaStatement = statement; // pointless---just adding fields to the same object
            sigmaStatement['z'] = z;
            var sigmaWitness = { 'x': witness['x'] }; // just a subset of the original witness
            proof.sigmaProof = sigmaProver.generateProof(sigmaStatement, sigmaWitness, x);

            var uChallenge = utils.hash(abiCoder.encodeParameters(['bytes32', 'bytes32', 'bytes32', 'bytes32'], [bn128.bytes(proof.sigmaProof.challenge), bn128.bytes(proof.t), bn128.bytes(proof.tauX), bn128.bytes(proof.mu)]));
            var u = params.getG().mul(uChallenge);
            var gs = params.getGs();
            var hPrimes = params.getHs().hadamard(ys.invert());
            var hExp = ys.times(z).add(twoTimesZs);
            var P = proof.a.add(proof.s.mul(x)).add(gs.sum().mul(z.redNeg())).add(hPrimes.commit(hExp)).add(u.mul(proof.t)).add(params.getH().mul(proof.mu).neg());
            var primeBase = new GeneratorParams(gs, hPrimes, u);
            var ipStatement = { 'primeBase': primeBase, 'P': P }; // "cheating" by including primeBase in the statement while in reality it's "params"
            var ipWitness = { 'l': lPoly.evaluate(x), 'r': rPoly.evaluate(x) };
            proof.ipProof = ipProver.generateProof(ipStatement, ipWitness, uChallenge);

            return proof;
        }
    }
}

module.exports = BurnProver;