const { expect } = require("chai");

function edgeCases (getSharedData) {
    describe("ERC1400 edge cases", function () {

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
        it("(TS-1400-056) should NOT allow transfers of zero tokens", async function () {
            await expect(shared.token.connect(shared.signers[1]).transfer(shared.addresses[3], 0))
            .to.be.reverted;
        });


        // It is compliant. However it cost gas, so warn the user in the frontend
        it("should allow self-transfer", async function () {
            await expect(shared.token.connect(shared.signers[1]).transfer(shared.addresses[1], 1n))
            .to.emit(shared.token, "Transfer")
            .withArgs(shared.addresses[1], shared.addresses[1], 1);

            const balanceAddr1 = await shared.token.balanceOf(shared.addresses[1]);
            expect(balanceAddr1).to.equal(shared.balances[1]); // Balance unchanged
        });

        it("should handle maximum uint256 transfer approval", async function () {
            await shared.token.connect(shared.signers[1]).approve(shared.addresses[2], maxUint256);
            const allowance = await shared.token.allowance(shared.addresses[1], shared.addresses[2]);
            expect(allowance).to.equal(maxUint256);
        });

        it("should PREVENT non-zero allowance update when re-approved", async function () {
            preBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.addresses[2]);

            await shared.token.connect(shared.signers[1]).approve(shared.addresses[2], 5n);

            // Latency strikes your re-approval
            const approvePromise = new Promise((resolve, reject) =>
            setTimeout(async (ishared) => {
                try {
                    await ishared.token.connect(ishared.signers[1]).approve(ishared.addresses[2], 1n);
                    reject("IT ALLOWED A DECEPTIVE ALLOWANCE RE-APPROVAL");

                } catch (err){
                    // It must fail to preserve consistency
                    resolve(err);
                }
            }, 500, shared)
            );

            // Unknowlingly legal transfer
            await shared.token.connect(shared.signers[2]).transferFrom(shared.addresses[1], shared.addresses[2], 3n);

            await approvePromise;

            // Delgate can continue transferring, as the tokenHolder only has two options
            // 1. Cease future allowance -> Set as 0
            // 2. Allow current allowance use
            await shared.token.connect(shared.signers[2]).transferFrom(shared.addresses[1], shared.addresses[2], 1n);

            postBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.addresses[2]);
            expect(preBalance + 4n).to.equal(postBalance);

            expect(shared.token.connect(shared.signers[1]).allowance(shared.addresses[1], shared.addresses[2]), 0);
        });

        it("should allow zero allowance update when re-approved", async function () {
            preBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.addresses[2]);

            await shared.token.connect(shared.signers[1]).approve(shared.addresses[2], 5n);

            // Latency strikes your re-approval
            const approvePromise = new Promise((resolve, reject) =>
            setTimeout(async (ishared) => {
                try {
                    await ishared.token.connect(ishared.signers[1]).approve(ishared.addresses[2], 0n);
                    resolve();
                } catch (err){
                    reject(err);
                }
            }, 500, shared)
            );

            // Unknowlingly legal transfer
            await shared.token.connect(shared.signers[2]).transferFrom(shared.addresses[1], shared.addresses[2], 3n);

            await approvePromise;

            await expect(shared.token.connect(shared.signers[2]).transferFrom(shared.addresses[1], shared.addresses[2], 2n)).
            to.be.reverted;

            postBalance = await shared.token.connect(shared.signers[2]).balanceOf(shared.addresses[2]);
            expect(preBalance + 3n).to.equal(postBalance);

            expect(shared.token.connect(shared.signers[1]).allowance(shared.addresses[1], shared.addresses[2]), 0);
        });

        // Test reentrancy vulnerability
        it("should resist reentrancy attack in transfer", async function () {
            // Deploy a malicious contract that attempts reentrancy
            const MaliciousReceiver = await ethers.getContractFactory(`${shared.path}/MaliciousReceiver.sol:MaliciousReceiver`);
            const malicious = await MaliciousReceiver.deploy(shared.token.target);

            // Transfer tokens to malicious contract
            await shared.token.connect(shared.signers[0]).transfer(malicious.target, 1n);



            // Attempt to trigger reentrancy
            await malicious.attack(shared.addresses[2], 1n);

            const attackerBalance = await shared.token.balanceOf(malicious.target);
            expect(attackerBalance).to.equal(0n); // No reentrant gain

        });

        it("should NOT allow issuing tokens for a non-minter (addr2)", async function () {
            const supply = await shared.token.connect(shared.signers[0]).totalSupply();

            await expect(shared.token.connect(shared.signers[2]).issue(shared.addresses[2], 1n, "0x00")).
            to.be.reverted;
        });


        // issue overflow
        it("should NOT allow issuing more tokens than the maximum uint256", async function () {
            const supply = await shared.token.connect(shared.signers[0]).totalSupply();

            await shared.token.connect(shared.signers[0]).issue(shared.addresses[0], maxUint256 - supply, "0x00");

            try {
                await shared.token.connect(shared.signers[0]).issue(shared.addresses[0], 1n, "0x00");
                expect.fail("Expected transaction to revert due to overflow or invalid issuance");
            } catch (error) {
                // Accept anything that indicates a revert (panic, require, etc.)
                expect(error.message).to.match(/revert|invalid opcode|panic/i);
            }
        });

        it("should NOT allow issuing more tokens in a partition than the totalSupply", async function () {
            const supply = await shared.token.connect(shared.signers[0]).totalSupply();

            await shared.token.connect(shared.signers[0]).issue(shared.addresses[0], maxUint256 - supply, "0x00");

            try {
                await shared.token.connect(shared.signers[0]).issueByPartition(shared.partitions[0], shared.addresses[0], 1n, "0x00");
                expect.fail("Expected transaction to revert due to overflow or partition constraint");
            } catch (error) {
                expect(error.message).to.match(/revert|invalid opcode|panic/i);
            }
        });


        // redeem underflow
        it("should NOT allow redeeming more tokens than the account balance", async function () {
            const beforeBalance = await shared.token.balanceOf(shared.addresses[0]);

            try {
                // Attempt to redeem more than balance
                await shared.token.connect(shared.signers[0]).redeem(beforeBalance + 1n, "0x00");
                expect.fail("Expected redeem to revert due to insufficient balance");
            } catch (error) {
                expect(error.message).to.match(/revert|invalid opcode|panic/i);
            }

            const afterBalance = await shared.token.balanceOf(shared.addresses[0]);
            expect(afterBalance).to.equal(beforeBalance); // Balance should remain unchanged
        });

        it("should NOT allow redeeming more tokens in a partition than the partition balance", async function () {
            const beforeBalancePerPartition = await shared.token.balanceOfByPartition(shared.partitions[0], shared.addresses[0]);
            const beforeBalance = await shared.token.balanceOf(shared.addresses[0]);

            try {
                // Attempt to redeem more than available in partition
                await shared.token.connect(shared.signers[0]).redeemByPartition(shared.partitions[0], beforeBalance + 1n, "0x00");
                expect.fail("Expected redeemByPartition to revert due to insufficient partition balance");
            } catch (error) {
                expect(error.message).to.match(/revert|invalid opcode|panic/i);
            }

            const afterBalancePerPartition = await shared.token.balanceOfByPartition(shared.partitions[0], shared.addresses[0]);
            const afterBalance = await shared.token.balanceOf(shared.addresses[0]);

            expect(afterBalancePerPartition).to.equal(beforeBalancePerPartition); // Partition balance should remain unchanged
            expect(afterBalance).to.equal(beforeBalance); // Overall balance should remain unchanged
        });

        it("should allow token recovery from maliciouslly transfered partition with ControllerTransfer", async function () {
            // Erase '0x', change the first hex digit after erasing to something different
            let partitionPreValue = shared.defaultPartitions[0].replace(/^0x/, "");
            let partitionValue = partitionPreValue;
            // All values to 0 unless it is 0, in that case to a
            if (partitionPreValue[0] !== '0') partitionValue = "a" + partitionPreValue.slice(1);
            else if (partitionPreValue[0] === '0');

            const misleadPartition = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" + partitionValue;


            await shared.token.connect(shared.signers[1]).authorizeOperator(shared.addresses[2]);

            await shared.token.connect(shared.signers[2]).operatorTransferByPartition(
                shared.defaultPartitions[0],
                shared.addresses[1],
                shared.addresses[3],
                1n,
                misleadPartition,
                "0x00",

            );

            // Try to recover tokens from the malicious transfer
            await shared.token.connect(shared.signers[0]).controllerTransfer(
                shared.addresses[3],
                shared.addresses[1],
                1n,
                "0x00",
                "0x00"
            );
        });

        it("should allow token recovery from maliciouslly transfered partition in some way", async function () {
            // Erase '0x', change the first hex digit after erasing to something different
            let partitionPreValue = shared.defaultPartitions[0].replace(/^0x/, "");
            let partitionValue = partitionPreValue;
            // All values to 0 unless it is 0, in that case to a
            if (partitionPreValue[0] !== '0') partitionValue = "a" + partitionPreValue.slice(1);
            else if (partitionPreValue[0] === '0');

            const misleadPartition = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" + partitionValue

            await shared.token.connect(shared.signers[1]).authorizeOperator(shared.addresses[2]);
            await shared.token.connect(shared.signers[2]).operatorTransferByPartition(
                shared.defaultPartitions[0],
                shared.addresses[1],
                shared.addresses[3],
                1n,
                misleadPartition,
                "0x00",
            );

            await shared.token.connect(shared.signers[0]).operatorTransferByPartition(
                "0x" + partitionValue,
                shared.signers[3].address,
                shared.signers[1].address,
                1n,
                "0x00",
                "0x00" // This area allows partition swapping, so you could restore it directly to the user original partiton and ease recovery for the user
                // However, the user recoveres control once this is executed and perform such movement
            );
        });
    });
}

module.exports = edgeCases;
