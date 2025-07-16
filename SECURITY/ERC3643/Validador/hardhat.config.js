require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
module.exports = {
    solidity: {
        compilers: [
            { version: "0.8.17",
              settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
              }

            }
        ]
    },
    networks: {
        hh: {
            logging: true,
            url: "http://127.0.0.1:8544",
        },
    },
};
