const FishToken = artifacts.require("FishToken");

module.exports = function (deployer) {
  deployer.deploy(FishToken);
};