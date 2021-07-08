pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

library Utils {

    uint256 public constant GROUP_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant UNITY = 9334303377689037989442018753807510978357674015322511348041267794643984346845; // primitive 2^28th root of unity modulo GROUP_ORDER (not field!)

    function add(uint256 x, uint256 y) internal pure returns (uint256) {
        return addmod(x, y, GROUP_ORDER);
    }

    function mul(uint256 x, uint256 y) internal pure returns (uint256) {
        return mulmod(x, y, GROUP_ORDER);
    }

    function inv(uint256 x) internal returns (uint256) {
        return exp(x, GROUP_ORDER - 2);
    }

    function mod(uint256 x) internal pure returns (uint256) {
        return x % GROUP_ORDER;
    }

    function sub(uint256 x, uint256 y) internal pure returns (uint256) {
        return x >= y ? x - y : GROUP_ORDER - y + x;
    }

    function neg(uint256 x) internal pure returns (uint256) {
        return GROUP_ORDER - x;
    }

    function exp(uint256 base, uint256 exponent) internal returns (uint256 output) {
        uint256 order = GROUP_ORDER;
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
}
