pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./Utils.sol";

contract BurnVerifier {
    using Utils for uint256;

    uint256 constant m = 32;
    uint256 constant n = 5;
    uint256 constant FIELD_ORDER = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    G1Point[m] gs;
    G1Point[m] hs;
    G1Point g;
    G1Point h;

    uint256[m] twos = powers(2); // how much is this actually used?

    struct BurnStatement {
        G1Point balanceCommitNewL;
        G1Point balanceCommitNewR;
        G1Point y;
        uint256 bTransfer;
        uint256 epoch; // or uint8?
        address sender;
        G1Point u;
    }

    struct BurnProof {
        G1Point A;
        G1Point S;
        G1Point[2] commits;
        uint256 tauX;
        uint256 mu;
        uint256 t;
        SigmaProof sigmaProof;
        InnerProductProof ipProof;
    }

    struct SigmaProof {
        uint256 c;
        uint256 sX;
    }

    struct InnerProductProof {
        G1Point[n] ls;
        G1Point[n] rs;
        uint256 a;
        uint256 b;
    }

    constructor() public {
        g = mapInto("G");
        h = mapInto("V");
        for (uint256 i = 0; i < m; i++) {
            gs[i] = mapInto("G", i);
            hs[i] = mapInto("H", i);
        }
    } // will it be more expensive later on to sload these than to recompute them?

    function verifyBurn(bytes32[2] memory CLn, bytes32[2] memory CRn, bytes32[2] memory y, uint256 bTransfer, uint256 epoch, bytes32[2] memory u, address sender, bytes memory proof) public returns (bool) {
        BurnStatement memory statement; // WARNING: if this is called directly in the console,
        // and your strings are less than 64 characters, they will be padded on the right, not the left. should hopefully not be an issue,
        // as this will typically be called simply by the other contract, which will get its arguments using precompiles. still though, beware
        statement.balanceCommitNewL = G1Point(uint256(CLn[0]), uint256(CLn[1]));
        statement.balanceCommitNewR = G1Point(uint256(CRn[0]), uint256(CRn[1]));
        statement.y = G1Point(uint256(y[0]), uint256(y[1]));
        statement.bTransfer = bTransfer;
        statement.epoch = epoch;
        statement.u = G1Point(uint256(u[0]), uint256(u[1]));
        statement.sender = sender;
        BurnProof memory burnProof = unserialize(proof);
        return verify(statement, burnProof);
    }

    struct BurnAuxiliaries {
        uint256 y;
        uint256[m] ys;
        uint256 z;
        uint256 zSquared;
        uint256 zCubed;
        uint256[m] twoTimesZSquared;
        uint256 k;
        G1Point tEval;
        uint256 t;
        uint256 x;
    }

    struct SigmaAuxiliaries {
        uint256 minusC;
        G1Point Ay;
        G1Point gEpoch;
        G1Point Au;
        G1Point cCommit;
        G1Point At;
    }

    function verify(BurnStatement memory statement, BurnProof memory proof) internal returns (bool) {
        BurnAuxiliaries memory burnAuxiliaries;
        burnAuxiliaries.y = uint256(keccak256(abi.encode(uint256(keccak256(abi.encode(statement.bTransfer, statement.epoch, statement.y, statement.balanceCommitNewL, statement.balanceCommitNewR))).mod(), proof.A, proof.S))).mod();
        burnAuxiliaries.ys = powers(burnAuxiliaries.y);
        burnAuxiliaries.z = uint256(keccak256(abi.encode(burnAuxiliaries.y))).mod();
        burnAuxiliaries.zSquared = burnAuxiliaries.z.mul(burnAuxiliaries.z);
        burnAuxiliaries.zCubed = burnAuxiliaries.zSquared.mul(burnAuxiliaries.z);
        burnAuxiliaries.twoTimesZSquared = times(twos, burnAuxiliaries.zSquared);
        burnAuxiliaries.x = uint256(keccak256(abi.encode(burnAuxiliaries.z, proof.commits))).mod();

        // begin verification of sigma proof. is it worth passing to a different method?
        burnAuxiliaries.k = sumScalars(burnAuxiliaries.ys).mul(burnAuxiliaries.z.sub(burnAuxiliaries.zSquared)).sub(burnAuxiliaries.zCubed.mul(2 ** m).sub(burnAuxiliaries.zCubed)); // really care about t - k
        burnAuxiliaries.tEval = add(mul(proof.commits[0], burnAuxiliaries.x), mul(proof.commits[1], burnAuxiliaries.x.mul(burnAuxiliaries.x))); // replace with "commit"?
        burnAuxiliaries.t = proof.t.sub(burnAuxiliaries.k);

        SigmaAuxiliaries memory sigmaAuxiliaries;
        sigmaAuxiliaries.minusC = proof.sigmaProof.c.neg();
        sigmaAuxiliaries.Ay = add(mul(g, proof.sigmaProof.sX), mul(statement.y, sigmaAuxiliaries.minusC));
        sigmaAuxiliaries.gEpoch = mapInto("Zether", statement.epoch);
        sigmaAuxiliaries.Au = add(mul(sigmaAuxiliaries.gEpoch, proof.sigmaProof.sX), mul(statement.u, sigmaAuxiliaries.minusC));
        sigmaAuxiliaries.cCommit = add(mul(statement.balanceCommitNewL, proof.sigmaProof.c.mul(burnAuxiliaries.zSquared)), mul(statement.balanceCommitNewR, proof.sigmaProof.sX.mul(burnAuxiliaries.zSquared).neg()));
        sigmaAuxiliaries.At = add(add(mul(g, burnAuxiliaries.t.mul(proof.sigmaProof.c)), mul(h, proof.tauX.mul(proof.sigmaProof.c))), neg(add(sigmaAuxiliaries.cCommit, mul(burnAuxiliaries.tEval, proof.sigmaProof.c))));

        uint256 challenge = uint256(keccak256(abi.encode(burnAuxiliaries.x, sigmaAuxiliaries.Ay, sigmaAuxiliaries.Au, sigmaAuxiliaries.At, statement.sender))).mod();
        require(challenge == proof.sigmaProof.c, "Sigma protocol challenge equality failure.");

        uint256 uChallenge = uint256(keccak256(abi.encode(proof.sigmaProof.c, proof.t, proof.tauX, proof.mu))).mod();
        G1Point memory u = mul(g, uChallenge);
        G1Point[m] memory hPrimes = hadamardInv(hs, burnAuxiliaries.ys);
        uint256[m] memory hExp = addVectors(times(burnAuxiliaries.ys, burnAuxiliaries.z), burnAuxiliaries.twoTimesZSquared);
        G1Point memory P = add(add(proof.A, mul(proof.S, burnAuxiliaries.x)), mul(sumPoints(gs), burnAuxiliaries.z.neg()));
        P = add(neg(mul(h, proof.mu)), add(P, commit(hPrimes, hExp)));
        P = add(P, mul(u, proof.t));


        // begin inner product verification
        InnerProductProof memory ipProof = proof.ipProof;
        uint256[n] memory challenges;
        for (uint256 i = 0; i < n; i++) {
            uChallenge = uint256(keccak256(abi.encode(uChallenge, ipProof.ls[i], ipProof.rs[i]))).mod();
            challenges[i] = uChallenge;
            uint256 xInv = uChallenge.inv();
            P = add(add(mul(ipProof.ls[i], uChallenge.exp(2)), mul(ipProof.rs[i], xInv.exp(2))), P);
        }

        uint256[m] memory otherExponents;
        otherExponents[0] = 1;
        for (uint256 i = 0; i < n; i++) {
            otherExponents[0] = otherExponents[0].mul(challenges[i]);
        }
        bool[m] memory bitSet;
        otherExponents[0] = otherExponents[0].inv();
        for (uint256 i = 0; i < m/2; ++i) {
            for (uint256 j = 0; (1 << j) + i < m; ++j) {
                uint256 i1 = i + (1 << j);
                if (!bitSet[i1]) {
                    uint256 temp = challenges[n - 1 - j].mul(challenges[n - 1 - j]);
                    otherExponents[i1] = otherExponents[i].mul(temp);
                    bitSet[i1] = true;
                }
            }
        }

        G1Point memory gTemp = multiExpGs(otherExponents);
        G1Point memory hTemp = multiExpHsInversed(otherExponents, hPrimes);
        G1Point memory cProof = add(add(mul(gTemp, ipProof.a), mul(hTemp, ipProof.b)), mul(u, ipProof.a.mul(ipProof.b)));
        require(eq(P, cProof), "Inner product equality check failure.");
        return true;
    }

    function multiExpGs(uint256[m] memory ss) internal returns (G1Point memory result) {
        for (uint256 i = 0; i < m; i++) {
            result = add(result, mul(gs[i], ss[i]));
        }
    }

    function multiExpHsInversed(uint256[m] memory ss, G1Point[m] memory hs) internal returns (G1Point memory result) {
        for (uint256 i = 0; i < m; i++) {
            result = add(result, mul(hs[i], ss[m - 1 - i]));
        }
    }

    // begin util functions
    function unserialize(bytes memory arr) internal pure returns (BurnProof memory proof) {
        proof.A = G1Point(slice(arr, 0), slice(arr, 32));
        proof.S = G1Point(slice(arr, 64), slice(arr, 96));
        proof.commits = [G1Point(slice(arr, 128), slice(arr, 160)), G1Point(slice(arr, 192), slice(arr, 224))];
        proof.t = slice(arr, 256);
        proof.tauX = slice(arr, 288);
        proof.mu = slice(arr, 320);

        SigmaProof memory sigmaProof;
        sigmaProof.c = slice(arr, 352);
        sigmaProof.sX = slice(arr, 384);
        proof.sigmaProof = sigmaProof;

        InnerProductProof memory ipProof;
        for (uint256 i = 0; i < n; i++) {
            ipProof.ls[i] = G1Point(slice(arr, 416 + i * 64), slice(arr, 448 + i * 64));
            ipProof.rs[i] = G1Point(slice(arr, 416 + (n + i) * 64), slice(arr, 448 + (n + i) * 64));
        }
        ipProof.a = slice(arr, 416 + n * 128);
        ipProof.b = slice(arr, 448 + n * 128);
        proof.ipProof = ipProof;
        return proof;
    }

    function addVectors(uint256[m] memory a, uint256[m] memory b) internal pure returns (uint256[m] memory result) {
        for (uint256 i = 0; i < m; i++) {
            result[i] = a[i].add(b[i]);
        }
    }

    function hadamardInv(G1Point[m] memory ps, uint256[m] memory ss) internal returns (G1Point[m] memory result) {
        for (uint256 i = 0; i < m; i++) {
            result[i] = mul(ps[i], ss[i].inv());
        }
    }

    function sumScalars(uint256[m] memory ys) internal pure returns (uint256 result) {
        for (uint256 i = 0; i < m; i++) {
            result = result.add(ys[i]);
        }
    }

    function sumPoints(G1Point[m] memory ps) internal returns (G1Point memory sum) {
        for (uint256 i = 0; i < m; i++) {
            sum = add(sum, ps[i]);
        }
    }

    function commit(G1Point[m] memory ps, uint256[m] memory ss) internal returns (G1Point memory result) {
        for (uint256 i = 0; i < m; i++) {
            result = add(result, mul(ps[i], ss[i]));
        }
    }

    function powers(uint256 base) internal pure returns (uint256[m] memory powers) {
        powers[0] = 1;
        powers[1] = base;
        for (uint256 i = 2; i < m; i++) {
            powers[i] = powers[i - 1].mul(base);
        }
    }

    function times(uint256[m] memory v, uint256 x) internal pure returns (uint256[m] memory result) {
        for (uint256 i = 0; i < m; i++) {
            result[i] = v[i].mul(x);
        }
    }

    function slice(bytes memory input, uint256 start) internal pure returns (uint256 result) { // extracts exactly 32 bytes
        assembly {
            let m := mload(0x40)
            mstore(m, mload(add(add(input, 0x20), start))) // why only 0x20?
            result := mload(m)
        }
    }

    struct G1Point {
        uint256 x;
        uint256 y;
    }

    function add(G1Point memory p1, G1Point memory p2) public returns (G1Point memory r) {
        assembly {
            let m := mload(0x40)
            mstore(m, mload(p1))
            mstore(add(m, 0x20), mload(add(p1, 0x20)))
            mstore(add(m, 0x40), mload(p2))
            mstore(add(m, 0x60), mload(add(p2, 0x20)))
            if iszero(call(gas, 0x06, 0, m, 0x80, r, 0x40)) {
                revert(0, 0)
            }
        }
    }

    function mul(G1Point memory p, uint256 s) internal returns (G1Point memory r) {
        assembly {
            let m := mload(0x40)
            mstore(m, mload(p))
            mstore(add(m, 0x20), mload(add(p, 0x20)))
            mstore(add(m, 0x40), s)
            if iszero(call(gas, 0x07,0, m, 0x60, r, 0x40)) {
                revert(0, 0)
            }
        }
    }

    function neg(G1Point memory p) internal pure returns (G1Point memory) {
        return G1Point(p.x, FIELD_ORDER - (p.y % FIELD_ORDER)); // p.y should already be reduced mod P?
    }

    function eq(G1Point memory p1, G1Point memory p2) internal pure returns (bool) {
        return p1.x == p2.x && p1.y == p2.y;
    }

    function fieldExp(uint256 base, uint256 exponent) internal returns (uint256 output) { // warning: mod p, not q
        uint256 order = FIELD_ORDER;
        assembly {
            let m := mload(0x40)
            mstore(m, 0x20)
            mstore(add(m, 0x20), 0x20)
            mstore(add(m, 0x40), 0x20)
            mstore(add(m, 0x60), base)
            mstore(add(m, 0x80), exponent)
            mstore(add(m, 0xa0), order)
            if iszero(call(gas, 0x05, 0, m, 0xc0, m, 0x20)) { // staticcall or call?
                revert(0, 0)
            }
            output := mload(m)
        }
    }

    function mapInto(uint256 seed) internal returns (G1Point memory) { // warning: function totally untested!
        uint256 y;
        while (true) {
            uint256 ySquared = fieldExp(seed, 3) + 3; // addmod instead of add: waste of gas, plus function overhead cost
            y = fieldExp(ySquared, (FIELD_ORDER + 1) / 4);
            if (fieldExp(y, 2) == ySquared) {
                break;
            }
            seed += 1;
        }
        return G1Point(seed, y);
    }

    function mapInto(string memory input) internal returns (G1Point memory) { // warning: function totally untested!
        return mapInto(uint256(keccak256(abi.encodePacked(input))) % FIELD_ORDER);
    }

    function mapInto(string memory input, uint256 i) internal returns (G1Point memory) { // warning: function totally untested!
        return mapInto(uint256(keccak256(abi.encodePacked(input, i))) % FIELD_ORDER);
        // ^^^ important: i haven't tested this, i.e. whether it agrees with ProofUtils.paddedHash(input, i) (cf. also the go version)
    }
}
