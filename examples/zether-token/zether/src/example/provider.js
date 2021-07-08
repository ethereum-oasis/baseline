const Web3 = require("web3");
const Qtum = require("qtumjs")
class Provider {
    constructor(address) {
        this.getProvider = () => {
            const { WebsocketProvider } = Web3.providers;
            const provider = new WebsocketProvider(address);
            return new Promise((resolve, reject) => {
                provider.on("connect", () => resolve(provider));
                provider.on("error", (error) => reject(error)); // don't actually use the error object?
            });
        };
    }
}

module.exports = Provider