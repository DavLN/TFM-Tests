require("@nomicfoundation/hardhat-toolbox");
module.exports = {
    solidity: {
        compilers: [
            {
              version: "0.8.24"
            }
        ]
    },
    networks: {
        hh: {
            url: "http://127.0.0.1:8544",
        },
    },
};
