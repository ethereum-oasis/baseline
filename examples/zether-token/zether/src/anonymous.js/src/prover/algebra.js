const bn128 = require('../utils/bn128.js');
const utils = require('../utils/utils.js');
const BN = require('bn.js');
const { soliditySha3 } = require('web3-utils');

class GeneratorParams {
    constructor(gs, hs, h) { // doing double duty also as a "VectorBase". comes empty
        if (gs === undefined) {
            gs = new GeneratorVector([]);
        }
        if (hs === undefined) {
            hs = new GeneratorVector([]);
        }
        var g = utils.mapInto(soliditySha3("G"));
        if (h === undefined) {
            h = utils.mapInto(soliditySha3("V"));
        }

        this.size = () => { return gs.getVector().length; };
        this.getG = () => { return g; };
        this.getH = () => { return h; };
        this.getGs = () => { return gs; };
        this.getHs = () => { return hs; };

        this.extend = (size) => {
            var gsInnards = gs.getVector();
            var hsInnards = hs.getVector();
            for (var i = this.size(); i < size; i++) {
                gsInnards.push(utils.mapInto(soliditySha3("G", i)));
                hsInnards.push(utils.mapInto(soliditySha3("H", i)));
            }
            gs = new GeneratorVector(gsInnards);
            hs = new GeneratorVector(hsInnards);
        };

        this.commit = (gExp, hExp, blinding) => {
            var result = h.mul(blinding);
            var gExpVector = gExp.getVector();
            var hExpVector = hExp.getVector();
            gs.getVector().forEach((g, i) => {
                result = result.add(g.mul(gExpVector[i]));
            });
            hs.getVector().forEach((h, i) => { // swap the order and enclose this in an if (hExp) if block if you want it optional.
                result = result.add(h.mul(hExpVector[i]));
            });
            return result;
        };
    }
}

class FieldVector {
    constructor(vector) {
        this.getVector = () => { return vector; };
        this.length = () => { return vector.length; };
        this.slice = (begin, end) => {
            return new FieldVector(vector.slice(begin, end));
        };

        this.add = (other) => {
            var innards = other.getVector();
            return new FieldVector(vector.map((elem, i) => elem.redAdd(innards[i])));
        };

        this.plus = (constant) => { // confusingly named...
            return new FieldVector(vector.map((elem) => elem.redAdd(constant)));
        };

        this.sum = () => {
            return vector.reduce((accum, cur) => accum.redAdd(cur), new BN(0).toRed(bn128.q));
        };

        this.negate = () => {
            return new FieldVector(vector.map((elem) => elem.redNeg()));
        };

        this.subtract = (other) => {
            return this.add(other.negate());
        };

        this.hadamard = (other) => {
            var innards = other.getVector();
            return new FieldVector(vector.map((elem, i) => elem.redMul(innards[i])));
        };

        this.invert = () => {
            return new FieldVector(vector.map((elem) => elem.redInvm()));
        };

        this.extract = (parity) => {
            return new FieldVector(vector.filter((_, i) => i % 2 == parity));
        };

        this.flip = () => {
            var size = vector.length;
            return new FieldVector(Array.from({ length: size }).map((_, i) => vector[(size - i) % size]));
        };

        this.concat = (other) => {
            return new FieldVector(vector.concat(other.getVector()));
        };

        this.times = (constant) => {
            return new FieldVector(vector.map((elem) => elem.redMul(constant)));
        };

        this.innerProduct = (other) => {
            var innards = other.getVector();
            return vector.reduce((accum, cur, i) => accum.redAdd(cur.redMul(innards[i])), new BN(0).toRed(bn128.q));
        };
    }
}

class GeneratorVector {
    constructor(vector) {
        this.getVector = () => { return vector; };
        this.length = () => { return vector.length; };
        this.slice = (begin, end) => {
            return new GeneratorVector(vector.slice(begin, end));
        };

        this.commit = (exponents) => {
            var innards = exponents.getVector();
            return vector.reduce((accum, cur, i) => accum.add(cur.mul(innards[i])), bn128.zero);
        };

        this.sum = () => {
            return vector.reduce((accum, cur) => accum.add(cur), bn128.zero);
        }

        this.add = (other) => {
            var innards = other.getVector();
            return new GeneratorVector(vector.map((elem, i) => elem.add(innards[i])));
        };

        this.hadamard = (exponents) => {
            var innards = exponents.getVector();
            return new GeneratorVector(vector.map((elem, i) => elem.mul(innards[i])));
        };

        this.negate = () => {
            return new GeneratorVector(vector.map((elem) => elem.neg()));
        };

        this.times = (constant) => {
            return new GeneratorVector(vector.map((elem) => elem.mul(constant)));
        };

        this.extract = (parity) => {
            return new GeneratorVector(vector.filter((_, i) => i % 2 == parity));
        };

        this.shift = (n) => {
            var size = vector.length;
            return new GeneratorVector(Array.from({ length: size }).map((_, i) => vector[(i + size + n) % size]));
        };

        this.concat = (other) => {
            return new GeneratorVector(vector.concat(other.getVector()));
        };
    }
}

