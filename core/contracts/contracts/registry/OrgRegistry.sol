// SPDX-License-Identifier: CC0
pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./IOrgRegistry.sol";
import "./Registrar.sol";
import "./lib/ERC165Compatible.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Contract for maintaining organization registry
/// Contract inherits from Ownable and ERC165Compatible
/// Ownable contains ownership criteria of the organization registry
/// ERC165Compatible contains interface compatibility checks
contract OrgRegistry is Ownable, ERC165Compatible, Registrar, IOrgRegistry {

    struct Org {
        address orgAddress;
        bytes32 name;
        bytes messagingEndpoint;
        bytes whisperKey;
        bytes zkpPublicKey;
        bytes metadata;
    }

    struct OrgInterfaces {
        bytes32 groupName;
        address tokenAddress;
        address shieldAddress;
        address verifierAddress;
    }

    mapping (address => Org) orgMap;

    OrgInterfaces[] public orgInterfaces;

    uint orgInterfaceCount;

    Org[] public orgs;
    mapping(address => address) managerMap;

    event RegisterOrg(
        bytes32 _name,
        address _address,
        bytes _messagingEndpoint,
        bytes _whisperKey,
        bytes _zkpPublicKey,
        bytes _metadata
    );

    event UpdateOrg(
        bytes32 _name,
        address _address,
        bytes _messagingEndpoint,
        bytes _whisperKey,
        bytes _zkpPublicKey,
        bytes _metadata
    );

    /// @dev constructor function that takes the address of a pre-deployed ERC1820
    /// registry. Ideally, this contract is a publicly known address:
    /// 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24. Inherently, the constructor
    /// sets the interfaces and registers the current contract with the global registry
    constructor(address _erc1820) public ERC165Compatible() Registrar(_erc1820) {
        setInterfaces();
        setInterfaceImplementation("IOrgRegistry", address(this));
    }

    /// @notice This is an implementation of setting interfaces for the organization
    /// registry contract
    /// @dev the character '^' corresponds to bit wise xor of individual interface id's
    /// which are the parsed 4 bytes of the function signature of each of the functions
    /// in the org registry contract
    function setInterfaces() public override onlyOwner returns (bool) {
        /// 0x54ebc817 is equivalent to the bytes4 of the function selectors in IOrgRegistry
        _registerInterface(this.registerOrg.selector ^
                            this.registerInterfaces.selector ^
                            this.getOrgCount.selector ^
                            this.getInterfaceAddresses.selector);
        return true;
    }

    /// @notice This function is a helper function to be able to get the
    /// set interface id by the setInterfaces()
    function getInterfaces() external pure returns (bytes4) {
        return this.registerOrg.selector ^
                this.registerInterfaces.selector ^
                this.getOrgCount.selector ^
                this.getInterfaceAddresses.selector;
    }

    /// @notice Indicates whether the contract implements the interface 'interfaceHash' for the address 'addr' or not.
    /// @dev Below implementation is necessary to be able to have the ability to register with ERC1820
    /// @param interfaceHash keccak256 hash of the name of the interface
    /// @param addr Address for which the contract will implement the interface
    /// @return ERC1820_ACCEPT_MAGIC only if the contract implements 'interfaceHash' for the address 'addr'.
    function canImplementInterfaceForAddress(bytes32 interfaceHash, address addr) external view returns(bytes32) {
        return ERC1820_ACCEPT_MAGIC;
    }

    /// @dev Since this is an inherited method from Registrar, it allows for a new manager to be set
    /// for this contract instance
    function assignManager(address _newManager) external onlyOwner {
        assignManagement(_newManager);
    }

    /// @notice Function to register an organization
    /// @param _address ethereum address of the registered organization
    /// @param _name name of the registered organization
    /// @param _messagingEndpoint public messaging endpoint
    /// @param _whisperKey public key required for message communication
    /// @param _zkpPublicKey public key required for commitments & to verify EdDSA signatures with
    /// @dev Function to register an organization
    /// @return `true` upon successful registration of the organization
    function registerOrg(
        address _address,
        bytes32 _name,
        bytes calldata _messagingEndpoint,
        bytes calldata _whisperKey,
        bytes calldata _zkpPublicKey,
        bytes calldata _metadata
    ) external onlyOwner override returns (bool) {
        Org memory org = Org(_address, _name, _messagingEndpoint, _whisperKey, _zkpPublicKey, _metadata);
        orgMap[_address] = org;
        orgs.push(org);

        emit RegisterOrg(
            _name,
            _address,
            _messagingEndpoint,
            _whisperKey,
            _zkpPublicKey,
            _metadata
        );

        return true;
    }

    /// @notice Function to update an organization
    /// @param _address require the ethereum address of the registered organization to update the org
    /// @param _name name of the registered organization
    /// @param _messagingEndpoint public messaging endpoint
    /// @param _whisperKey public key required for message communication
    /// @param _zkpPublicKey public key required for commitments & to verify EdDSA signatures with
    /// @dev Function to update an organization
    /// @return `true` upon successful registration of the organization
    function updateOrg(
        address _address,
        bytes32 _name,
        bytes calldata _messagingEndpoint,
        bytes calldata _whisperKey,
        bytes calldata _zkpPublicKey,
        bytes calldata _metadata
    ) external override  returns (bool) {
        require(msg.sender == orgMap[_address].orgAddress, "Must update Org from registered org address");
        orgMap[_address].name = _name;
        orgMap[_address].messagingEndpoint = _messagingEndpoint;
        orgMap[_address].whisperKey = _whisperKey;
        orgMap[_address].zkpPublicKey = _zkpPublicKey;
        orgMap[_address].metadata = _metadata;

        emit UpdateOrg(
            _name,
            _address,
            _messagingEndpoint,
            _whisperKey,
            _zkpPublicKey,
            _metadata
        );
        return true;
    }

    /// @notice Function to register the names of the interfaces associated with the OrgRegistry
    /// @param _groupName name of the working group registered by an organization
    /// @param _tokenAddress name of the registered token interface
    /// @param _shieldAddress name of the registered shield registry interface
    /// @param _verifierAddress name of the verifier registry interface
    /// @dev Function to register an organization's interfaces for easy lookup
    /// @return `true` upon successful registration of the organization's interfaces
    function registerInterfaces(
        bytes32 _groupName,
        address _tokenAddress,
        address _shieldAddress,
        address _verifierAddress
    ) external onlyOwner returns (bool) {
        orgInterfaces.push(
            OrgInterfaces(
                _groupName,
                _tokenAddress,
                _shieldAddress,
                _verifierAddress
            )
        );
      
        orgInterfaceCount++;
        return true;
    }

    /// @dev Function to get the count of number of organizations to help with extraction
    /// @return length of the array containing organization addresses
    function getOrgCount() external override view returns (uint) {
        return orgs.length;
    }

    /// @notice Function to get a single organization's details
    function getOrg(address _address) external override view returns (
        address,
        bytes32,
        bytes memory,
        bytes memory,
        bytes memory,
        bytes memory
    ) {
        return (
            orgMap[_address].orgAddress,
            orgMap[_address].name,
            orgMap[_address].messagingEndpoint,
            orgMap[_address].whisperKey,
            orgMap[_address].zkpPublicKey,
            orgMap[_address].metadata
        );
    }

    /// @notice Function to get organization's interface details
    function getInterfaceAddresses() external view returns (
        OrgInterfaces[] memory
    ) {
        OrgInterfaces[] memory _orgInterfaces = new OrgInterfaces[](orgInterfaceCount);

        for (uint i = 0; i < orgInterfaceCount; i++) {
            _orgInterfaces[i] = orgInterfaces[i];
        }
        return _orgInterfaces;
    }
}

