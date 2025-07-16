 //const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const { ethers } = require("hardhat");

// signers[0] is pressumed to be the main issuer
async function forgeIdentity(path, ethers, identityRegistry, trustedIssuersRegistry,signers, claimTopic, amount) {
    const abiCoder = new ethers.AbiCoder();


    let IdentityFactory, identityInstance;

    for (let i = 0; i < amount; i++) {

        // Claim Issuers need an specific type of Identity contract
        if (i === 0) {
            IdentityFactory = await ethers.getContractFactory(`${path}/ClaimIssuer.sol:ClaimIssuer`);
            identityInstance = await IdentityFactory.connect(signers[0]).deploy(signers[0].address);
        }
        else {
            IdentityFactory = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);
            identityInstance = await IdentityFactory.connect(signers[0]).deploy(signers[i].address, false);
        }

        claimTopic["identity"] = signers[i].address;
        claimTopic["issuer"] = signers[0].address;

        claimTopic.id = ethers.keccak256(
            abiCoder.encode(
                ["address", "uint256"],
                [claimTopic.issuer, claimTopic.topic]
            )
        );

        const encoder = ethers.keccak256(
            abiCoder.encode(
                ["address", "uint256", "bytes"],
                [claimTopic.identity, claimTopic.topic, claimTopic.data]
            )
        );

        claimTopic.signature = await signers[0].signMessage(ethers.getBytes(
            encoder
        ));

        await identityInstance.connect(signers[i]).addClaim(
            claimTopic.topic,
            claimTopic.scheme,
            claimTopic.issuer,
            claimTopic.signature,
            claimTopic.data,
            claimTopic.uri
        );

        await trustedIssuersRegistry.connect(signers[0]).addTrustedIssuer(
            identityInstance.target,
            [claimTopic.topic]
        );

        await identityRegistry.connect(signers[0]).registerIdentity(
            signers[i].address,
            identityInstance.target,
            i
        );
    }
}


async function globalSetup() {
    const path = "contracts";
    const ethers = hre.ethers;
    const signers = await ethers.getSigners();
    const addresses = {};

    const UserIdentity = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);
    const userIdentity = await UserIdentity.deploy(signers[0].address, false);

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await IdentityRegistry.deploy();

    const IdentityRegistryStorage = await ethers.getContractFactory("IdentityRegistryStorage");
    const identityRegistryStorage = await IdentityRegistryStorage.deploy();

    const TrustedIssuersRegistry = await ethers.getContractFactory("TrustedIssuersRegistry");
    const trustedIssuersRegistry = await TrustedIssuersRegistry.deploy();


    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    const claimTopicsRegistry = await ClaimTopicsRegistry.deploy();


    const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
    const modularCompliance = await ModularCompliance.deploy();



    // Identity Registry Storage
    await trustedIssuersRegistry.init();
    await claimTopicsRegistry.init();
    await identityRegistryStorage.init();

    await identityRegistry.init(
        trustedIssuersRegistry.target,
        claimTopicsRegistry.target,
        identityRegistryStorage.target
    );

    await modularCompliance.init();

    // Token operations
    const TokenIdentity = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);
    const tokenIdentity = await TokenIdentity.deploy(token.target, false);

    // Optional init calls
    await token.init(
        identityRegistry.target,
        modularCompliance.target,
        'ERC3643',
        '3643',
        18,
        tokenIdentity.target
    );





    // Grant miniting privilges
    await token.connect(signers[0]).addAgent(signers[0].address);

    // Concede agent role in the registry to the token (in order to verify identity)
    await identityRegistryStorage.addAgent(identityRegistry.target);
    await identityRegistry.addAgent(signers[0].address);


    // Claim Creation
    await claimTopicsRegistry.connect(signers[0]).addClaimTopic(
        0
    );


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

    await forgeIdentity(path, ethers, identityRegistry, trustedIssuersRegistry, signers, claimTopic, 4);


    // MINT
    for (let i = 0; i < Math.min(signers.length, 4); i++) {
        await token.connect(signers[0]).mint(
            // Non verified identities cannot interact in any way
            signers[i].address,
            10n
        );
    }

    // UNPAUSE DO NOT FORGET IT
    await token.connect(signers[0]).unpause();

    return {
        token,
        signers
    }

}

module.exports = globalSetup;
