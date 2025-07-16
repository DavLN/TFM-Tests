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
    const deploymentDataFile = "deployment-addresses.json";

    const signers = await ethers.getSigners();

    const contract_addresses = {};


    const defaultPartitions = [
        ethers.hexlify(ethers.zeroPadValue("0x605ad247910ee49b99ebecaa12607bea59db8966de95decea831fd52f0931c39", 32)),
        ethers.hexlify(ethers.zeroPadValue("0x5e5b30f2f2d5053a53b4aa3d3f9890ff926a6d765f4b938fe4f3ed020420210f", 32)),
    ];

    const constructorArguments = [
        "ERC1400",
        "1400",
        1,
        [signers[0].address],
        defaultPartitions
    ];

    // Obtain compilation data
    const Token = await ethers.getContractFactory(`${path}/${fileName}:${className}`);

    // Deploy
    const start = process.hrtime();
    const token = await Token.deploy(...constructorArguments);
    const receipt = await token.deploymentTransaction().wait();
    const end = process.hrtime(start);

    const latency = end[0] * 1000 + end[1] / 1e6;

    const partitions = [
        ethers.hexlify(ethers.zeroPadValue("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 32)),
        ethers.hexlify(ethers.zeroPadValue("0xbb34a521629ff272d9f4f6a74e54b73a4c45a5fb1eebaa7ff085bd97061bf226", 32)),
    ];

    // Deployer is Minter by default
    const issueStart = process.hrtime();
    const issueTransaction = await token.connect(signers[0]).issue(signers[0].address, 100000, "0x00");
    const issueReceipt = await issueTransaction.wait();
    const issueEnd = process.hrtime(issueStart);

    

    // Not included as this goes beyond the minimal readiness of the contract
    let result;
    result = await token.connect(signers[0]).issue(signers[1].address, 100000, "0x00");
    await result.wait();

    // Not included as this goes beyond the minimal readiness of the contract
    for (const partition of partitions) {
        result = await token.connect(signers[0]).issueByPartition(partition, signers[0].address, 100000, "0x00");
        await result.wait();
        result = await token.connect(signers[0]).issueByPartition(partition, signers[1].address, 100000, "0x00");
        await result.wait();
    }


    const totalInitializationGas = issueReceipt.gasUsed;
    const totalInitializationFee = issueReceipt.fee;
    const totalInitializationLatency = issueEnd[0] * 1000 + issueEnd[1] / 1e6;


    console.log("DEPLOYMENT:")
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Transaction fee (wei):", receipt.fee.toString());
    console.log("Deployment latency (ms):", latency);
    console.log();
    console.log("INITIALIZATION:")
    console.log("Gas used:", totalInitializationGas.toString());
    console.log("Transaction fee (wei):", totalInitializationFee.toString());
    console.log("Latency (ms):", totalInitializationLatency);
    console.log();


    // Ease future graph representation
    if (network.name === "hh") {
        network.name = "hardhat";
    }

    if (fs.existsSync(deploymentDataFile)) {
        const fileContent = fs.readFileSync(deploymentDataFile, "utf8");
        let previousData = {};
        if (fileContent.trim().length > 0) {
            previousData = JSON.parse(fileContent);
        }
        Object.assign(contract_addresses, previousData);
    }

    contract_addresses[network.name] = {}

    // Deployment data
    contract_addresses[network.name]["deployment"] = {};
    contract_addresses[network.name]["deployment"]["contracts"] = {};
    contract_addresses[network.name]["deployment"]["metrics"] = {};


    contract_addresses[network.name]["deployment"]["metrics"] = {
        deploymentGas: receipt.gasUsed.toString(),
        deploymentLatency: latency,
        deploymentFee: receipt.fee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["Token"] = {
        address: token.target,
        deploymentGas: receipt.gasUsed.toString(),
        deploymentLatency: latency,
        deploymentFee: receipt.fee.toString(),
        initializationGas: totalInitializationGas.toString(),
        initializationLatency: totalInitializationLatency,
    };

    // Initialization data
    contract_addresses[network.name]["initialization"] = {};
    //contract_addresses[network.name]["initialization"]["contracts"] = {};
    contract_addresses[network.name]["initialization"]["metrics"] = {};

    contract_addresses[network.name]["initialization"]["metrics"] = {
        initializationGas: totalInitializationGas.toString(),
        initializationLatency: totalInitializationLatency,
        initializationFee: totalInitializationFee.toString(),
    }


    // Save addresses, gas, and latency to file
    fs.writeFileSync(deploymentDataFile, JSON.stringify(contract_addresses, null, 2));
    console.log("✅ Contracts deployed and addresses saved.");
}

main();
