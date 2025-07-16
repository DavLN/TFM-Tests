//const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");

async function main() {
    /*const provider = new ethers.JsonRpcProvider(
     *        'http://127.0.0.1:8544'
     *    );
     *
     *    const wallet = new ethers.Wallet(
     *        PRIVATE_KEY,
     *        provider
     *    );*/
    const path = "contracts";
    const ethers = hre.ethers;
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

    const ComplianceModule = await ethers.getContractFactory(`${path}/compliance/modular/modules/NonSanctionModule.sol:NonSanctionModule`);
    const complianceModule = await ComplianceModule.deploy();
    contract_addresses["ComplianceModule"] = complianceModule.target;


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

    await modularCompliance.addModule(
            complianceModule.target
    );


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
        16,
        tokenIdentity.target
    );

    // Grant minting privileges
    await token.addAgent(signers[0].address);

    // Concede agent role in the registry to the token (in order to verify identity) and be allowed to transfer
    await identityRegistryStorage.addAgent(identityRegistry.target);
    await identityRegistry.addAgent(signers[0].address);

    await identityRegistryStorage.addAgent(signers[0].address);

    for (let i = 0; i < Math.min(signers.length, 4); i++) {
        const signer = signers[i];
        const IdentityFactory = await ethers.getContractFactory(`${path}/Identity.sol:Identity`);
        const identityInstance = await IdentityFactory.deploy(token.target, false);
        contract_addresses[`Identity${i}`] = identityInstance.target;

        //await identityRegistryStorage.addAgent(signer.address);
        await identityRegistry.registerIdentity(
            signer.address,
            identityInstance.target,
            i // country code or similar
        );
    }

    // Mint some tokens
    for (let i = 0; i < Math.min(signers.length, 4); i++) {
        await token.mint(
            // Non verified identities cannot interact in any way
            signers[i].address,
            10n
        );
    }

    // Allow transfers
    await token.unpause();


    // Save addresses to file
    fs.writeFileSync("deployment-addresses.json", JSON.stringify(contract_addresses, null, 2));
    console.log("✅ Contracts deployed and addresses saved.");
}

main();
