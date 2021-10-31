const FishMarketContract = artifacts.require("FishMarketContract");

module.exports = function (deployer) {
  deployer.deploy(FishMarketContract);
};