pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./Utils.sol";

contract ZetherVerifier {
    using Utils for uint256;

    uint256 constant m = 64;
    uint256 constant n = 6;
    uint256 constant FIELD_ORDER = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
    uint256 constant UNITY = 9334303377689037989442018753807510978357674015322511348041267794643984346845; // primitive 2^28th root of unity modulo GROUP_ORDER (not field!)

    G1Point[] gs; // warning: this and the below are not statically sized anymore
    G1Point[] hs; // need to push to these if large anonsets are used.
    G1Point g;
    G1Point h;

    uint256[m] twos = powers(2);

    struct ZetherStatement {
        G1Point[] CLn;
        G1Point[] CRn;
        G1Point[] L;
        G1Point R;
        G1Point[] y;
        uint256 epoch; // or uint8?
        G1Point u;
    }

    struct ZetherProof {
        uint256 size; // not strictly necessary, but...?
        G1Point A;
        G1Point S;
        G1Point[2] commits;
        uint256 tauX;
        uint256 mu;
        uint256 t;
        AnonProof anonProof;
        SigmaProof sigmaProof;
        InnerProductProof ipProof;
    }

    struct AnonProof {
        G1Point A;
        G1Point B;
        G1Point C;
        G1Point D;
        G1Point[2][] LG; // flipping the indexing order on this, 'cause...
        G1Point inOutRG;
        G1Point gG;
        G1Point balanceCommitNewLG;
        G1Point balanceCommitNewRG;
        G1Point[2][] yG; // assuming this one has the same size..., N / 2 by 2,
        G1Point parityG0;
        G1Point parityG1;
        uint256[2][] f; // and that this has size N - 1 by 2.
        uint256 zA;
        uint256 zC;
    }

    struct SigmaProof {
        uint256 c;
        uint256 sX;
        uint256 sR;
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
            gs.push(mapInto("G", i));
            hs.push(mapInto("H", i));
        }
    }

    function baseSize() external view returns (uint256 size) {
        return gs.length;
    }

    function extendBase(uint256 size) external payable {
        // unfortunate, but necessary. essentially, we need vector bases of arbitrary (linear) length for large anonsets...
        // could mitigate this by using the logarithmic tricks of Groth and Kohlweiss; see also BCC+15
        // but this would cause problems elsewhere: N log N-sized proofs and N log^2(N) prove / verify time.
        // the increase in proof size is paradoxical: while _f_ will become smaller (log N), you'll need more correction terms
        // thus a linear persistent space overhead is not so bad in the grand scheme, and we deem this acceptable.
        for (uint256 i = gs.length; i < size; i++) {
            gs.push(mapInto("G", i));
            hs.push(mapInto("H", i));
        }
    }

    function verifyTransfer(bytes32[2][] memory CLn, bytes32[2][] memory CRn, bytes32[2][] memory L, bytes32[2] memory R, bytes32[2][] memory y, uint256 epoch, bytes32[2] memory u, bytes memory proof) public returns (bool) {
        ZetherStatement memory statement;
        uint256 size = y.length;
        require(gs.length >= size, "Inadequate stored vector base! Call extendBase and then try again.");

        statement.CLn = new G1Point[](size);
        statement.CRn = new G1Point[](size);
        statement.L = new G1Point[](size);
        statement.y = new G1Point[](size);
        for (uint256 i = 0; i < size; i++) {
            statement.CLn[i] = G1Point(uint256(CLn[i][0]), uint256(CLn[i][1]));
            statement.CRn[i] = G1Point(uint256(CRn[i][0]), uint256(CRn[i][1]));
            statement.L[i] = G1Point(uint256(L[i][0]), uint256(L[i][1]));
            statement.y[i] = G1Point(uint256(y[i][0]), uint256(y[i][1]));
        }
        statement.R = G1Point(uint256(R[0]), uint256(R[1]));
        statement.epoch = epoch;
        statement.u = G1Point(uint256(u[0]), uint256(u[1]));
        ZetherProof memory zetherProof = unserialize(proof);
        return verify(statement, zetherProof);
    }

    struct ZetherAuxiliaries {
        uint256 y;
        uint256[m] ys;
        uint256 z;
        uint256 zSquared;
        uint256 zCubed;
        uint256[m] twoTimesZSquared;
        uint256 zSum;
        uint256 k;
        G1Point tEval;
        uint256 t;
        uint256 x;
    }

    struct SigmaAuxiliaries {
        uint256 minusC;
        G1Point[2][] AL;
        G1Point Ay;
        G1Point AD;
        G1Point gEpoch;
        G1Point Au;
        G1Point ADiff;
        G1Point cCommit;
        G1Point At;
    }

    struct AnonAuxiliaries {
        uint256 x;
        uint256[2][] f;
        uint256 xInv;
        G1Point inOutR2;
        G1Point balanceCommitNewL2;
        G1Point balanceCommitNewR2;
        uint256[2][2] cycler; // should need no inline declaration / initialization. should be pre-allocated
        G1Point[2][] L2;
        G1Point[2][] y2;
        G1Point parity;
        G1Point gPrime;
    }

    struct IPAuxiliaries {
        G1Point u;
        G1Point[m] hPrimes;
        uint256[m] hExp;
        G1Point P;
        uint256 uChallenge;
        uint256[n] challenges;
        uint256[m] otherExponents;
    }

    function verify(ZetherStatement memory statement, ZetherProof memory proof) internal returns (bool) {
        ZetherAuxiliaries memory zetherAuxiliaries;
        zetherAuxiliaries.y = uint256(keccak256(abi.encode(uint256(keccak256(abi.encode(statement.epoch, statement.R, statement.CLn, statement.CRn, statement.L, statement.y))).mod(), proof.A, proof.S))).mod();
        zetherAuxiliaries.ys = powers(zetherAuxiliaries.y);
        zetherAuxiliaries.z = uint256(keccak256(abi.encode(zetherAuxiliaries.y))).mod();
        zetherAuxiliaries.zSquared = zetherAuxiliaries.z.mul(zetherAuxiliaries.z);
        zetherAuxiliaries.zCubed = zetherAuxiliaries.zSquared.mul(zetherAuxiliaries.z);
        // zetherAuxiliaries.twoTimesZSquared = times(twos, zetherAuxiliaries.zSquared);
        for (uint256 i = 0; i < m / 2; i++) {
            zetherAuxiliaries.twoTimesZSquared[i] = zetherAuxiliaries.zSquared.mul(2 ** i);
            zetherAuxiliaries.twoTimesZSquared[i + m / 2] = zetherAuxiliaries.zCubed.mul(2 ** i);
        }
        zetherAuxiliaries.x = uint256(keccak256(abi.encode(zetherAuxiliaries.z, proof.commits))).mod();

        zetherAuxiliaries.zSum = zetherAuxiliaries.zSquared.add(zetherAuxiliaries.zCubed).mul(zetherAuxiliaries.z);
        zetherAuxiliaries.k = sumScalars(zetherAuxiliaries.ys).mul(zetherAuxiliaries.z.sub(zetherAuxiliaries.zSquared)).sub(zetherAuxiliaries.zSum.mul(2 ** (m / 2)).sub(zetherAuxiliaries.zSum));
        zetherAuxiliaries.tEval = add(mul(proof.commits[0], zetherAuxiliaries.x), mul(proof.commits[1], zetherAuxiliaries.x.mul(zetherAuxiliaries.x))); // replace with "commit"?
        zetherAuxiliaries.t = proof.t.sub(zetherAuxiliaries.k);

        // begin anon proof.
        // length equality checks for anonProof members? or during deserialization?
        AnonProof memory anonProof = proof.anonProof;
        AnonAuxiliaries memory anonAuxiliaries;
        G1Point[2] memory parityG = [anonProof.parityG0, anonProof.parityG1]; // breaking this out to avoid stacktoodeep. won't affect encoding
        anonAuxiliaries.x = uint256(keccak256(abi.encode(zetherAuxiliaries.x, anonProof.LG, anonProof.yG, anonProof.A, anonProof.B, anonProof.C, anonProof.D, anonProof.inOutRG, anonProof.gG, anonProof.balanceCommitNewLG, anonProof.balanceCommitNewRG, parityG))).mod();
        anonAuxiliaries.f = new uint256[2][](proof.size);
        anonAuxiliaries.f[0][0] = anonAuxiliaries.x;
        anonAuxiliaries.f[0][1] = anonAuxiliaries.x;
        for (uint i = 1; i < proof.size; i++) {
            anonAuxiliaries.f[i][0] = anonProof.f[i - 1][0];
            anonAuxiliaries.f[i][1] = anonProof.f[i - 1][1];
            anonAuxiliaries.f[0][0] = anonAuxiliaries.f[0][0].sub(anonAuxiliaries.f[i][0]);
            anonAuxiliaries.f[0][1] = anonAuxiliaries.f[0][1].sub(anonAuxiliaries.f[i][1]);
        }
        G1Point memory temp;
        for (uint256 i = 0; i < proof.size; i++) {
            temp = add(temp, mul(gs[i], anonAuxiliaries.f[i][0]));
            temp = add(temp, mul(hs[i], anonAuxiliaries.f[i][1])); // commutative
        }

        require(eq(add(mul(anonProof.B, anonAuxiliaries.x), anonProof.A), add(temp, mul(h, anonProof.zA))), "Recovery failure for B^x * A.");
        for (uint i = 0; i < proof.size; i++) {
            anonAuxiliaries.f[i][0] = anonAuxiliaries.f[i][0].mul(anonAuxiliaries.x.sub(anonAuxiliaries.f[i][0]));
            anonAuxiliaries.f[i][1] = anonAuxiliaries.f[i][1].mul(anonAuxiliaries.x.sub(anonAuxiliaries.f[i][1]));
        }
        temp = G1Point(0, 0);
        for (uint256 i = 0; i < proof.size; i++) { // danger... gs and hs need to be big enough.
            temp = add(temp, mul(gs[i], anonAuxiliaries.f[i][0]));
            temp = add(temp, mul(hs[i], anonAuxiliaries.f[i][1])); // commutative
        }
        require(eq(add(mul(anonProof.C, anonAuxiliaries.x), anonProof.D), add(temp, mul(h, anonProof.zC))), "Recovery failure for C^x * D.");

        anonAuxiliaries.f[0][0] = anonAuxiliaries.x;
        anonAuxiliaries.f[0][1] = anonAuxiliaries.x;
        for (uint i = 1; i < proof.size; i++) { // need to recompute these. contract too large if use another variable
            anonAuxiliaries.f[i][0] = anonProof.f[i - 1][0];
            anonAuxiliaries.f[i][1] = anonProof.f[i - 1][1];
            anonAuxiliaries.f[0][0] = anonAuxiliaries.f[0][0].sub(anonAuxiliaries.f[i][0]);
            anonAuxiliaries.f[0][1] = anonAuxiliaries.f[0][1].sub(anonAuxiliaries.f[i][1]);
        }

        anonAuxiliaries.xInv = anonAuxiliaries.x.inv();
        anonAuxiliaries.inOutR2 = add(statement.R, mul(anonProof.inOutRG, anonAuxiliaries.xInv.neg()));
        anonAuxiliaries.L2 = assembleConvolutions(anonAuxiliaries.f, statement.L); // will internally include _two_ fourier transforms, and split even / odd, etc.
        anonAuxiliaries.y2 = assembleConvolutions(anonAuxiliaries.f, statement.y);
        for (uint256 i = 0; i < proof.size / 2; i++) { // order of loops can be switched...
            // could use _two_ further nested loops inside this, but...
            for (uint256 j = 0; j < 2; j++) {
                for (uint256 k = 0; k < 2; k++) {
                    anonAuxiliaries.cycler[k][j] = anonAuxiliaries.cycler[k][j].add(anonAuxiliaries.f[2 * i + k][j]);
                }
                anonAuxiliaries.L2[i][j] = mul(add(anonAuxiliaries.L2[i][j], neg(anonProof.LG[i][j])), anonAuxiliaries.xInv);
                anonAuxiliaries.y2[i][j] = mul(add(anonAuxiliaries.y2[i][j], neg(anonProof.yG[i][j])), anonAuxiliaries.xInv);
            }
        }
        // replace the leftmost column with the Hadamard of the left and right columns. just do the multiplication once...
        anonAuxiliaries.cycler[0][0] = anonAuxiliaries.cycler[0][0].mul(anonAuxiliaries.cycler[0][1]);
        anonAuxiliaries.cycler[1][0] = anonAuxiliaries.cycler[1][0].mul(anonAuxiliaries.cycler[1][1]);
        for (uint256 i = 0; i < proof.size; i++) {
            anonAuxiliaries.balanceCommitNewL2 = add(anonAuxiliaries.balanceCommitNewL2, mul(statement.CLn[i], anonAuxiliaries.f[i][0]));
            anonAuxiliaries.balanceCommitNewR2 = add(anonAuxiliaries.balanceCommitNewR2, mul(statement.CRn[i], anonAuxiliaries.f[i][0]));
            anonAuxiliaries.parity = add(anonAuxiliaries.parity, mul(statement.y[i], anonAuxiliaries.cycler[i % 2][0])); // Hadamard already baked in...
        }
        anonAuxiliaries.balanceCommitNewL2 = mul(add(anonAuxiliaries.balanceCommitNewL2, neg(anonProof.balanceCommitNewLG)), anonAuxiliaries.xInv);
        anonAuxiliaries.balanceCommitNewR2 = mul(add(anonAuxiliaries.balanceCommitNewR2, neg(anonProof.balanceCommitNewRG)), anonAuxiliaries.xInv);

        require(eq(anonAuxiliaries.parity, add(mul(anonProof.parityG1, anonAuxiliaries.x), anonProof.parityG0)), "Index opposite parity check fail.");

        anonAuxiliaries.gPrime = mul(add(mul(g, anonAuxiliaries.x), neg(anonProof.gG)), anonAuxiliaries.xInv);

        SigmaProof memory sigmaProof = proof.sigmaProof;
        SigmaAuxiliaries memory sigmaAuxiliaries;
        sigmaAuxiliaries.minusC = sigmaProof.c.neg();
        sigmaAuxiliaries.AL = new G1Point[2][](proof.size / 2 - 1);
        for (uint256 i = 1; i < proof.size / 2; i++) {
            sigmaAuxiliaries.AL[i - 1][0] = add(mul(anonAuxiliaries.y2[i][0], sigmaProof.sR), mul(anonAuxiliaries.L2[i][0], sigmaAuxiliaries.minusC));
            sigmaAuxiliaries.AL[i - 1][1] = add(mul(anonAuxiliaries.y2[i][1], sigmaProof.sR), mul(anonAuxiliaries.L2[i][1], sigmaAuxiliaries.minusC));
        }
        sigmaAuxiliaries.AD = add(mul(anonAuxiliaries.gPrime, sigmaProof.sR), mul(anonAuxiliaries.inOutR2, sigmaAuxiliaries.minusC));
        sigmaAuxiliaries.Ay = add(mul(anonAuxiliaries.gPrime, sigmaProof.sX), mul(anonAuxiliaries.y2[0][0], sigmaAuxiliaries.minusC));
        sigmaAuxiliaries.gEpoch = mapInto("Zether", statement.epoch);
        sigmaAuxiliaries.Au = add(mul(sigmaAuxiliaries.gEpoch, sigmaProof.sX), mul(statement.u, sigmaAuxiliaries.minusC));
        sigmaAuxiliaries.ADiff = add(mul(add(anonAuxiliaries.y2[0][0], anonAuxiliaries.y2[0][1]), sigmaProof.sR), mul(add(anonAuxiliaries.L2[0][0], anonAuxiliaries.L2[0][1]), sigmaAuxiliaries.minusC));
        sigmaAuxiliaries.cCommit = add(add(add(mul(anonAuxiliaries.inOutR2, sigmaProof.sX.mul(zetherAuxiliaries.zSquared)), mul(anonAuxiliaries.balanceCommitNewR2, sigmaProof.sX.mul(zetherAuxiliaries.zCubed).neg())), mul(anonAuxiliaries.balanceCommitNewL2, sigmaProof.c.mul(zetherAuxiliaries.zCubed))), mul(anonAuxiliaries.L2[0][0], sigmaProof.c.mul(zetherAuxiliaries.zSquared).neg()));
        sigmaAuxiliaries.At = add(add(mul(g, zetherAuxiliaries.t.mul(sigmaProof.c)), mul(h, proof.tauX.mul(sigmaProof.c))), neg(add(sigmaAuxiliaries.cCommit, mul(zetherAuxiliaries.tEval, sigmaProof.c))));

        uint256 challenge = uint256(keccak256(abi.encode(anonAuxiliaries.x, sigmaAuxiliaries.AL, sigmaAuxiliaries.Ay, sigmaAuxiliaries.AD, sigmaAuxiliaries.Au, sigmaAuxiliaries.ADiff, sigmaAuxiliaries.At))).mod();
        require(challenge == proof.sigmaProof.c, "Sigma protocol challenge equality failure.");

        IPAuxiliaries memory ipAuxiliaries;
        ipAuxiliaries.uChallenge = uint256(keccak256(abi.encode(sigmaProof.c, proof.t, proof.tauX, proof.mu))).mod(); // uChallenge
        ipAuxiliaries.u = mul(g, ipAuxiliaries.uChallenge);
        ipAuxiliaries.hPrimes = hadamard_inv(hs, zetherAuxiliaries.ys);
        ipAuxiliaries.hExp = addVectors(times(zetherAuxiliaries.ys, zetherAuxiliaries.z), zetherAuxiliaries.twoTimesZSquared);

        ipAuxiliaries.P = add(add(proof.A, mul(proof.S, zetherAuxiliaries.x)), mul(sumPoints(gs), zetherAuxiliaries.z.neg()));
        ipAuxiliaries.P = add(neg(mul(h, proof.mu)), add(ipAuxiliaries.P, commit(ipAuxiliaries.hPrimes, ipAuxiliaries.hExp)));
        ipAuxiliaries.P = add(ipAuxiliaries.P, mul(ipAuxiliaries.u, proof.t));

        // begin inner product verification
        InnerProductProof memory ipProof = proof.ipProof;
        for (uint256 i = 0; i < n; i++) {
            ipAuxiliaries.uChallenge = uint256(keccak256(abi.encode(ipAuxiliaries.uChallenge, ipProof.ls[i], ipProof.rs[i]))).mod();
            ipAuxiliaries.challenges[i] = ipAuxiliaries.uChallenge; // overwrites value
            uint256 xInv = ipAuxiliaries.uChallenge.inv();
            ipAuxiliaries.P = add(mul(ipProof.ls[i], ipAuxiliaries.uChallenge.exp(2)), add(mul(ipProof.rs[i], xInv.exp(2)), ipAuxiliaries.P));
        }

        ipAuxiliaries.otherExponents[0] = 1;
        for (uint256 i = 0; i < n; i++) {
            ipAuxiliaries.otherExponents[0] = ipAuxiliaries.otherExponents[0].mul(ipAuxiliaries.challenges[i]);
        }
        bool[m] memory bitSet;
        ipAuxiliaries.otherExponents[0] = ipAuxiliaries.otherExponents[0].inv();
        for (uint256 i = 0; i < m/2; ++i) {
            for (uint256 j = 0; (1 << j) + i < m; ++j) {
                uint256 i1 = i + (1 << j);
                if (!bitSet[i1]) {
                    uint256 temp = ipAuxiliaries.challenges[n - 1 - j].mul(ipAuxiliaries.challenges[n - 1 - j]);
                    ipAuxiliaries.otherExponents[i1] = ipAuxiliaries.otherExponents[i].mul(temp);
                    bitSet[i1] = true;
                }
            }
        }

        G1Point memory gTemp;
        G1Point memory hTemp;
        for (uint256 i = 0; i < m; i++) {
            gTemp = add(gTemp, mul(gs[i], ipAuxiliaries.otherExponents[i]));
            hTemp = add(hTemp, mul(ipAuxiliaries.hPrimes[i], ipAuxiliaries.otherExponents[m - 1 - i]));
        }
        G1Point memory cProof = add(add(mul(gTemp, ipProof.a), mul(hTemp, ipProof.b)), mul(ipAuxiliaries.u, ipProof.a.mul(ipProof.b)));
        require(eq(ipAuxiliaries.P, cProof), "Inner product equality check failure.");

        return true;
    }

    function assembleConvolutions(uint256[2][] memory exponent, G1Point[] memory base) internal returns (G1Point[2][] memory result) {
        // exponent is two "rows" (actually columns).
        // will return two rows, each of half the length of the exponents;
        // namely, we will return the Hadamards of "base" by the even circular shifts of "exponent"'s rows.
        uint256 size = exponent.length;
        uint256 half = size / 2;
        result = new G1Point[2][](half); // assuming that this is necessary even when return is declared up top

        G1Point[] memory base_fft = fft(base, false);

        uint256[] memory exponent_fft = new uint256[](size);
        for (uint256 i = 0; i < 2; i++) {
            for (uint256 j = 0; j < size; j++) {
                exponent_fft[j] = exponent[(size - j) % size][i]; // convolutional flip plus copy
            }

            exponent_fft = fft(exponent_fft);
            G1Point[] memory inverse_fft = new G1Point[](half);
            uint256 compensation = 2;
            compensation = compensation.inv();
            for (uint256 j = 0; j < half; j++) { // Hadamard
                inverse_fft[j] = mul(add(mul(base_fft[j], exponent_fft[j]), mul(base_fft[j + half], exponent_fft[j + half])), compensation);
            }

            inverse_fft = fft(inverse_fft, true);
            for (uint256 j = 0; j < half; j++) {
                result[j][i] = inverse_fft[j];
            }
        }
        return result;
    }

    function fft(G1Point[] memory input, bool inverse) internal returns (G1Point[] memory result) {
        uint256 size = input.length;
        if (size == 1) {
            return input;
        }
        require(size % 2 == 0, "Input size is not a power of 2!");

        uint256 omega = UNITY.exp(2**28 / size);
        uint256 compensation = 1;
        if (inverse) {
            omega = omega.inv();
            compensation = 2;
        }
        compensation = compensation.inv();
        G1Point[] memory even = fft(extract(input, 0), inverse);
        G1Point[] memory odd = fft(extract(input, 1), inverse);
        uint256 omega_run = 1;
        result = new G1Point[](size);
        for (uint256 i = 0; i < size / 2; i++) {
            G1Point memory temp = mul(odd[i], omega_run);
            result[i] = mul(add(even[i], temp), compensation);
            result[i + size / 2] = mul(add(even[i], neg(temp)), compensation);
            omega_run = omega_run.mul(omega);
        }
    }

    function extract(G1Point[] memory input, uint256 parity) internal pure returns (G1Point[] memory result) {
        result = new G1Point[](input.length / 2);
        for (uint256 i = 0; i < input.length / 2; i++) {
            result[i] = input[2 * i + parity];
        }
    }

    function fft(uint256[] memory input) internal returns (uint256[] memory result) {
        uint256 size = input.length;
        if (size == 1) {
            return input;
        }
        require(size % 2 == 0, "Input size is not a power of 2!");

        uint256 omega = UNITY.exp(2**28 / size);
        uint256[] memory even = fft(extract(input, 0));
        uint256[] memory odd = fft(extract(input, 1));
        uint256 omega_run = 1;
        result = new uint256[](size);
        for (uint256 i = 0; i < size / 2; i++) {
            uint256 temp = odd[i].mul(omega_run);
            result[i] = even[i].add(temp);
            result[i + size / 2] = even[i].sub(temp);
            omega_run = omega_run.mul(omega);
        }
    }

    function extract(uint256[] memory input, uint256 parity) internal pure returns (uint256[] memory result) {
        result = new uint256[](input.length / 2);
        for (uint256 i = 0; i < input.length / 2; i++) {
            result[i] = input[2 * i + parity];
        }
    }

    function unserialize(bytes memory arr) internal pure returns (ZetherProof memory proof) {
        proof.A = G1Point(slice(arr, 0), slice(arr, 32));
        proof.S = G1Point(slice(arr, 64), slice(arr, 96));
        proof.commits = [G1Point(slice(arr, 128), slice(arr, 160)), G1Point(slice(arr, 192), slice(arr, 224))];
        proof.t = slice(arr, 256);
        proof.tauX = slice(arr, 288);
        proof.mu = slice(arr, 320);

        SigmaProof memory sigmaProof;
        sigmaProof.c = slice(arr, 352);
        sigmaProof.sX = slice(arr, 384);
        sigmaProof.sR = slice(arr, 416);
        proof.sigmaProof = sigmaProof;

        InnerProductProof memory ipProof;
        for (uint256 i = 0; i < n; i++) {
            ipProof.ls[i] = G1Point(slice(arr, 448 + i * 64), slice(arr, 480 + i * 64));
            ipProof.rs[i] = G1Point(slice(arr, 448 + (n + i) * 64), slice(arr, 480 + (n + i) * 64));
        }
        ipProof.a = slice(arr, 448 + n * 128);
        ipProof.b = slice(arr, 480 + n * 128);
        proof.ipProof = ipProof;

        AnonProof memory anonProof;
        uint256 size = (arr.length - 1280 - 640) / 192;  // warning: this and the below assume that n = 6!!!
        anonProof.A = G1Point(slice(arr, 1280), slice(arr, 1312));
        anonProof.B = G1Point(slice(arr, 1344), slice(arr, 1376));
        anonProof.C = G1Point(slice(arr, 1408), slice(arr, 1440));
        anonProof.D = G1Point(slice(arr, 1472), slice(arr, 1504));
        anonProof.inOutRG = G1Point(slice(arr, 1536), slice(arr, 1568));
        anonProof.gG = G1Point(slice(arr, 1600), slice(arr, 1632));
        anonProof.balanceCommitNewLG = G1Point(slice(arr, 1664), slice(arr, 1696));
        anonProof.balanceCommitNewRG = G1Point(slice(arr, 1728), slice(arr, 1760));
        anonProof.parityG0 = G1Point(slice(arr, 1792), slice(arr, 1824));
        anonProof.parityG1 = G1Point(slice(arr, 1856), slice(arr, 1888));

        anonProof.f = new uint256[2][](size - 1);
        for (uint256 i = 0; i < size - 1; i++) {
            anonProof.f[i][0] = slice(arr, 1920 + 32 * i);
            anonProof.f[i][1] = slice(arr, 1920 + (size - 1 + i) * 32);
        }

        anonProof.LG = new G1Point[2][](size / 2);
        anonProof.yG = new G1Point[2][](size / 2);
        for (uint256 i = 0; i < size / 2; i++) {
            anonProof.LG[i][0] = G1Point(slice(arr, 1856 + (size + i) * 64), slice(arr, 1888 + (size + i) * 64));
            anonProof.LG[i][1] = G1Point(slice(arr, 1856 + size * 96 + i * 64), slice(arr, 1888 + size * 96 + i * 64));
            anonProof.yG[i][0] = G1Point(slice(arr, 1856 + size * 128 + i * 64), slice(arr, 1888 + size * 128 + i * 64));
            anonProof.yG[i][1] = G1Point(slice(arr, 1856 + size * 160 + i * 64), slice(arr, 1888 + size * 160 + i * 64));
            // these are tricky, and can maybe be optimized further?
        }
        proof.size = size;

        anonProof.zA = slice(arr, 1856 + size * 192);
        anonProof.zC = slice(arr, 1888 + size * 192);

        proof.anonProof = anonProof;
        return proof;
    }

    function addVectors(uint256[m] memory a, uint256[m] memory b) internal pure returns (uint256[m] memory result) {
        for (uint256 i = 0; i < m; i++) {
            result[i] = a[i].add(b[i]);
        }
    }

    function hadamard_inv(G1Point[] memory ps, uint256[m] memory ss) internal returns (G1Point[m] memory result) {
        for (uint256 i = 0; i < m; i++) {
            result[i] = mul(ps[i], ss[i].inv());
        }
    }

    function sumScalars(uint256[m] memory ys) internal pure returns (uint256 result) {
        for (uint256 i = 0; i < m; i++) {
            result = result.add(ys[i]);
        }
    }

    function sumPoints(G1Point[] memory ps) internal returns (G1Point memory sum) {
        for (uint256 i = 0; i < m; i++) {
            sum = add(sum, ps[i]);
        }
    }

    function commit(G1Point[m] memory ps, uint256[m] memory ss) internal returns (G1Point memory result) {
        for (uint256 i = 0; i < m; i++) { // killed a silly initialization with the 0th indexes. [0x00, 0x00] will be treated as the zero point anyway
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

    function add(G1Point memory p1, G1Point memory p2) internal returns (G1Point memory r) {
        assembly {
            let m := mload(0x40)
            mstore(m, mload(p1))
            mstore(add(m, 0x20), mload(add(p1, 0x20)))
            mstore(add(m, 0x40), mload(p2))
            mstore(add(m, 0x60), mload(add(p2, 0x20)))
            if iszero(call(gas, 0x06,0, m, 0x80, r, 0x40)) {
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
            if iszero(call(gas, 0x05,0, m, 0xc0, m, 0x20)) { // staticcall or call?
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
