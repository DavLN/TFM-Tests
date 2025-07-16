const { expect } = require("chai");

function edgeCases (getSharedData) {
    describe("ERC20 edge cases", function () {

        const maxUint256 = (2n ** 256n) - 1n;
        const minUint256 = 0;

        let shared;

        beforeEach(async function () {
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        // compliant with ERC20, some contracts use it as a flag to detect an event. I DO NOT LIKE IT EITHER WAY
        it("should NOT allow transfers of zero tokens", async function () {
            await expect(shared.token.connect(shared.signer1).transfer(shared.addr3, 0))
            .to.be.reverted;
        });


        // It is compliant. However it cost gas, so warn the user in the frotend
        it("should allow self-transfer", async function () {
            await expect(shared.token.connect(shared.signer1).transfer(shared.addr1, 1n))
            .to.emit(shared.token, "Transfer")
            .withArgs(shared.addr1, shared.addr1, 1);

            const balanceAddr1 = await shared.token.balanceOf(shared.addr1);
            expect(balanceAddr1).to.equal(shared.constructedTotalSupply / 4n); // Balance unchanged
        });

        it("should handle maximum uint256 transfer approval", async function () {
            await shared.token.connect(shared.signer1).approve(shared.addr2, maxUint256);
            const allowance = await shared.token.allowance(shared.addr1, shared.addr2);
            expect(allowance).to.equal(maxUint256);
        });

        it("should PREVENT non-zero allowance update when re-approved", async function () {
            preBalance = await shared.token.connect(shared.signer2).balanceOf(shared.addr2);

            await shared.token.connect(shared.signer1).approve(shared.addr2, 5n);

            // Latency strikes your re-approval
            const approvePromise = new Promise((resolve, reject) =>
            setTimeout(async (ishared) => {
                try {
                    await ishared.token.connect(ishared.signer1).approve(ishared.addr2, 1n);
                    reject("IT ALLOWED A DECEPTIVE ALLOWANCE RE-APPROVAL");

                } catch (err){
                    // It must fail to preserve consistency
                    resolve(err);
                }
            }, 500, shared)
            );

            // Unknowlingly legal transfer
            await shared.token.connect(shared.signer2).transferFrom(shared.addr1, shared.addr2, 3n);

            await approvePromise;

            // Delgate can continue transferring, as the tokenHolder only has two options
            // 1. Cease future allowance -> Set as 0
            // 2. Allow current allowance use
            await shared.token.connect(shared.signer2).transferFrom(shared.addr1, shared.addr2, 1n);

            postBalance = await shared.token.connect(shared.signer2).balanceOf(shared.addr2);
            expect(preBalance + 4n).to.equal(postBalance);

            expect(shared.token.connect(shared.signer1).allowance(shared.addr1, shared.addr2), 0);
        });

        it("should allow zero allowance update when re-approved", async function () {
            preBalance = await shared.token.connect(shared.signer2).balanceOf(shared.addr2);

            await shared.token.connect(shared.signer1).approve(shared.addr2, 5n);

            // Latency strikes your re-approval
            const approvePromise = new Promise((resolve, reject) =>
            setTimeout(async (ishared) => {
                try {
                    await ishared.token.connect(ishared.signer1).approve(ishared.addr2, 0n);
                    resolve();
                } catch (err){
                    reject(err);
                }
            }, 500, shared)
            );

            // Unknowlingly legal transfer
            await shared.token.connect(shared.signer2).transferFrom(shared.addr1, shared.addr2, 3n);

            await approvePromise;

            await expect(shared.token.connect(shared.signer2).transferFrom(shared.addr1, shared.addr2, 2n)).
            to.be.reverted;

            postBalance = await shared.token.connect(shared.signer2).balanceOf(shared.addr2);
            expect(preBalance + 3n).to.equal(postBalance);

            expect(shared.token.connect(shared.signer1).allowance(shared.addr1, shared.addr2), 0);
        });

        // Test reentrancy vulnerability (simplified)
        it("should resist reentrancy attack in transfer", async function () {
            // Deploy a malicious contract that attempts reentrancy
            const MaliciousReceiver = await ethers.getContractFactory(`${shared.path}/MaliciousReceiver.sol:MaliciousReceiver`);
            const malicious = await MaliciousReceiver.deploy(shared.token.target);

            // Transfer tokens to malicious contract
            await shared.token.connect(shared.signer0).transfer(malicious.target, 1n);

            // Attempt to trigger reentrancy
            await malicious.attack(shared.addr2, 1n);

            const attackerBalance = await shared.token.balanceOf(malicious.target);
            expect(attackerBalance).to.equal(0n); // No reentrant gain
        });


        it("should NOT allow transfer that causes overflow", async function () {

            // Little adjustment to ease divisibility and try an overflow upon transfer
            await expect(shared.token.connect(shared.signer0).transfer(shared.addr1, (maxUint256 - 1n) / 2n))
            .to.be.reverted;
        });

        it("should NOT allow transfer that causes underflow", async function () {

            // Try to trigger the underflow
            await expect(shared.token.connect(shared.signer3).transfer(shared.addr1, 1n))
            .to.be.reverted;
        });
    });
}

module.exports = edgeCases;
