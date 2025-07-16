const fs = require('fs');
const path = require('path');
const hre = require("hardhat");

async function readAddresses() {
    // Adjust the path as needed
    const filePath = path.join(__dirname, 'deployment-addresses.json');

    // Read and parse the JSON file
    const addresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    

    return addresses;
}

async function main() {
    const oracleAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

    const path = "contracts";
    const ethers = hre.ethers;
    const signers = await ethers.getSigners();

    const addresses = await readAddresses();

    const Token = await ethers.getContractFactory(`${path}/token/Token.sol:Token`);
    const token = await Token.attach(addresses.Token);

    const ComplianceModule = await ethers.getContractFactory(`${path}/compliance/modular/modules/NonSanctionModule.sol:NonSanctionModule`);
    const complianceModule = await ComplianceModule.attach(addresses.ComplianceModule);


    if (!await complianceModule.initialized()) {
        await complianceModule.connect(signers[0]).init(oracleAddress);
    }

    // Allowed transfers
    await token.connect(signers[2]).transfer(signers[3].address, 1n);
    await token.connect(signers[3]).transfer(signers[2].address, 1n);

    // Compliance check
    await complianceModule.connect(signers[0]).checkOracle(signers[2].address, signers[3].address);
    

    // It does not interfere with other transfers
    await token.connect(signers[2]).transfer(signers[1].address, 1n);
    await token.connect(signers[1]).transfer(signers[2].address, 1n);
    
    console.log("Awaiting for the oracle to respond");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Not allowed
    try {
        await token.connect(signers[2]).transfer(signers[3].address, 1n);
        console.error("Transfer not restricted");
    } catch (error) {
        console.log("Transfer restricted");
    }
}

main();
