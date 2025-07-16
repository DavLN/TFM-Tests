//const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;

async function main() {
    const path = "contracts";
    
    const signers = await ethers.getSigners();
    const contract_addresses = {};

    const Token = await ethers.getContractFactory(`${path}/token/Token.sol:Token`);
    const token = await Token.deploy();
    contract_addresses["Token"] = token.target;

    const IdentityRegistry = await ethers.getContractFactory(`${path}/registry/implementation/IdentityRegistry.sol:IdentityRegistry`);
    const identityRegistry = await IdentityRegistry.deploy();
    contract_addresses["IdentityRegistry"] = identityRegistry.target;

    const IdentityRegistryStorage = await ethers.getContractFactory(`${path}/registry/implementation/IdentityRegistryStorage.sol:IdentityRegistryStorage`);
    const identityRegistryStorage = await IdentityRegistryStorage.deploy();
    contract_addresses["IdentityRegistryStorage"] = identityRegistryStorage.target;

    const TrustedIssuersRegistry = await ethers.getContractFactory(`${path}/registry/implementation/TrustedIssuersRegistry.sol:TrustedIssuersRegistry`);
    const trustedIssuersRegistry = await TrustedIssuersRegistry.deploy();
    contract_addresses["TrustedIssuersRegistry"] = trustedIssuersRegistry.target;


    const ClaimTopicsRegistry = await ethers.getContractFactory(`${path}/registry/implementation/ClaimTopicsRegistry.sol:ClaimTopicsRegistry`);
    const claimTopicsRegistry = await ClaimTopicsRegistry.deploy();
    contract_addresses["ClaimTopicsRegistry"] = claimTopicsRegistry.target;


    const ModularCompliance = await ethers.getContractFactory(`${path}/compliance/modular/ModularCompliance.sol:ModularCompliance`);
    const modularCompliance = await ModularCompliance.deploy();
    contract_addresses["ModularCompliance"] = modularCompliance.target;


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
    contract_addresses["IdentityToken"] = tokenIdentity.target;

    // Optional init calls
    await token.init(
        identityRegistry.target,
        modularCompliance.target,
        'TOKEN',
        'T',
        18,
        tokenIdentity.target
    );

    // Grant minting privileges
    await token.connect(signers[0]).addAgent(signers[0].address);

    // Concede agent role in the registry to the token (in order to verify identity)
    await identityRegistryStorage.connect(signers[0]).addAgent(identityRegistry.target);
    await identityRegistry.connect(signers[0]).addAgent(signers[0].address);

    //await identityRegistryStorage.connect(signers[0]).addAgent(signers[0].address);



    // Claim creation
    await claimTopicsRegistry.connect(signers[0]).addClaimTopic(
        0
    );

    console.log(await claimTopicsRegistry.getClaimTopics());

    // SIGNER 0 CLAIM ISSUER / IDENTITY
    const abiCoder = new ethers.AbiCoder();


    const ClaimIssuerInstance = await ethers.getContractFactory(`${path}/ClaimIssuer.sol:ClaimIssuer`);
    const claimIssuerInstance = await ClaimIssuerInstance.connect(signers[0]).deploy(signers[0].address);

    contract_addresses[`ClaimIssuer${0}`] = claimIssuerInstance.target;

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

    await claimIssuerInstance.connect(signers[0]).addClaim(
        claimTopic.topic,
        claimTopic.scheme, // It informs about something to check against. It is an scheme. Anyways, it will not be checked in this implementation
        claimTopic.issuer, // The issuer of the claim
        claimTopic.signature,
        claimTopic.data, // Data of interest
        claimTopic.uri // URI for more information
    );
    console.log("Claim added");

    // ADD TO YOURSELF TO THE TRUSTED ISSUERS REGISTRY, SO YOU CAN VERIFY YOURSELF
    console.log(claimIssuerInstance.target);
    await trustedIssuersRegistry.connect(signers[0]).addTrustedIssuer(
        claimIssuerInstance.target, // The claim issuer contract address
        [0] // topic
    );
    console.log(await trustedIssuersRegistry.getTrustedIssuersForClaimTopic(0));


    await identityRegistry.connect(signers[0]).registerIdentity(
        signers[0].address,
        claimIssuerInstance.target,
        0 // country code or similar
    );


    // Register identities
    for (let i = 1; i < Math.min(signers.length, 4); i++) {
        const IdentityFactory = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);
        console.log(`Iteracion ${i}`);

        const identityInstance = await IdentityFactory.connect(signers[0]).deploy(
            signers[i].address,
            false
        );

        contract_addresses[`Identity${i}`] = identityInstance.target;

        await identityInstance.connect(signers[i]).addKey(
            ethers.keccak256( // Signature key encoder
                abiCoder.encode(
                    ["address"],
                    [signers[0].address]
                )
            ),
            3, // 3 means that the key is a claim signing key
            1 // 1 means ECDSA key type
        );
        console.log("Key added");
    

        const claimTopic = {
            id: '',
            identity: signers[i].address,
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

        await identityInstance.connect(signers[i]).addClaim(
            claimTopic.topic,
            claimTopic.scheme, // It informs about something to check against. It is an scheme. Anyways, it will not be checked in this implementation
            claimTopic.issuer, // The issuer of the claim
            claimTopic.signature,
            claimTopic.data, // Data of interest
            claimTopic.uri // URI for more information
        );
        console.log("Claim added");

        await identityRegistry.connect(signers[0]).registerIdentity(
            signers[i].address,
            identityInstance.target,
            i // country code or similar
        );
        console.log("END");
    }

    // Mint some tokens
    for (let i = 0; i < Math.min(signers.length, 4); i++) {
        await token.connect(signers[0]).mint(
            // Non verified identities cannot interact in any way
            signers[i].address,
            10n
        );
    }

    // Allow transfers
    await token.unpause();

    await token.connect(signers[0]).transfer(
        signers[1].address,
        5n
    );

    await token.connect(signers[1]).transfer(
        signers[0].address,
        5n
    );


    // Save addresses to file
    fs.writeFileSync("deployment-addresses.json", JSON.stringify(contract_addresses, null, 2));
    console.log("✅ Contracts deployed and addresses saved.");
}

main();
