const {Qtum,QtumRPC} = require('qtumjs');

class Deployer {
    constructor() {
        const rpc = new QtumRPC('http://hello:hello@localhost:13889');
        const senderAddress = 'qTpsU6JtGroSphv2GfYR6xFGZ7YTqY89JB';
        const senderAddressHex = '709f2163c777177b1a7c4f54f75b7c2f97073e4f'

        this.mintCashToken = async (contract) => {
            try{
                await contract.send("mint",[senderAddressHex, 1000000]);
                const balance = await contract.call("balanceOf",[senderAddressHex]);
                console.log("ERC20 funds minted (balance = " + balance.outputs[0].toNumber() + ").");
            } catch(err){
                console.log(err);
            }
    
        };

        this.approveCashToken = async (contract, zsc_contract) => {
            try{
                
                await contract.send("approve", [zsc_contract.address,1000000]);
                const allowed  = await contract.call("allowance",[senderAddressHex,zsc_contract.address]);
                console.log("ERC funds approved for transfer to ZSC (allowance = " + allowed.outputs[0].toNumber() + ").");
            }catch(err){
                console.log(err);
            }
          
        };

         // Converts a base58 pubkeyhash address to a hex address
         async function toHexAddress(base58_address) {
            return await rpc.rawCall("gethexaddress",[base58_address]);
        };
        

    };
}

module.exports = Deployer;