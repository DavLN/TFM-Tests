require('dotenv').config();
const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;

async function main() {

    const path = process.env.CONTRACT_PATH;

    const signers = await ethers.getSigners();

    const sender = signers[0];
    const receiver = signers[1];
    const amount = 1n;

    const resultsFile = "results.csv";

    const testingInterations = 10;

    // Blockchain data
    const network = await ethers.provider.getNetwork();

    if (network.name === "hh") {
        network.name = "hardhat";
    }

    console.log("Network name:", network.name);
    console.log("Chain ID:", network.chainId);

    const rpcUrl = hre.config.networks[hre.network.name]?.url;
    console.log("RPC URL:", rpcUrl);


    // Read the contract address from the JSON file
    const contract_addresses = JSON.parse(fs.readFileSync("deployment-addresses.json", "utf8"));
    const tokenAddress = contract_addresses[network.name]["deployment"]["contracts"]["token"].address;

    // Get the contract factory and attach to the deployed address
    const Token = await ethers.getContractFactory(`${path}/token/Token.sol:Token`);
    const token = await Token.attach(tokenAddress);

    let csvData = "";

    if (!fs.existsSync(resultsFile)) {
        csvData = "Operation, Gas, Fee (weis), Latency (ms), Blockchain\n"
    }


    const receiverList = [];
    const amountList = [];

    // 50 transfers per function call
    for (let i = 0; i < 50; i++) {
        receiverList[i] = receiver.address;
        amountList[i] = amount;
    }


    for (let i = 0; i < testingInterations; i++) {
        const start = process.hrtime();
        const tx = await token.connect(sender).batchTransfer(
            receiverList,
            amountList
        );

        const receipt = await tx.wait();
        const end = process.hrtime(start);

        const latency = end[0] * 1000 + end[1] / 1e6;

        console.log("Iteration:", i);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Transaction fee (wei):", receipt.fee.toString());
        console.log("Deployment latency (ms):", latency);
        console.log("");


        csvData += `batchTransfer, ${receipt.gasUsed.toString()}, ${receipt.fee.toString()}, ${latency}, ${network.name}\n`;
        //console.log(csvData);
    }

    // Save addresses, gas, and latency to file
    fs.appendFileSync(resultsFile, csvData);
    console.log("✅ Transactions executed and results saved.");
}

main();
