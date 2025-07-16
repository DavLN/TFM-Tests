const { expect } = require("chai");

function edgeCases (getSharedData) {
    describe("ECR3643 edge cases", function () {

        let shared;
        const zeroAddress = "0x0000000000000000000000000000000000000000";

        beforeEach(async function () {
            
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });


        it("Allows transfers between identified addresses", async function () {
            const preBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const preBalanceReceiver = await shared.token.balanceOf(shared.signers[2].address);

            await shared.token.connect(shared.signers[1]).transfer(shared.signers[2].address, 1n);

            const postBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const postBalanceReceiver = await shared.token.balanceOf(shared.signers[2].address);

            expect(postBalanceSender).to.equal(preBalanceSender - 1n);
            expect(postBalanceReceiver).to.equal(preBalanceReceiver + 1n);

        });

        it("Allows transferFrom between identified addresses once approved", async function () {
            await shared.token.connect(shared.signers[1]).approve(shared.signers[2].address, 1n);
            const preBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const preBalanceReceiver = await shared.token.balanceOf(shared.signers[3].address);

            await shared.token.connect(shared.signers[2]).transferFrom(shared.signers[1].address, shared.signers[3].address, 1n);
            
            const postBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const postBalanceReceiver = await shared.token.balanceOf(shared.signers[3].address);
            
            expect(postBalanceSender).to.equal(preBalanceSender - 1n);
            expect(postBalanceReceiver).to.equal(preBalanceReceiver + 1n );

        });

        it ("Does NOT allow transferFrom over the approved amount with identified addresses", async function () {
            await shared.token.connect(shared.signers[1]).approve(shared.signers[2].address, 1n);
            const preBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const preBalanceReceiver = await shared.token.balanceOf(shared.signers[3].address);

            await expect(shared.token.connect(shared.signers[2]).transferFrom(shared.signers[1].address, shared.signers[3].address, 2n))
            .to.be.reverted;

            const postBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const postBalanceReceiver = await shared.token.balanceOf(shared.signers[3].address);
            
            expect(postBalanceSender).to.equal(preBalanceSender);
            expect(postBalanceReceiver).to.equal(preBalanceReceiver);
            
        });

        it("should PREVENT non-zero allowance update when re-approved", async function () {
            preBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.signers[2].address);

            await shared.token.connect(shared.signers[1]).approve(shared.signers[2].address, 5n);

            // Latency strikes your re-approval
            const approvePromise = new Promise((resolve, reject) =>
            setTimeout(async (ishared) => {
                try {
                    await ishared.token.connect(ishared.signers[1]).approve(ishared.signers[2].address, 1n);
                    reject("IT ALLOWED A DECEPTIVE ALLOWANCE RE-APPROVAL");

                } catch (err){
                    // It must fail to preserve consistency
                    resolve(err);
                }
            }, 500, shared)
            );

            // Unknowlingly legal transfer
            await shared.token.connect(shared.signers[2]).transferFrom(shared.signers[1].address, shared.signers[2].address, 3n);

            await approvePromise;

            // Delgate can continue transferring, as the tokenHolder only has two options
            // 1. Cease future allowance -> Set as 0
            // 2. Allow current allowance use
            await shared.token.connect(shared.signers[2].address).transferFrom(shared.signers[1].address, shared.signers[2].address, 1n);

            postBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.signers[2].address);
            expect(preBalance + 4n).to.equal(postBalance);

            expect(shared.token.connect(shared.signers[1]).allowance(shared.signers[1].address, shared.signers[2].address), 0);
        });

        it("should allow zero allowance update when re-approved", async function () {
            preBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.signers[2].address);

            await shared.token.connect(shared.signers[1]).approve(shared.signers[2].address, 5n);

            // Latency strikes your re-approval
            const approvePromise = new Promise((resolve, reject) =>
            setTimeout(async (ishared) => {
                try {
                    await ishared.token.connect(ishared.signers[1]).approve(ishared.signers[2].address, 0n);
                    resolve();
                } catch (err){
                    reject(err);
                }
            }, 500, shared)
            );

            // Unknowlingly legal transfer
            await shared.token.connect(shared.signers[2]).transferFrom(shared.signers[1].address, shared.signers[2].address, 3n);

            await approvePromise;

            await expect(shared.token.connect(shared.signers[2]).transferFrom(shared.signers[1].address, shared.signers[2].address, 2n)).
            to.be.reverted;

            postBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.signers[2].address);
            expect(preBalance + 3n).to.equal(postBalance);

            expect(shared.token.connect(shared.signers[1]).allowance(shared.signers[1].address, shared.signers[2].address), 0);
        });



        it("Does NOT allow token issuing to unverified addresses", async function () {
            await expect(shared.token.connect(shared.signers[0]).mint(shared.signers[4].address, 1n))
            .to.be.reverted;

            expect(await shared.token.balanceOf(shared.signers[4].address)).to.equal(0n);
        });

        it("Does NOT allow unverifed addresses to receive tokens with transfer", async function() {
            await expect(shared.token.connect(shared.signers[1]).transfer(shared.signers[4].address, 1n))
            .to.be.reverted;

            expect(await shared.token.balanceOf(shared.signers[4].address)).to.equal(0n);
        });

        it ("Does NOT allow unverifed addresses to receive tokens with transferFrom", async function () {
            await shared.token.connect(shared.signers[1]).approve(shared.signers[2].address, 1n);

            await expect(shared.token.connect(shared.signers[1]).transferFrom(shared.signers[2].address, shared.signers[4].address, 1n))
            .to.be.reverted;

            expect(await shared.token.balanceOf(shared.signers[4].address)).to.equal(0n);
        });
            
        it("Does NOT allow transfers of zero tokens", async function () {
            const preBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const preBalanceReceiver = await shared.token.balanceOf(shared.signers[2].address);

            await expect(shared.token.connect(shared.signers[1]).transfer(shared.signers[2].address, 0n))
            .to.be.reverted;

            const postBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const postBalanceReceiver = await shared.token.balanceOf(shared.signers[2].address);

            expect(postBalanceSender).to.equal(preBalanceSender);
            expect(postBalanceReceiver).to.equal(preBalanceReceiver);
        });

        it("Does NOT allow transfers to the zero address", async function () {
            const preBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const preBalanceReceiver = await shared.token.balanceOf(zeroAddress);

            await expect(shared.token.connect(shared.signers[1]).transfer(zeroAddress, 1n))
            .to.be.reverted;

            const postBalanceSender = await shared.token.balanceOf(shared.signers[1].address);
            const postBalanceReceiver = await shared.token.balanceOf(zeroAddress);

            expect(postBalanceSender).to.equal(preBalanceSender);
            expect(postBalanceReceiver).to.equal(preBalanceReceiver);
        });

        it("Does NOT allow transfers from the zero address", async function () {
            const preBalanceSender = await shared.token.balanceOf(zeroAddress);
            const preBalanceReceiver = await shared.token.balanceOf(shared.signers[2].address);


            await expect(shared.token.connect(shared.signers[0]).transferFrom(zeroAddress, shared.signers[2].address, 1n))
            .to.be.reverted;

            const postBalanceSender = await shared.token.balanceOf(zeroAddress);
            const postBalanceReceiver = await shared.token.balanceOf(shared.signers[2].address);

            expect(postBalanceSender).to.equal(preBalanceSender);
            expect(postBalanceReceiver).to.equal(preBalanceReceiver);

        });
    });
}

module.exports = edgeCases;
