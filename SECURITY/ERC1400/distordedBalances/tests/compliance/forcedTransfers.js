const { expect } = require('chai');

function forcedTransfersCompliance(getSharedData) {
    describe("ERC1400 Forced Transfers compliance", function () {
        let shared;

        this.beforeEach(async function () {
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        it("should be controllable (required for the following tests - NO COMPUTABLE)", async function() {
            expect(await shared.token.isControllable()).to.equal(true);
        });

        it("(TS-1400-37) should allow the controller to force transfer tokens", async function() {
            const amount = 1n;
            const from = shared.addresses[1];
            const to = shared.addresses[2];

            await expect(shared.token.connect(shared.signers[0]).controllerTransfer(
                from,
                to,
                amount,
                "0x00",
                "0x00",
            )).to.emit(shared.token, "ControllerTransfer")
            .withArgs(shared.addresses[0], from, to, amount, "0x00", "0x00");

            const balanceFrom = await shared.token.balanceOf(from);
            const balanceTo = await shared.token.balanceOf(to);

            expect(balanceFrom).to.equal(shared.balances[1] - amount);
            expect(balanceTo).to.equal(shared.balances[2] + amount);
        });

        it("should allow the controller to force redeem tokens", async function() {

            const amount = 1n;
            const from = shared.addresses[2];

            const balanceBefore = await shared.token.connect(shared.signers[0]).balanceOf(from);

            await expect(shared.token.connect(shared.signers[0]).controllerRedeem(
                from,
                amount,
                "0x00",
                "0x00",
            )).to.emit(shared.token, "ControllerRedemption")
            .withArgs(shared.addresses[0], from, amount, "0x00", "0x00");

            const balanceAfter = await shared.token.connect(shared.signers[0]).balanceOf(from);
            expect(balanceAfter).to.equal(balanceBefore - amount);

        });

        it("should NOT allow non-controller to force transfer tokens", async function() {
            const amount = 1n;

            await expect(shared.token.connect(shared.signers[1]).controllerTransfer(
                shared.addresses[2],
                shared.addresses[1],
                amount,
                "0x00",
                "0x00",
            )).to.be.reverted;
        });

        it("should NOT allow non-controller to force redeem tokens", async function() {
            const amount = 1n;

            for(const address of shared.addresses) {
                await expect(shared.token.connect(shared.signers[1]).controllerRedeem(
                    address,
                    amount,
                    "0x00",
                    "0x00",
                )).to.be.reverted;
            }
        });
    });
}

module.exports = forcedTransfersCompliance;
