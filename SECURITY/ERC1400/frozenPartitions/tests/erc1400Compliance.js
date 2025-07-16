const { expect } = require("chai");

const documentsCompliance = require("./compliance/documents.js");
const regularTransfersCompliance = require("./compliance/regularTransfers.js");
const partitionsCompliance = require("./compliance/partitions.js");
const forcedTransfersCompliance = require("./compliance/forcedTransfers.js");
const canTransferCompliance = require("./compliance/canTransfer.js");
const canTransferByPartitionCompliance = require("./compliance/canTransferByPartition.js");

function erc1400Compliance (getSharedData) {
    describe("ERC1400 compliance", function () {
        let shared;
        
        beforeEach(async function () {
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });


        // Remaning tests
        it("(TS-1400-001) should return correct name, symbol, and decimals", async function () {
            expect(await shared.token.name()).to.equal(shared.tokenName);
            expect(await shared.token.symbol()).to.equal(shared.tokenSymbol);
            expect(await shared.token.decimals()).to.equal(shared.tokenDecimals);
        });

        it("should return the correct total supply", async function () {
            const totalSupply = await shared.token.connect(shared.signers[0]).totalSupply();
            expect(totalSupply).to.equal(shared.constructedTotalSupply);
        });

        it("should return the correct balance of addr0", async function () {
            const balance = await shared.token.connect(shared.signers[0]).balanceOf(shared.addresses[0]);
            expect(balance).to.equal(shared.balances[0]);
        });

        it("should return the correct balance of addr1", async function () {
            const balance = await shared.token.connect(shared.signers[0]).balanceOf(shared.addresses[1]);
            expect(balance).to.equal(shared.balances[1]);
        });

        it("should return the correct balance of addr2", async function () {
            const balance = await shared.token.connect(shared.signers[0]).balanceOf(shared.addresses[2]);
            expect(balance).to.equal(shared.balances[2]);
        });

        it("should return the correct balance of addr3", async function () {
            const balance = await shared.token.connect(shared.signers[0]).balanceOf(shared.addresses[3]);
            expect(balance).to.equal(shared.balances[3]);
        });

        documentsCompliance(() => shared);
        regularTransfersCompliance(() => shared);
        partitionsCompliance(() => shared);
        forcedTransfersCompliance(() => shared);
        canTransferCompliance(() => shared);
        canTransferByPartitionCompliance(() => shared);
    });
}

module.exports = erc1400Compliance;
