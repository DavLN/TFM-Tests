require('dotenv').config();
const hre = require("hardhat");
const fs = require("fs");
const {network, ethers}= hre;

async function main() {
    
    const path = process.env.CONTRACT_PATH;
    const className = process.env.CONTRACT_CLASS;

    if (network.name === "hh") {
        // Mine N empty blocks to stabilize base fee
        for (let i = 0; i < 100; i++) {
            await network.provider.send("evm_mine");
        }
    }

    // It MUST be a JSON file
    const deplyomentDataFile = "deployment-addresses.json";

    const signers = await ethers.getSigners();

    const contract_addresses = {};



    // Obtain compilation data
    const Token = await ethers.getContractFactory(`${path}/token/Token.sol:${className}`);
    const IdentityRegistry = await ethers.getContractFactory(`${path}/registry/implementation/IdentityRegistry.sol:IdentityRegistry`);
    const IdentityRegistryStorage = await ethers.getContractFactory(`${path}/registry/implementation/IdentityRegistryStorage.sol:IdentityRegistryStorage`);
    const TrustedIssuersRegistry = await ethers.getContractFactory(`${path}/registry/implementation/TrustedIssuersRegistry.sol:TrustedIssuersRegistry`);
    const ClaimTopicsRegistry = await ethers.getContractFactory(`${path}/registry/implementation/ClaimTopicsRegistry.sol:ClaimTopicsRegistry`);

    const ModularCompliance = await ethers.getContractFactory(`${path}/compliance/modular/ModularCompliance.sol:ModularCompliance`);

    const Identity = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);


    const usersIdentities = [];
    const usersIdentitiesReceipt = [];

    const deploymentsReceipts = {};
    
    // Deploy
    const startDeployment = process.hrtime();
    const token = await Token.deploy();
    deploymentsReceipts["token"] = await token.deploymentTransaction().wait();

    const identityRegistry = await IdentityRegistry.deploy();
    deploymentsReceipts["identityRegistry"] = await identityRegistry.deploymentTransaction().wait();

    const identityRegistryStorage = await IdentityRegistryStorage.deploy();
    deploymentsReceipts["identityRegistryStorage"] = await identityRegistryStorage.deploymentTransaction().wait();

    const trustedIssuersRegistry = await TrustedIssuersRegistry.deploy();
    deploymentsReceipts["trustedIssuersRegistry"] = await trustedIssuersRegistry.deploymentTransaction().wait();

    const claimTopicsRegistry = await ClaimTopicsRegistry.deploy();
    deploymentsReceipts["claimTopicsRegistry"] = await claimTopicsRegistry.deploymentTransaction().wait();

    const modularCompliance = await ModularCompliance.deploy();
    deploymentsReceipts["modularCompliance"] = await modularCompliance.deploymentTransaction().wait();

    const tokenIdentity = await Identity.deploy(token.target, false);
    deploymentsReceipts["tokenIdentity"] = await tokenIdentity.deploymentTransaction().wait();

    // You need at least two verified users to transfer tokens
    for (let i = 0; i < 2; i++) {
        usersIdentities[i] = await Identity.deploy(signers[i].address, false);
        usersIdentitiesReceipt[i] = await usersIdentities[i].deploymentTransaction().wait();
    }

    const endDeployment = process.hrtime(startDeployment);

    // INITIALIZATION
    const initReceipts = {};

    const startInitialization = process.hrtime();

    // Registries initialization
    const trustedIssuersRegistryInitialization = await trustedIssuersRegistry.connect(signers[0]).init();
    initReceipts["trustedIssuersRegistry"] = await trustedIssuersRegistryInitialization.wait();

    const claimTopicsRegistryInitialization = await claimTopicsRegistry.connect(signers[0]).init();
    initReceipts["claimTopicsRegistry"] = await claimTopicsRegistryInitialization.wait();

    const identityRegistryStorageInitialization = await identityRegistryStorage.connect(signers[0]).init();
    initReceipts["identityRegistryStorage"] = await identityRegistryStorageInitialization.wait();

    // Grant the identityRegistry privileges over its storage
    const identityRegistryPrivilege = await identityRegistryStorage.connect(signers[0]).addAgent(identityRegistry.target);
    initReceipts["identityRegistryPrivilege"] = await identityRegistryPrivilege.wait();

    // End of permission management

    const identityRegistryInitialization = await identityRegistry.connect(signers[0]).init(
        trustedIssuersRegistry.target,
        claimTopicsRegistry.target,
        identityRegistryStorage.target
    );
    initReceipts["identityRegistry"] = await identityRegistryInitialization.wait();


    // Compliance initialization
    const modularComplianceInitialization = await modularCompliance.connect(signers[0]).init();
    initReceipts["modularCompliance"] = await modularComplianceInitialization.wait();


    // Token initialization
    const tokenInitialization = await token.connect(signers[0]).init(
        identityRegistry.target,
        modularCompliance.target,
        'ERC3643',
        '3643',
        18,
        tokenIdentity.target
    );
    initReceipts["token"] = await tokenInitialization.wait();

    // Agent role addition to the desired privileged address

    // MINTING
    const agentAddition = await token.connect(signers[0]).addAgent(signers[0].address);
    initReceipts["agentAddition"] = await agentAddition.wait();

    // REGISTRY PRIVILEGE
    const registryAgentAddition = await identityRegistry.connect(signers[0]).addAgent(signers[0].address);
    initReceipts["registryAgentAddition"] = await registryAgentAddition.wait();

    // Register users in the Identity Registry
    for (let i = 0; i < usersIdentities.length; i++) {
        const UserRegistration = await identityRegistry.connect(signers[0]).registerIdentity(
            signers[i].address,
            usersIdentities[i],
            0 // It does not matter for the test. Pick a random "country"
        );
        initReceipts[`userRegistration${i}`] = await UserRegistration.wait();
    }


    // Deployer is Minter by default
    const Mint = await token.connect(signers[0]).mint(signers[0].address, 100000);
    initReceipts["mint"] = await Mint.wait();

    // Unpause the contract
    const Unpause = await token.connect(signers[0]).unpause();
    initReceipts["unpause"] = await Unpause.wait();
    
    const endInitialization = process.hrtime(startInitialization);

    // Not included for performance metrics as this goes beyond the minimal readiness of the contract
    let result;

    result = await token.connect(signers[0]).mint(signers[1].address, 100000);
    await result.wait();


    // Collect and expose gas and latency data for DEPLOYMENT
    const deploymentLatency = (endDeployment[0] * 1000 + endDeployment[1] / 1e6);

    let deploymentGas = 0;
    let deploymentFee = 0;

    for (const receipt of Object.keys(deploymentsReceipts)) {
        const receiptData = deploymentsReceipts[receipt];
        deploymentGas += Number(receiptData.gasUsed);
        deploymentFee += Number(receiptData.fee);
    }


    // Collect and expose gas and latency data for INITIALIZATION
    const initLatency = (endInitialization[0] * 1000 + endInitialization[1] / 1e6);

    let initGas = 0;
    let initFee = 0;

    for (const receipt of Object.keys(initReceipts)) {
        const receiptData = initReceipts[receipt];
        initGas += Number(receiptData.gasUsed);
        initFee += Number(receiptData.fee);
    }


    console.log("DEPLOYMENT:")
    console.log("Gas used:", deploymentGas.toString());
    console.log("Transaction fee (wei):", deploymentFee.toString());
    console.log("Deployment latency (ms):", deploymentLatency);
    console.log();
    console.log("INITIALIZATION:")
    console.log("Gas used:", initGas.toString());
    console.log("Transaction fee (wei):", initFee.toString());
    console.log("Latency (ms):", initLatency);
    console.log();



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

    // Deployment data
    contract_addresses[network.name]["deployment"] = {};
    contract_addresses[network.name]["deployment"]["contracts"] = {};
    contract_addresses[network.name]["deployment"]["metrics"] = {};


    contract_addresses[network.name]["deployment"]["metrics"] = {
        deploymentGas: deploymentGas.toString(),
        deploymentLatency: deploymentLatency,
        deploymentFee: deploymentFee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["token"] = {
        address: token.target,
        deploymentGas: deploymentsReceipts["token"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["token"].fee.toString()
    };

    contract_addresses[network.name]["deployment"]["contracts"]["identityRegistry"] = {
        address: identityRegistry.target,
        deploymentGas: deploymentsReceipts["identityRegistry"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["identityRegistry"].fee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["identityRegistryStorage"] = {
        address: identityRegistryStorage.target,
        deploymentGas: deploymentsReceipts["identityRegistryStorage"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["identityRegistryStorage"].fee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["trustedIssuersRegistry"] = {
        address: trustedIssuersRegistry.target,
        deploymentGas: deploymentsReceipts["trustedIssuersRegistry"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["trustedIssuersRegistry"].fee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["claimTopicsRegistry"] = {
        address: claimTopicsRegistry.target,
        deploymentGas: deploymentsReceipts["claimTopicsRegistry"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["claimTopicsRegistry"].fee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["modularCompliance"] = {
        address: modularCompliance.target,
        deploymentGas: deploymentsReceipts["modularCompliance"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["modularCompliance"].fee.toString(),
    };

    contract_addresses[network.name]["deployment"]["contracts"]["tokenIdentity"] = {
        address: tokenIdentity.target,
        deploymentGas: deploymentsReceipts["tokenIdentity"].gasUsed.toString(),
        deploymentFee: deploymentsReceipts["tokenIdentity"].fee.toString(),
    };


    // Initialization data
    contract_addresses[network.name]["initialization"] = {};
    //contract_addresses[network.name]["initialization"]["contracts"] = {};
    contract_addresses[network.name]["initialization"]["metrics"] = {};

    contract_addresses[network.name]["initialization"]["metrics"] = {
        initializationGas: initGas.toString(),
        initializationLatency: initLatency,
        initializationFee: initFee.toString(),
    }

    // Save addresses, gas, and latency to file
    fs.writeFileSync(deplyomentDataFile, JSON.stringify(contract_addresses, null, 2));
    console.log("✅ Contracts deployed and addresses saved.");
}

main();
