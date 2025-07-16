require('dotenv').config();
const hre = require("hardhat");
const fs = require("fs");
const {network, ethers} = hre;

async function main() {

    const path = process.env.CONTRACT_PATH;
    const fileName = process.env.CONTRACT_FILE;
    const className = process.env.CONTRACT_CLASS;

    if (network.name === "hh") {
        // Mine N empty blocks to stabilize base fee
        for (let i = 0; i < 100; i++) {
            await network.provider.send("evm_mine");
        }
    }

    // It MUST be a JSON file
    const deplyomentDataFile = "deployment-addresses.json";

    const contract_addresses = {};

    const constructorArguments = [
        1000,
        "ERC20",
        "20",
        18
    ];

    // Obtain compilation data
    const Token = await ethers.getContractFactory(`${path}/${fileName}:${className}`);

    const start = process.hrtime();
    const token = await Token.deploy(...constructorArguments);
    const receipt = await token.deploymentTransaction().wait();
    const end = process.hrtime(start);

    const latency = end[0] * 1000 + end[1] / 1e6;

    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Transaction fee (wei):", receipt.fee.toString());
    console.log("Deployment latency (ms):", latency);


    // Ease future graph representation
    if (network.name === "hh") {
        network.name = "hardhat";
    }

    if (fs.existsSync(deplyomentDataFile)) {
        const fileContent = fs.readFileSync(deplyomentDataFile, "utf8");
        let previousData = {};
        if (fileContent.trim().length > 0) {
            previousData = JSON.parse(fileContent);
        }
        Object.assign(contract_addresses, previousData);
    }

    contract_addresses[network.name] = {}


    contract_addresses[network.name]["deployment"] = {};
    contract_addresses[network.name]["deployment"]["contracts"] = {};
    contract_addresses[network.name]["deployment"]["metrics"] = {};

    contract_addresses[network.name]["deployment"]["contracts"]["Token"] = {
        address: token.target,
        deploymentGas: receipt.gasUsed.toString(),
        deploymentLatency: latency,
        deploymentFee: receipt.fee.toString()
    };

    contract_addresses[network.name]["deployment"]["metrics"] = {
        deploymentGas: receipt.gasUsed.toString(),
        deploymentLatency: latency,
        deploymentFee: receipt.fee.toString()
    }



    // Save addresses, gas, and latency to file
    fs.writeFileSync(deplyomentDataFile, JSON.stringify(contract_addresses, null, 2));
    console.log("✅ Contracts deployed and addresses saved.");
}

main();
