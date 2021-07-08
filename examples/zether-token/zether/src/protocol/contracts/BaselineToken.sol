pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "./BaseVerifier.sol";

contract BaselineToken is ERC20Mintable{

    string private _name = "BaselineToken";
    string private _symbol = "BSL";
    uint8 private _decimals = 2;
    uint private _INITIAL_SUPPLY = 12000000;

    /** @dev constructor calling ERC20 constructor*/
    constructor() public ERC20(_name,_symbol,_decimals){
        _mint(msg.sender, _INITIAL_SUPPLY);
    }
    
   
    address addressVerifier;

    /**@param _addressVerif, address of the verifier */
    function setAddressVerif(address _addressVerif) public {
        addressVerifier = _addressVerif;
    }

    /** @return adr , address of the verifier, not a really useful function*/
    function getAddressVerif() public view returns(address adr){
        return addressVerifier;
    }

    /**@param a, b, c, input, data returned by the snarkjs function "generatecall"
    * @param personne, 1 or 2 <=> sender or verifier, inputs are differents
    */
    function callVerifier(uint[2] memory a,uint[2][2] memory b,uint[2] memory c,uint[3] memory input, uint personne) private view returns(bool) {
        InterfaceVerifier v = InterfaceVerifier(addressVerifier);
        if(personne == 1){
            return v.verifyProofSender(a,b,c,input);
        }
        if(personne == 2){
            return v.verifyProofReceiver(a,b,c,input);
        }
    }

    /**
    @dev using a struct for the parameters of the callVerifier function is more convenient */
    struct VerifParameters {
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
        uint[3] input;
    }

    /**
    * @param _addr , address to return the balance's hash from
    * @return bytes32 balance's mimc hash
    */
    function getBalanceHash(address _addr) public view returns (bytes32){
        return _balanceHashes[_addr];
    }


    /**
    @dev confidential transaction, there should be an interaction between the two parties
    @param _to, address of the receiver,
    @param vSender, vReceiver: two VerifParameters objects, they are used for the zkp approval
    @return val , transaction ok/not ok 
    */
    function confidentialTransfer(address _to, uint256 value,
        VerifParameters memory vSender, VerifParameters memory vReceiver)
        public returns(bool val)
    {
        bool senderProofIsCorrect = callVerifier(vSender.a,vSender.b,vSender.c,vSender.input,1);
        bool receiverProofIsCorrect = callVerifier(vReceiver.a,vReceiver.b,vReceiver.c,vReceiver.input,2);

        val = false;
        if(senderProofIsCorrect && receiverProofIsCorrect){
            
            _balanceHashes[msg.sender] = bytes32(mimc(_balances[msg.sender] - value));
            _balanceHashes[_to] = bytes32(mimc(_balances[_to] + value));
            
            _balances[msg.sender] = _balances[msg.sender].sub(value, "ERC20: transfer amount exceeds balance");
            _balances[_to] = _balances[_to].add(value);            
            val = true;
        }
        return val;
    }

    
}
