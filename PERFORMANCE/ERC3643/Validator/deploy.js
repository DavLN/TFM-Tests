require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const {network, ethers } = hre;

// signers[0] is pressumed to be the main issuer
async function forgeIdentity(identityRegistry, trustedIssuersRegistry, signers, identities, claimTopic) {
    const abiCoder = new ethers.AbiCoder();
    const initReceipts = {};

    for (let i = 1; i < identities.length; i++) {

        const keyAddition = await identities[i].connect(signers[i]).addKey(
            ethers.keccak256(
                abiCoder.encode(
                    ["address"],
                    [signers[0].address]
                )
            ),
            3,
            1
        );

        initReceipts[`keyAddition${i}`] = await keyAddition.wait();

        claimTopic["identity"] = signers[i].address;
        claimTopic["issuer"] = signers[0].address;

        claimTopic.id = ethers.keccak256(
            abiCoder.encode(
                ["address", "uint256"],
                [claimTopic.issuer, claimTopic.topic]
            )
        );

        const encoded = ethers.keccak256(
            abiCoder.encode(
                ["address", "uint256", "bytes"],
                [claimTopic.identity, claimTopic.topic, claimTopic.data]
            )
        );

        claimTopic.signature = await signers[0].signMessage(ethers.getBytes(
            encoded
        ));


        const claimAddition = await identities[i].connect(signers[i]).addClaim(
            claimTopic.topic,
            claimTopic.scheme,
            claimTopic.issuer,
            claimTopic.signature,
            claimTopic.data,
            claimTopic.uri
        );
        initReceipts[`claimAddition${i}`] = await claimAddition.wait();

        const UserRegistration = await identityRegistry.connect(signers[0]).registerIdentity(
            signers[i].address,
            identities[i].target,
            i // Some random country
        );
        initReceipts[`userRegistration${i}`] = await UserRegistration.wait();
    }

    return initReceipts;
}


