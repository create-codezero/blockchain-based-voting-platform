const OnlineVoting = artifacts.require("OnlineVoting");

module.exports = function (deployer) {
    const electionDuration = 10000000;

    deployer.deploy(OnlineVoting, electionDuration);
};
