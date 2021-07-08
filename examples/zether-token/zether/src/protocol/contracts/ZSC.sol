pragma solidity 0.5.11;

import './ZetherVerifier.sol';
import './BaselineToken.sol';

contract ZSC {
    BaselineToken BaseLink;
    ZetherVerifier zetherverifier;
    uint256 public epochLength; // now in milliseconds.

    uint256 bTotal = 0; // could use erc20.balanceOf(this), but (even pure / view) calls cost gas during EVM execution
    uint256 constant MAX = 4294967295; // 2^32 - 1 // no sload for constants...!
    mapping(bytes32 => bytes32[2][2]) acc; // main account mapping
    mapping(bytes32 => bytes32[2][2]) pTransfers; // storage for pending transfers
    mapping(bytes32 => uint256) lastRollOver;
    bytes32[] nonceSet; // would be more natural to use a mapping, but they can't be deleted / reset!
    uint256 lastGlobalUpdate = 0; // will be also used as a proxy for "current epoch", seeing as rollovers will be anticipated
    // not implementing account locking for now...revisit

    event TransferOccurred(bytes32[2][] parties); // all parties will be notified, client can determine whether it was real or not.
    // arg is still necessary for transfers---not even so much to know when you received a transfer, as to know when you got rolled over.

    constructor(address _coin, address _zether, uint256 _epochLength) public {
        // epoch length, like block.time, is in _seconds_. 4 is the minimum!!! (To allow a withdrawal to go through.)
        BaseLink = BaselineToken(_coin);
        zetherverifier = ZetherVerifier(_zether);
        epochLength = _epochLength;
    }

    function simulateAccounts(bytes32[2][] calldata y, uint256 epoch) external returns (bytes32[2][2][] memory accounts) {
        // all of this could be assembled locally by querying `acc` and `pTransfers` (and `lastRollOver`) and assembling things by hand
        // turns out this is extremely _slow_ though, because of the ~ 4 * N queries which must be made. turns out it's much faster
        // to simply move the entire process into a contract method, and in fact this allows us to make the above 3 private
        uint256 size = y.length;
        accounts = new bytes32[2][2][](size);
        for (uint256 i = 0; i < size; i++) {
            bytes32 yHash = keccak256(abi.encodePacked(y[i]));
            accounts[i] = acc[yHash];
            if (lastRollOver[yHash] < epoch) {
                bytes32[2][2] memory scratch = pTransfers[yHash];
                assembly {
                    let result := 1
                    let m := mload(0x40)
                    mstore(m, mload(mload(scratch)))
                    mstore(add(m, 0x20), mload(add(mload(scratch), 0x20)))
                    mstore(add(m, 0x40), mload(mload(mload(add(add(accounts, 0x20), mul(i, 0x20))))))
                    mstore(add(m, 0x60), mload(add(mload(mload(add(add(accounts, 0x20), mul(i, 0x20)))), 0x20)))
                    result := and(result, call(gas, 0x06,0,m, 0x80, mload(mload(add(add(accounts, 0x20), mul(i, 0x20)))), 0x40))
                    mstore(m, mload(mload(add(scratch, 0x20))))
                    mstore(add(m, 0x20), mload(add(mload(add(scratch, 0x20)), 0x20)))
                    mstore(add(m, 0x40), mload(mload(add(mload(add(add(accounts, 0x20), mul(i, 0x20))), 0x20))))
                    mstore(add(m, 0x60), mload(add(mload(add(mload(add(add(accounts, 0x20), mul(i, 0x20))), 0x20)), 0x20)))
                    result := and(result, call(gas, 0x06,0, m, 0x80, mload(add(mload(add(add(accounts, 0x20), mul(i, 0x20))), 0x20)), 0x40))
                    if iszero(result) {
                        revert(0, 0)
                    }
                }
            }
        }
    }

    function rollOver(bytes32 yHash) internal {
        uint256 e = block.timestamp / epochLength;
        if (lastRollOver[yHash] < e) {
            bytes32[2][2][2] memory scratch = [acc[yHash], pTransfers[yHash]];
            assembly {
                let result := 1
                let m := mload(0x40)
                mstore(m, mload(mload(mload(scratch))))
                mstore(add(m, 0x20), mload(add(mload(mload(scratch)), 0x20)))
                mstore(add(m, 0x40), mload(mload(mload(add(scratch, 0x20)))))
                mstore(add(m, 0x60), mload(add(mload(mload(add(scratch, 0x20))), 0x20)))
                result := and(result, call(gas, 0x06, 0, m, 0x80, mload(mload(scratch)), 0x40))
                mstore(m, mload(mload(add(mload(scratch), 0x20))))
                mstore(add(m, 0x20), mload(add(mload(add(mload(scratch), 0x20)), 0x20)))
                mstore(add(m, 0x40), mload(mload(add(mload(add(scratch, 0x20)), 0x20))))
                mstore(add(m, 0x60), mload(add(mload(add(mload(add(scratch, 0x20)), 0x20)), 0x20)))
                result := and(result, call(gas, 0x06,0, m, 0x80, mload(add(mload(scratch), 0x20)), 0x40))
                if iszero(result) {
                    revert(0, 0)
                }
            }
            acc[yHash] = scratch[0];
            pTransfers[yHash] = [[bytes32(0), bytes32(0)], [bytes32(0), bytes32(0)]];
            lastRollOver[yHash] = e;
        }
        if (lastGlobalUpdate < e) {
            lastGlobalUpdate = e;
            delete nonceSet;
        }
    }

    function fund(bytes32[2] calldata y, uint256 bTransfer) external {
        bytes32 yHash = keccak256(abi.encodePacked(y));
        rollOver(yHash);

        // registration check here would be redundant, as any `transferFrom` the 0 address will necessarily fail. save an sload
        require(bTransfer <= MAX, "Deposit amount out of range."); // uint, so other way not necessary?
        require(bTransfer + bTotal <= MAX, "Fund pushes contract past maximum value.");
        // if pTransfers[yHash] == [0, 0, 0, 0] then an add and a write will be equivalent...
        bytes32[2] memory scratch = pTransfers[yHash][0];
        // won't let me assign this array using literals / casts
        assembly {
            let m := mload(0x40)
            let result := 1
            mstore(m, mload(scratch))
            mstore(add(m, 0x20), mload(add(scratch, 0x20)))
            mstore(add(m, 0x40), 0x077da99d806abd13c9f15ece5398525119d11e11e9836b2ee7d23f6159ad87d4)
            mstore(add(m, 0x60), 0x01485efa927f2ad41bff567eec88f32fb0a0f706588b4e41a8d587d008b7f875)
            mstore(add(m, 0x80), bTransfer) // b will hopefully be a primitive / literal and not a pointer / address?
            result := and(result, call(gas, 0x07, 0,add(m, 0x40), 0x60, add(m, 0x40), 0x40))
            result := and(result, call(gas, 0x06,0, m, 0x80, scratch, 0x40))
            if iszero(result) {
                revert(0, 0)
            }
        }
        pTransfers[yHash][0] = scratch;
        require(coin.transferFrom(msg.sender, address(this), bTransfer), "Transfer from sender failed.");
        bTotal += bTransfer;
    }

    function transfer(bytes32[2][] memory L, bytes32[2] memory R, bytes32[2][] memory y, bytes32[2] memory u, bytes memory proof) public {
        uint256 size = y.length;
        bytes32[2][] memory CLn = new bytes32[2][](size);
        bytes32[2][] memory CRn = new bytes32[2][](size);
        require(L.length == size, "Input array length mismatch!");
        uint256 result = 1;
        for (uint256 i = 0; i < y.length; i++) {
            bytes32 yHash = keccak256(abi.encodePacked(y[i]));
            rollOver(yHash);
            bytes32[2][2] memory scratch = pTransfers[yHash];
            assembly {
                let m := mload(0x40)
                mstore(m, mload(mload(scratch)))
                mstore(add(m, 0x20), mload(add(mload(scratch), 0x20)))
                // calldatacopy(add(m, 0x40), add(0x104, mul(i, 0x40)), 0x40) // copy L[i] onto running block
                // having to change external --> public to avoid stacktoodeep
                // as a result, have to use the below two lines instead of the above single line.
                mstore(add(m, 0x40), mload(mload(add(add(L, 0x20), mul(i, 0x20)))))
                mstore(add(m, 0x60), mload(add(mload(add(add(L, 0x20), mul(i, 0x20))), 0x20)))
                result := and(result, call(gas, 0x06,0, m, 0x80, mload(scratch), 0x40))
                mstore(m, mload(mload(add(scratch, 0x20))))
                mstore(add(m, 0x20), mload(add(mload(add(scratch, 0x20)), 0x20)))
                // calldatacopy(add(m, 0x40), 0x24, 0x40) // copy R onto running block
                mstore(add(m, 0x40), mload(R))
                mstore(add(m, 0x60), mload(add(R, 0x20)))
                result := and(result, call(gas, 0x06,0, m, 0x80, mload(add(scratch, 0x20)), 0x40))
            }
            pTransfers[yHash] = scratch; // credit / debit / neither y's account.
            scratch = acc[yHash];
            assembly {
                let m := mload(0x40)
                mstore(m, mload(mload(scratch)))
                mstore(add(m, 0x20), mload(add(mload(scratch), 0x20)))
                mstore(add(m, 0x40), mload(mload(add(add(L, 0x20), mul(i, 0x20)))))
                mstore(add(m, 0x60), mload(add(mload(add(add(L, 0x20), mul(i, 0x20))), 0x20)))
                result := and(result, call(gas, 0x06,0, m, 0x80, mload(add(add(CLn, 0x20), mul(i, 0x20))), 0x40))
                mstore(m, mload(mload(add(scratch, 0x20))))
                mstore(add(m, 0x20), mload(add(mload(add(scratch, 0x20)), 0x20)))
                mstore(add(m, 0x40), mload(R))
                mstore(add(m, 0x60), mload(add(R, 0x20)))
                result := and(result, call(gas, 0x06,0, m, 0x80, mload(add(add(CRn, 0x20), mul(i, 0x20))), 0x40))
            }
        }
        require(result == 1, "Elliptic curve operations failure. Bad points?");

        bool seen = false;
        bytes32 uHash = keccak256(abi.encodePacked(u));
        for (uint256 i = 0; i < nonceSet.length; i++) {
            if (nonceSet[i] == uHash) {
                seen = true;
                break;
            }
        }
        require(!seen, "Nonce already seen!");
        if (size > zetherverifier.baseSize()) {
            zetherverifier.extendBase(size);
        }
        require(zetherverifier.verifyTransfer(CLn, CRn, L, R, y, lastGlobalUpdate, u, proof), "Transfer proof verification failed!");

        nonceSet.push(uHash);
        emit TransferOccurred(y);
    }

    function burn(bytes32[2] memory y, uint256 bTransfer, bytes32[2] memory u, bytes memory proof) public {
        bytes32 yHash = keccak256(abi.encodePacked(y));
        rollOver(yHash);

        require(0 <= bTransfer && bTransfer <= MAX, "Transfer amount out of range.");
        bytes32[2][2] memory scratch = pTransfers[yHash]; // could technically use sload, but... let's not go there.
        assembly {
            let result := 1
            let m := mload(0x40)
            mstore(m, mload(mload(scratch)))
            mstore(add(m, 0x20), mload(add(mload(scratch), 0x20)))
            // load bulletproof generator here
            mstore(add(m, 0x40), 0x077da99d806abd13c9f15ece5398525119d11e11e9836b2ee7d23f6159ad87d4) // g_x
            mstore(add(m, 0x60), 0x01485efa927f2ad41bff567eec88f32fb0a0f706588b4e41a8d587d008b7f875) // g_y
            mstore(add(m, 0x80), sub(0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001, bTransfer))
            result := and(result, call(gas, 0x07,0, add(m, 0x40), 0x60, add(m, 0x40), 0x40))
            result := and(result, call(gas, 0x06,0, m, 0x80, mload(scratch), 0x40)) // scratch[0] = acc[yHash][0] * g ^ -b, scratch[1] doesn't change
            if iszero(result) {
                revert(0, 0)
            }
        }
        pTransfers[yHash] = scratch; // debit y's balance
        scratch = acc[yHash]; // simulate debit of acc---just for use in verification, won't be applied
        assembly {
            let result := 1
            let m := mload(0x40)
            mstore(m, mload(mload(scratch)))
            mstore(add(m, 0x20), mload(add(mload(scratch), 0x20)))
            mstore(add(m, 0x40), 0x077da99d806abd13c9f15ece5398525119d11e11e9836b2ee7d23f6159ad87d4) // g_x
            mstore(add(m, 0x60), 0x01485efa927f2ad41bff567eec88f32fb0a0f706588b4e41a8d587d008b7f875) // g_y
            mstore(add(m, 0x80), sub(0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001, bTransfer))
            result := and(result, call(gas, 0x07,0, add(m, 0x40), 0x60, add(m, 0x40), 0x40))
            result := and(result, call(gas, 0x06, m,0, 0x80, mload(scratch), 0x40)) // scratch[0] = acc[yHash][0] * g ^ -b, scratch[1] doesn't change
            if iszero(result) {
                revert(0, 0)
            }
        }
        bool seen = false;
        bytes32 uHash = keccak256(abi.encodePacked(u));
        for (uint256 i = 0; i < nonceSet.length; i++) {
            if (nonceSet[i] == uHash) { // does this have to repeat the sload for each iteration?!? revisit
                seen = true;
                break;
            }
        }
        require(!seen, "Nonce already seen!");
        require(coin.transfer(msg.sender, bTransfer), "This shouldn't fail... Something went severely wrong.");
        // note: change from Zether spec. should use bound address not msg.sender, to prevent "front-running attack".
        bTotal -= bTransfer;
        nonceSet.push(uHash);
    }
}