async function main() {
    const abiCoder = new ethers.AbiCoder();
    
    const path = process.env.CONTRACT_PATH;
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

    // Obtain compilation data
    const Token = await ethers.getContractFactory(`${path}/token/Token.sol:${className}`);
    const IdentityRegistry = await ethers.getContractFactory(`${path}/registry/implementation/IdentityRegistry.sol:IdentityRegistry`);
    const IdentityRegistryStorage = await ethers.getContractFactory(`${path}/registry/implementation/IdentityRegistryStorage.sol:IdentityRegistryStorage`);
    const TrustedIssuersRegistry = await ethers.getContractFactory(`${path}/registry/implementation/TrustedIssuersRegistry.sol:TrustedIssuersRegistry`);
    const ClaimTopicsRegistry = await ethers.getContractFactory(`${path}/registry/implementation/ClaimTopicsRegistry.sol:ClaimTopicsRegistry`);

    const ModularCompliance = await ethers.getContractFactory(`${path}/compliance/modular/ModularCompliance.sol:ModularCompliance`);

    const Identity = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);

    const ClaimIssue = await ethers.getContractFactory(`${path}/ClaimIssuer.sol:ClaimIssuer`);


    // DEPLOYMENT
    const deploymentsReceipts = {};
    const identitiesInstances = [];

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


    for (let i = 0; i < 2; i++) {
        // For simplicity, the first identity is presumed to be a ClaimIssuer
        if (i === 0) {
            identitiesInstances[0] = await ClaimIssue.connect(signers[0]).deploy(signers[0].address);
            deploymentsReceipts["claimIssuer"] = await identitiesInstances[0].deploymentTransaction().wait();
        }
        else {
            identitiesInstances[i] = await Identity.connect(signers[0]).deploy(signers[i].address, false);
            deploymentsReceipts[`identity${i}`] = await identitiesInstances[i].deploymentTransaction().wait();
        }
    }

    const endDeployment = process.hrtime(startDeployment);
    console.log(endDeployment);

    // INITIALIZATION
    const initReceipts = {};

    const startInitialization = process.hrtime();


    const trustedIssuersRegistryInit = await trustedIssuersRegistry.connect(signers[0]).init();
    initReceipts["trustedIssuersRegistry"] = await trustedIssuersRegistryInit.wait();

    const claimTopicsRegistryInit = await claimTopicsRegistry.connect(signers[0]).init();
    initReceipts["claimTopicsRegistry"] = await claimTopicsRegistryInit.wait();

    const identityRegistryStorageInit = await identityRegistryStorage.connect(signers[0]).init();
    initReceipts["identityRegistryStorage"] = await identityRegistryStorageInit.wait();

    // Claim stuff
    const ckaimTopicsRegistryClaimAdd= await claimTopicsRegistry.connect(signers[0]).addClaimTopic(
        0
    );
    initReceipts["claimTopicAddition"] = await ckaimTopicsRegistryClaimAdd.wait();


    const claimTopic = {
        id: '',
        identity: signers[0].address,
        issuer: signers[0].address,
        topic: 0,
        scheme: 0,
        data: "0x00", // Data of interest
        signature: '', // Empty by the moment
        uri: "http://localhost/" // URI for more information
    }

    claimTopic.id = ethers.keccak256(
        abiCoder.encode(
            ["address", "uint256"],
            [claimTopic.issuer, claimTopic.topic]
        )
    );


    const encoded = ethers.keccak256(
        abiCoder.encode(
            ["address", "uint256", "bytes"],
            [claimTopic.identity, claimTopic.topic, claimTopic.data]
        )
    );

    claimTopic.signature = await signers[0].signMessage(ethers.getBytes(
        encoded
    ));

    const claimRegistration = await identitiesInstances[0].connect(signers[0]).addClaim(
        claimTopic.topic,
        claimTopic.scheme, // It informs about something to check against. It is an scheme. Anyways, it will not be checked in this implementation
        claimTopic.issuer, // The issuer of the claim
        claimTopic.signature,
        claimTopic.data, // Data of interest
        claimTopic.uri // URI for more information
    );
    initReceipts["claimRegistration"] = await claimRegistration.wait();


    // Privilege

    // Required workaround due to network saturation
    const nonce = await ethers.provider.getTransactionCount(signers[0].address, "latest");
    console.log(nonce)
    const trustedIssuerRegistration = await trustedIssuersRegistry.connect(signers[0]).addTrustedIssuer(
        identitiesInstances[0].target,
        [claimTopic.topic], // The topic of the claim
        { nonce }
    );
    initReceipts["trustedIssuerRegistration"] = await trustedIssuerRegistration.wait();
    // End of claim stuff

    // Identity Registry stuff

    // Concede agent role in the registry to the token (in order to verify identity)


    // Init registry
    const identityRegistryInit = await identityRegistry.connect(signers[0]).init(
        trustedIssuersRegistry.target,
        claimTopicsRegistry.target,
        identityRegistryStorage.target
    );
    initReceipts["identityRegistry"] = await identityRegistryInit.wait();

    // Registry storage privileges
    const identityRegistryPrivilege = await identityRegistryStorage.connect(signers[0]).addAgent(identityRegistry.target);
    initReceipts["identityRegistryPrivilege"] = await identityRegistryPrivilege.wait();

    const registryAgentAddition = await identityRegistry.connect(signers[0]).addAgent(signers[0].address);
    initReceipts["registryAgentAddition"] = await registryAgentAddition.wait();

    // REGISTER TRUSTED ISSUER
    const trustedIssuerAddition = await identityRegistry.connect(signers[0]).registerIdentity(
        signers[0].address,
        identitiesInstances[0].target,
        0
    );
    initReceipts["trustedIssuerAddition"] = await trustedIssuerAddition.wait();


    // Forge identities
    const forgeReceipts = await forgeIdentity(
        identityRegistry,
        trustedIssuersRegistry,
        signers,
        identitiesInstances,
        claimTopic
    );

    // Merge the forge receipts with the init receipts
    Object.assign(initReceipts, forgeReceipts);
    // End of identity registry stuff


    // Modular compliance initialization
    const modularComplianceInit = await modularCompliance.connect(signers[0]).init();
    initReceipts["modularCompliance"] = await modularComplianceInit.wait();



    // Token initialization
    const initToken = await token.init(
        identityRegistry.target,
        modularCompliance.target,
        'ERC3643',
        '3643',
        18,
        tokenIdentity.target
    );
    initReceipts["token"] = await initToken.wait();

    // Grant miniting privilges
    const addAgentToMint = await token.connect(signers[0]).addAgent(signers[0].address);
    initReceipts["tokenAgentAddition"] = await addAgentToMint.wait();

    // MINT
    const Mint = await token.connect(signers[0]).mint(
        signers[0].address,
        100000
    );
    initReceipts["tokenMint"] = await Mint.wait();


    // UNPAUSE DO NOT FORGET IT
    const tokenUnpause = await token.connect(signers[0]).unpause();
    initReceipts["tokenUnpause"] = await tokenUnpause.wait();

    const endInitialization = process.hrtime(startInitialization);

    console.log(endInitialization);

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


    // String is easier to read for gas and fee data format
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
    fs.writeFileSync(deploymentDataFile, JSON.stringify(contract_addresses, null, 2));
    console.log("✅ Contracts deployed and addresses saved.");
}

main();