class Convolver {
    constructor() {
        var unity = new BN("14a3074b02521e3b1ed9852e5028452693e87be4e910500c7ba9bbddb2f46edd", 16).toRed(bn128.q);
        // this can technically be "static" (as in the "module pattern", like bn128), but...

        var fft = (input, inverse) => { // crazy... i guess this will work for both points and scalars?
            var length = input.length();
            if (length == 1) {
                return input;
            }
            if (length % 2 != 0) {
                throw "Input size must be a power of 2!";
            }
            var omega = unity.redPow(new BN(1).shln(28).div(new BN(length)));
            if (inverse) {
                omega = omega.redInvm();
            }
            var even = fft(input.extract(0), inverse);
            var odd = fft(input.extract(1), inverse);
            var omegas = [new BN(1).toRed(bn128.q)];
            for (var i = 1; i < length / 2; i++) {
                omegas.push(omegas[i - 1].redMul(omega));
            }
            omegas = new FieldVector(omegas);
            var result = even.add(odd.hadamard(omegas)).concat(even.add(odd.hadamard(omegas).negate()));
            if (inverse) {
                result = result.times(new BN(2).toRed(bn128.q).redInvm());
            }
            return result;
        };

        this.convolution = (exponent, base) => { // returns only even-indexed outputs of convolution!
            var size = base.length();
            var temp = fft(base, false).hadamard(fft(exponent.flip(), false));
            return fft(temp.slice(0, size / 2).add(temp.slice(size / 2)).times(new BN(2).toRed(bn128.q).redInvm()), true);
            // using the optimization described here https://dsp.stackexchange.com/a/30699
        };
    }
}

class FieldVectorPolynomial {
    constructor(...coefficients) {
        this.getCoefficients = () => {
            return coefficients;
        };

        this.evaluate = (x) => {
            var result = coefficients[0];
            var accumulator = x;
            coefficients.slice(1).forEach((coefficient) => {
                result = result.add(coefficient.times(accumulator));
                accumulator = accumulator.redMul(x);
            });
            return result;
        };

        this.innerProduct = (other) => {
            var innards = other.getCoefficients();
            var result = Array(coefficients.length + innards.length - 1).fill(new BN(0).toRed(bn128.q));
            coefficients.forEach((mine, i) => {
                innards.forEach((theirs, j) => {
                    result[i + j] = result[i + j].redAdd(mine.innerProduct(theirs));
                });
            });
            return result; // test this
        };
    }
}

class PedersenCommitment {
    constructor(params, x, r) {
        this.getX = () => { return x; };
        this.getR = () => { return r; };

        this.commit = () => {
            return params.getG().mul(x).add(params.getH().mul(r));
        };

        this.add = (other) => {
            return new PedersenCommitment(params, x.redAdd(other.getX()), r.redAdd(other.getR()));
        };

        this.times = (exponent) => {
            return new PedersenCommitment(params, x.redMul(exponent), r.redMul(exponent));
        };
    }
}

class PolyCommitment {
    constructor(params, coefficients) {
        var coefficientCommitments = [new PedersenCommitment(params, coefficients[0], new BN(0).toRed(bn128.q))];
        coefficients.slice(1).forEach((coefficient) => {
            coefficientCommitments.push(new PedersenCommitment(params, coefficient, bn128.randomScalar()));
        });

        this.getCommitments = () => { // ignore the first one
            return coefficientCommitments.slice(1).map((commitment) => commitment.commit());
        };

        this.evaluate = (x) => {
            var result = coefficientCommitments[0];
            var accumulator = x; // slightly uncomfortable that this starts at 1, but... actutally faster.
            coefficientCommitments.slice(1).forEach((commitment) => {
                result = result.add(commitment.times(accumulator));
                accumulator = accumulator.redMul(x);
            });
            return result;
        };
    }
}

module.exports = { GeneratorParams, FieldVector, GeneratorVector, Convolver, FieldVectorPolynomial, PolyCommitment };