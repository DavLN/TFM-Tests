const { expect } = require("chai");

function regularTransfersCompliance (getSharedData) {
    describe("ERC1400 Regular transfers compliance", function () {
        const address0 = "0x0000000000000000000000000000000000000000";
        let shared;

        beforeEach(async function () {
            
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        // transfer
        it("(TS-1400-013) should NOT allow transfers of more tokens than balance", async function () {
            await expect(shared.token.connect(shared.signers[1]).transfer(shared.addresses[3], shared.balances[1] + 10n))
                .to.be.reverted;
        });

        it("should allow valid transfer and emit Transfer event", async function () {
            await expect(shared.token.connect(shared.signers[1]).transfer(shared.addresses[2], 2n))
            .to.emit(shared.token, "Transfer")
            .withArgs(shared.addresses[1], shared.addresses[2], 2n);

            const balanceAddr1 = await shared.token.balanceOf(shared.addresses[1]);
            const balanceAddr2 = await shared.token.balanceOf(shared.addresses[2]);
            expect(balanceAddr1).to.equal(shared.balances[1] - 2n);
            expect(balanceAddr2).to.equal(shared.balances[2] + 2n);
        });




        // Test allowance function
        it("should return zero allowance for unapproved pair", async function () {
            const allowance = await shared.token.allowance(shared.addresses[2], shared.addresses[2]);
            expect(allowance).to.equal(0);
        });

        it("should return correct allowance after approval", async function () {
            await expect(shared.token.connect(shared.signers[1]).approve(shared.addresses[2], 3n))
            .to.emit(shared.token, "Approval")
            .withArgs(shared.addresses[1], shared.addresses[2], 3n);

            const allowance = await shared.token.allowance(shared.addresses[1], shared.addresses[2]);
            expect(allowance).to.equal(3);
        });

        it("should update allowance when re-approved", async function () {
            await shared.token.connect(shared.signers[1]).approve(shared.addresses[2], 5n);
            await shared.token.connect(shared.signers[1]).approve(shared.addresses[2], 1n); // Reduce allowance

            const allowance = await shared.token.connect(shared.signers[1]).allowance(shared.addresses[1], shared.addresses[2]);
            expect(allowance).to.equal(1n);
        });

        it ("should NOT allow approval of zero address", async function () {
            await expect(shared.token.connect(shared.signers[1]).approve(address0, 1n))
                .to.be.revertedWith("56");
        });


        // transferFrom
        it("should allow an address with allowance to transfer tokens on behalf of another address and that emits Transfer", async function () {
            await shared.token.connect(shared.signers[1]).approve(shared.addresses[2], 1n);

            await expect(shared.token.connect(shared.signers[2]).transferFrom(shared.addresses[1], shared.addresses[3], 1n))
                .to.emit(shared.token, 'Transfer')
                .withArgs(shared.addresses[1], shared.addresses[3], 1n);

            const balanceAddr2 = await shared.token.connect(shared.signers[1]).balanceOf(shared.addresses[1]);
            const balanceAddr3 = await shared.token.connect(shared.signers[1]).balanceOf(shared.addresses[3]);

            expect(balanceAddr2).to.equal(shared.balances[1] - 1n);
            expect(balanceAddr3).to.equal(shared.balances[3] + 1n);
        });


        it("should NOT allow addr1 to transfer tokens on behalf of addr2 without allowance or being an operator", async function () {
            await expect(shared.token.connect(shared.signers[1]).transferFrom(shared.addresses[2], shared.addresses[3], 1n))
                .to.be.revertedWith("53");
        });

        it ("should NOT allow an address to transfer more tokens than allowance granted", async function () {
            await shared.token.connect(shared.signers[2]).approve(shared.addresses[3], 1n);

            await expect(shared.token.connect(shared.signers[3]).transferFrom(shared.addresses[2], shared.addresses[3], 2n))
                .to.be.revertedWith("53");
        });

    });
}

module.exports = regularTransfersCompliance;
