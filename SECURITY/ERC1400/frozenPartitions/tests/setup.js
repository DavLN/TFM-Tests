const { ethers } = require("hardhat");

async function globalSetup() {

    // File path to the ERC1400 contract
    const path = './contracts';
    const tokenFileName = "ERC1400.sol";
    //console.log(`Using token file: ${tokenFileName}`);

    // Addresses to be used in the tests
    const addr0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const addr1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const addr2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const addr3 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

    const addresses = [addr0, addr1, addr2, addr3];

    // Deployment parameters

    const tokenName = "ERC1400";
    const tokenSymbol = "1400";
    const tokenDecimals = 18n;
    const tokenGranularity = 1;
    const defaultPartitions = [
        ethers.hexlify(ethers.zeroPadValue("0x605ad247910ee49b99ebecaa12607bea59db8966de95decea831fd52f0931c39", 32)),
        ethers.hexlify(ethers.zeroPadValue("0x5e5b30f2f2d5053a53b4aa3d3f9890ff926a6d765f4b938fe4f3ed020420210f", 32)),
    ];

    
    const contructorArguments = [
        tokenName,
        tokenSymbol,
        tokenGranularity,
        [addr0],
        defaultPartitions
    ];


    // Deploy the ERC1400 token contract
    const ERC20 = await ethers.getContractFactory(`${path}/${tokenFileName}:ERC1400`);
    const token = await ERC20.deploy(...contructorArguments);


    // Set token addresses
    const signers = [];

    for (const address of addresses) {
        const signer = await ethers.getSigner(address);
        signers.push(signer);
    }

    // There may be some instances in which the owner is NOT set as minter
    if (!await token.connect(signers[0]).isMinter(addr0)) {
        console.log(`The owner ${addr0} is not a minter, adding it now.`);
        await token.connect(signers[0]).addMinter(addr0);
    }

    // Partitions (not the default ones)
    const partitions = [
        ethers.hexlify(ethers.zeroPadValue("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 32)),
        ethers.hexlify(ethers.zeroPadValue("0xbb34a521629ff272d9f4f6a74e54b73a4c45a5fb1eebaa7ff085bd97061bf226", 32)),
    ];

    // Issue tokens to addresses and store the total supply
    // For simplicity, balances would be the same for all partitions, so computation becomes easier
    const initializedBalances = [
        8n, // addr0
        4n, // addr1
        4n, // addr2
        0n, // addr3
    ];

    let balances = [
        0n, // addr0
        0n, // addr1
        0n, // addr2
        0n, // addr3
    ];

    let constructedTotalSupply = 0n;

    for (let i = 0; i < addresses.length; i++) {
        await token.connect(signers[0]).issue(addresses[i], initializedBalances[i], "0x00");
        balances[i] += initializedBalances[i];
        constructedTotalSupply += initializedBalances[i];

        // Issue tokens to partitions
        for (const partition of partitions) {
            await token.connect(signers[0]).issueByPartition(partition, addresses[i], initializedBalances[i], "0x00");
            balances[i] += initializedBalances[i];
            constructedTotalSupply += initializedBalances[i];
        }
    }


    // Document data
    const documentName = ethers.keccak256(ethers.toUtf8Bytes("Document name"));
    const documentHash = ethers.keccak256(ethers.toUtf8Bytes("Document data"));
    const documentURI = "https://example.com/document";

    // Predefined document
    await token.connect(signers[0]).setDocument(documentName, documentURI, documentHash);

    return {
        path,
        token,
        tokenName,
        tokenSymbol,
        tokenDecimals,
        tokenGranularity,
        addresses,
        signers,
        constructedTotalSupply,
        initializedBalances,
        balances,
        defaultPartitions,
        partitions,
        documentName,
        documentHash,
        documentURI,
    }
}

module.exports = globalSetup;
