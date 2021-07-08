const bn128 = require('./bn128.js')
const BN = require('bn.js')
const { soliditySha3 } = require('web3-utils');

const utils = {};

utils.determinePublicKey = (x) => {
    return bn128.serialize(bn128.curve.g.mul(x));
}

// no "start" parameter for now.
// CL and CR are "flat", x is a BN.
utils.readBalance = (CL, CR, x) => {
    CL = bn128.unserialize(CL);
    CR = bn128.unserialize(CR);

    var gB = CL.add(CR.mul(x.neg()));

    var accumulator = bn128.zero;
    for (var i = 0; i < bn128.B_MAX; i++) {
        if (accumulator.eq(gB)) {
            return i;
        }
        accumulator = accumulator.add(bn128.curve.g);
    }
};

utils.createAccount = () => {
    var x = bn128.randomScalar();
    var y = utils.determinePublicKey(x);
    return { 'x': x, 'y': y };
};

utils.mapInto = (seed) => { // seed is flattened 0x + hex string
    var seed_red = new BN(seed.slice(2), 16).toRed(bn128.p);
    var p_1_4 = bn128.curve.p.add(new BN(1)).div(new BN(4));
    while (true) {
        var y_squared = seed_red.redPow(new BN(3)).redAdd(new BN(3).toRed(bn128.p));
        var y = y_squared.redPow(p_1_4);
        if (y.redPow(new BN(2)).eq(y_squared)) {
            return bn128.curve.point(seed_red.fromRed(), y.fromRed());
        }
        seed_red.redIAdd(new BN(1).toRed(bn128.p));
    }
};

utils.gEpoch = (epoch) => {
    return utils.mapInto(soliditySha3("Zether", epoch));
};

utils.u = (epoch, x) => {
    return utils.gEpoch(epoch).mul(x);
};

utils.hash = (...args) => { // ags are serialized
    return new BN(soliditySha3(...args).slice(2), 16).toRed(bn128.q);
};

module.exports = utils;