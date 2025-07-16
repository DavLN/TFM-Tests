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
        console.log("MY ORACLE ADDRESS", oracleAddress);
        await complianceModule.connect(signers[0]).init(oracleAddress);
    }
    
    // Compliance check
    await complianceModule.connect(signers[0]).checkOracle(signers[0].address, signers[1].address);
    

    console.log("Awaiting for the oracle to respond");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Not allowed
    try {
        console.log(signers[0].address, signers[1].address);
        await token.connect(signers[0]).transfer(signers[1].address, 1n);
        console.error("Transfer not restricted");
    } catch (error) {
        console.log("Transfer restricted", error.message);
    }
}

main();
