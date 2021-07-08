const {Qtum,QtumRPC,Contract} = require('qtumjs');
const Client = require("../anonymous.js/src/client.js");
const Deployer = require('./deployer.js');
const ZSC_contract_data = require('./../contract-artifacts/artifacts/ZSC_solar.json');
const CashToken_contract_data  = require("./../contract-artifacts/artifacts/CashToken_solar.json");
const ZetherVerifier_contract_data = require("./../contract-artifacts/artifacts/ZetherVerifier_solar.json");


// Initialize the client, use deposit and withdraw functions, add friend nodes and perform anonymous transfer
// Ensure that the contracts ZSC,ZetherVerifier and CashToken are already deployed using solar
(async () => {

    // Initilaize connection with Qtum RPC
    const ZSC_qtum = new Qtum("http://hello:hello@localhost:13889",ZSC_contract_data);
    const ZetherVerifier_qtum = new Qtum("http://hello:hello@localhost:13889",ZetherVerifier_contract_data);
    const CashToken_qtum =  new Qtum("http://hello:hello@localhost:13889",CashToken_contract_data);
    
    // Address used by the sender of transcations for this demo
    const senderAddress = 'qTpsU6JtGroSphv2GfYR6xFGZ7YTqY89JB';
    const senderAddressHex = '709f2163c777177b1a7c4f54f75b7c2f97073e4f';

    // Get contract data
    const ZSC_contract = ZSC_qtum.contract("softwares/zether/packages/protocol/contracts/ZSC.sol");
    const ZetherVerifier_contract = ZetherVerifier_qtum.contract("softwares/zether/packages/protocol/contracts/ZetherVerifier.sol");
    const CashToken_contract = CashToken_qtum.contract("softwares/zether/packages/protocol/contracts/CashToken.sol");

    var deployer = new Deployer();

    await deployer.mintCashToken(CashToken_contract);
    await deployer.approveCashToken(CashToken_contract, ZSC_contract);
   
    const client = new Client(ZSC_contract, senderAddressHex);
    await client.initialize();
    
    await client.deposit(10000);
    
    await client.withdraw(1000);
    
    client.friends.add("Alice", ['qbS2RMyW1KpyKecUsMdXgfrtjS62VnMSuu', 'qMkxbdz4kLXe4cMUn7vhhz2BPLXyCmMKn6']);
    
    await client.transfer('Alice', 1000);

})().catch(console.error);