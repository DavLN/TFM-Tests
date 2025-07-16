const { ethers } = require("hardhat");

async function globalSetup() {

    const path = './contracts';
    const tokenFileName = '1.simpleToken.sol';
    const contractName = 'E20OpenZeppelin';
    //console.log(`Using token file: ${tokenFileName}`);

    const addr0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const addr1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    const addr2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

    const addr3 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const constructedTotalSupply = (2n ** 256n) - 4n; // MAX -1n
    const tokenName = "ERC20";
    const tokenSymbol = "20";
    const tokenDecimals = 18;


    const contructorArguments = [
        constructedTotalSupply
    ];

    const ERC20 = await ethers.getContractFactory(`${path}/${tokenFileName}:${contractName}`);
    const token = await ERC20.deploy(...contructorArguments);
    //await token.waitForDeployment();

    const signer0 = await ethers.getSigner(addr0);
    const signer1 = await ethers.getSigner(addr1);
    const signer2 = await ethers.getSigner(addr2);
    const signer3 = await ethers.getSigner(addr3);


    // addr0 HALF, addr1 QUARTER, addr2 QUARTER, addr3 ZERO
    await token.connect(signer0).transfer(addr1, constructedTotalSupply / 2n);
    await token.connect(signer1).transfer(addr2, constructedTotalSupply / 4n);

    return {
        path,
        token,
        tokenName,
        tokenSymbol,
        tokenDecimals,
        addr0,
        addr1,
        addr2,
        addr3,
        signer0,
        signer1,
        signer2,
        signer3,
        constructedTotalSupply,
    }
}

module.exports = globalSetup;
