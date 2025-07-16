const { expect } = require("chai");

function erc20Compliance (getSharedData) {
    describe("ERC20 compliance", function () {
        const zeroAddress = "0x0000000000000000000000000000000000000000";
        let shared;

        beforeEach(async function () {
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        it("should return correct name, symbol, and decimals", async function () {
            expect(await shared.token.name()).to.equal(shared.tokenName);
            expect(await shared.token.symbol()).to.equal(shared.tokenSymbol);
            expect(await shared.token.decimals()).to.equal(shared.tokenDecimals);
        });

        it("should return the correct total supply", async function () {
            const totalSupply = await shared.token.connect(shared.signer0).totalSupply();
            expect(totalSupply).to.equal(shared.constructedTotalSupply);
        });

        it("should return the correct balance of addr0", async function () {
            const balance = await shared.token.connect(shared.signer0).balanceOf(shared.addr0);
            expect(balance).to.equal(shared.constructedTotalSupply / 2n);
        });

        it("should return the correct balance of addr1", async function () {
            const balance = await shared.token.connect(shared.signer0).balanceOf(shared.addr1);
            expect(balance).to.equal(shared.constructedTotalSupply / 4n);
        });

        it("should return the correct balance of addr2", async function () {
            const balance = await shared.token.connect(shared.signer0).balanceOf(shared.addr2);
            expect(balance).to.equal(shared.constructedTotalSupply / 4n);
        });

        it("should return the correct balance of addr3", async function () {
            const balance = await shared.token.connect(shared.signer0).balanceOf(shared.addr3);
            expect(balance).to.equal(0);
        });


        // transfer
        it("should NOT allow transfers of more tokens than balance", async function () {
            await expect(shared.token.connect(shared.signer1).transfer(shared.addr3, shared.constructedTotalSupply / 4n + 10n))
            .to.be.reverted;
        });

        it("should allow valid transfer and emit Transfer event", async function () {
            await expect(shared.token.connect(shared.signer1).transfer(shared.addr2, 2n))
            .to.emit(shared.token, "Transfer")
            .withArgs(shared.addr1, shared.addr2, 2n);

            const balanceAddr1 = await shared.token.balanceOf(shared.addr1);
            const balanceAddr2 = await shared.token.balanceOf(shared.addr2);
            expect(balanceAddr1).to.equal(shared.constructedTotalSupply / 4n - 2n);
            expect(balanceAddr2).to.equal(shared.constructedTotalSupply / 4n + 2n);
        });

        // allowance - approval
        // Test allowance function
        it("should return zero allowance for unapproved pair", async function () {
            const allowance = await shared.token.allowance(shared.addr1, shared.addr2);
            expect(allowance).to.equal(0);
        });

        it("should return correct allowance after approval", async function () {
            await shared.token.connect(shared.signer1).approve(shared.addr2, 3n);
            const allowance = await shared.token.allowance(shared.addr1, shared.addr2);
            expect(allowance).to.equal(3);
        });

        it("should update allowance when re-approved", async function () {
            await shared.token.connect(shared.signer1).approve(shared.addr2, 5n);
            await shared.token.connect(shared.signer1).approve(shared.addr2, 1n); // Reduce allowance

            const allowance = await shared.token.allowance(shared.addr1, shared.addr2);
            expect(allowance).to.equal(1n);
        });

        // Test Approval event
        it("should emit Approval event on approve", async function () {
            await expect(shared.token.connect(shared.signer1).approve(shared.addr2, 2n))
            .to.emit(shared.token, "Approval")
            .withArgs(shared.addr1, shared.addr2, 2n);
        });


        // old functions
        it("should NOT allow addr0 to transfer tokens on behalf of addr1 without allowance", async function () {
            await expect(shared.token.connect(shared.signer0).transferFrom(shared.addr1, shared.addr2, 1n))
            .to.be.reverted;
        });

        // transferFrom
        it("should allow an address with allowance to transfer tokens on behalf of another address and that emits Transfer", async function () {
            await shared.token.connect(shared.signer1).approve(shared.addr0, 1n);

            await expect(shared.token.connect(shared.signer0).transferFrom(shared.addr1, shared.addr2, 1n))
            .to.emit(shared.token, 'Transfer')
            .withArgs(shared.addr1, shared.addr2, 1n);

            const balanceAddr1 = await shared.token.connect(shared.signer0).balanceOf(shared.addr1);
            const balanceAddr2 = await shared.token.connect(shared.signer0).balanceOf(shared.addr2);

            expect(balanceAddr1).to.equal(shared.constructedTotalSupply / 4n - 1n);
            expect(balanceAddr2).to.equal(shared.constructedTotalSupply / 4n + 1n);
        });


        if ("should NOT allow an address to transfer more tokens than allowance granted", async function () {
            await shared.token.connect(shared.addr1).approve(shared.addr0, 1n);

            await expect(shared.token.connect(shared.addr0).transferFrom(shared.addr1, shared.addr2, 2n))
            .to.be.reverted;
        });

        it("should NOT allow transfer to zero address", async function () {
            await expect(shared.token.connect(shared.signer1).transfer(zeroAddress, 1n))
            .to.be.reverted;
        });

        it("should NOT allow approve to zero address", async function () {
            await expect(shared.token.connect(shared.signer1).approve(zeroAddress, 1n))
            .to.be.reverted;
        });

    });
}

module.exports = erc20Compliance;
