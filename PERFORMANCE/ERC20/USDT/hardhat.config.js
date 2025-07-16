require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

// Addreses data in the .env file
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.4.17"
            }
        ]
    },
    networks: {
        hh: {
            url: "http://127.0.0.1:8544",
            chainId: 31337
        },
        sepolia: {
            url: "https://ethereum-sepolia-rpc.publicnode.com",
            chainId: 11155111,
            accounts: process.env.SEPOLIA_PRIVATE_KEYS ? process.env.SEPOLIA_PRIVATE_KEYS.split(",") : []
        },
        holesky: {
            url: "https://ethereum-holesky.publicnode.com/",
            chainId: 17000,
            accounts: process.env.HOLESKY_PRIVATE_KEYS ? process.env.HOLESKY_PRIVATE_KEYS.split(",") : []
        }
    }
};
