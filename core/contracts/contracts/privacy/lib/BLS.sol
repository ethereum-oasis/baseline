pragma solidity ^0.5.0;

import "./Pairing.sol";


/**
 * @title BLS Signature
 * @dev A library for verifying BLS signatures. Based on the work of https://gist.github.com/BjornvdLaan/ca6dd4e3993e1ef392f363ec27fe74c4
 */
library BLS {
    /*
     * Internal functions
     */

    /**
     * @dev Checks if a BLS signature is valid.
     * @param _verificationKey Public verification key associated with the secret key that signed the message.
     * @param _message Message that was signed.
     * @param _signature Signature over the message.
     * @return True if the message was correctly signed.
     */
    function verify(
        Pairing.G2Point _verificationKey,
        bytes _message,
        Pairing.G1Point _signature
    ) internal returns (bool) {
        Pairing.G1Point memory messageHash = Pairing.hashToG1(_message);
        return Pairing.pairing2(Pairing.negate(_signature), Pairing.P2(), messageHash, _verificationKey);
    }
}
