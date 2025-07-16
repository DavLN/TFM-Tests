const { expect } = require("chai");

function partitionsCompliance(getSharedData) {
    describe("ERC1400 Partitions compliance", function () {
        let shared;

        beforeEach(async function () {
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        it("(TS-1400-022) should return the correct balance for each partition", async function () {
            for (const partition of shared.partitions) {

                for (let i = 0; i < shared.addresses.length; i++) {
                    const balance = await shared.token.connect(shared.signers[0]).balanceOfByPartition(partition, shared.addresses[i]);
                    expect(balance).to.equal(shared.initializedBalances[i]);
                }
            }
        });

        it("should be that adding each partition balance equals returned balance", async function () {
            let balancePerAddress = [
                0n, // addr0
                0n, // addr1
                0n, // addr2
                0n, // addr3
            ];
            
            const allPartitions = [...shared.partitions, ...shared.defaultPartitions];

            for (const partition of allPartitions) {
                for (let i = 0; i < shared.addresses.length; i++) {
                    const balance = await shared.token.connect(shared.signers[0]).balanceOfByPartition(partition, shared.addresses[i]);
                    balancePerAddress[i] += balance;
                }
            }
            
            // Compared if the partitioned balances sum up to the total balance per address
            for (let i = 0; i < shared.addresses.length; i++) {
                const balance = await shared.token.connect(shared.signers[0]).balanceOf(shared.addresses[i]);
                expect(balance).to.equal(balancePerAddress[i]);
            }

        });
        
        // TODO: The official standard does not recognize these functions, so put them into a separate file
        // allowances
        /*it("should return zero allowance for unapproved pair", async function () {
            for (const partition of shared.partitions) {
                const allowance = await shared.token.connect(shared.signer[1]).allowanceByPartition(partition, shared.addresses[2], shared.addresses[3]);
                expect(allowance).to.equal(0n);
            }
        });

        it("should return correct allowance after approval", async function () {
            for (const partition of shared.partitions) {

                await shared.token.connect(shared.signers[1]).approveByPartition(partition, shared.addresses[2], 3n);
                const allowance = await shared.token.connect(shared.signers[2]).allowanceByPartition(partition, shared.addresses[2], shared.addresses[3]);
                expect(allowance).to.equal(3n);
            }
        });

        it("should update allowance when re-approved", async function () {
            for (const partition of shared.partitions) {

                await shared.token.connect(shared.signers[1]).approveByPartition(partition, shared.addresses[2], 5n);
                await shared.token.connect(shared.signers[1]).approveByPartition(partition, shared.addresses[2], 1n); // Reduce allowance
                const allowance = await shared.token.connect(shared.signers[2]).allowanceByPartition(partition, shared.addresses[2], shared.addresses[3]);
                expect(allowance).to.equal(1n);
            }
        });*/

        // operators
        it("should return zero operator for unapproved pair", async function () {
            for (const partition of shared.partitions) {
                const isOperator = await shared.token.connect(shared.signers[2]).isOperatorForPartition(partition, shared.addresses[2], shared.addresses[1]);
                expect(isOperator).to.equal(false);
            }
        });

        it("should return true for operator after approval", async function () {
            for (const partition of shared.partitions) {

                await shared.token.connect(shared.signers[1]).authorizeOperatorByPartition(partition, shared.addresses[2]);

                const isOperator = await shared.token.connect(shared.signers[2]).isOperatorForPartition(partition, shared.addresses[2], shared.addresses[1]);
                expect(isOperator).to.equal(true);
            }
        });

        it("should return false for operator after revocation", async function () {
            for (const partition of shared.partitions) {

                await shared.token.connect(shared.signers[1]).authorizeOperatorByPartition(partition, shared.addresses[2]);
                await shared.token.connect(shared.signers[1]).revokeOperatorByPartition(partition, shared.addresses[2]);

                const isOperator = await shared.token.isOperatorForPartition(partition, shared.addresses[2], shared.addresses[1]);
                expect(isOperator).to.equal(false);
            }
        });

        it("should allow an operator to freely transfer tokens", async function () {
            for (const partition of shared.partitions) {

                await shared.token.connect(shared.signers[1]).authorizeOperatorByPartition(partition, shared.addresses[2]);
                const balanceBefore = await shared.token.connect(shared.signers[1]).balanceOf(shared.addresses[1]);

                await shared.token.connect(shared.signers[2]).operatorTransferByPartition(partition, shared.addresses[1], shared.addresses[3], 1n, "0x00","0x00");
                const balanceAfter = await shared.token.connect(shared.signers[1]).balanceOf(shared.addresses[1]);
                //console.log("Balance before:", balanceBefore.toString());
                //console.log("Balance after:", balanceAfter.toString());
                expect(balanceAfter).to.equal(balanceBefore - 1n);

            }
        });

        // issuing
        it("should allow issuing tokens by partition by a minter (addr0)", async function () {
            for (const partition of shared.partitions) {
                const balanceBefore = await shared.token.connect(shared.signers[1]).balanceOfByPartition(partition, shared.addresses[0]);

                await shared.token.connect(shared.signers[0]).issueByPartition(partition, shared.addresses[0], 1n, "0x00");

                const balanceAfter = await shared.token.connect(shared.signers[1]).balanceOfByPartition(partition, shared.addresses[0]);
                expect(balanceAfter).to.equal(balanceBefore + 1n);
            }
        });

        it ("should NOT allow issuing tokens by partition by a non-minter (addr1)", async function () {
            for (const partition of shared.partitions) {
                await expect(shared.token.connect(shared.signers[1]).issueByPartition(partition, shared.addresses[1], 1n, "0x00"))
                    .to.be.reverted;
            }
        });

        it ("should allow issuing tokens by partition by a new minter (addr2)", async function () {
            // Only the contract owner can add a minter
            await shared.token.connect(shared.signers[0]).addMinter(shared.addresses[2]);

            for (const partition of shared.partitions) {
                const balanceBefore = await shared.token.connect(shared.signers[2]).balanceOfByPartition(partition, shared.addresses[2]);


                await shared.token.connect(shared.signers[2]).issueByPartition(partition, shared.addresses[2], 1n, "0x00");
                
                const balanceAfter = await shared.token.connect(shared.signers[2]).balanceOfByPartition(partition, shared.addresses[2]);
                expect(balanceAfter).to.equal(balanceBefore + 1n);
            }
        });

        it ("should NOT allow issuing tokens by partition by an old revoked minter (addr3)", async function () {
            // Only the contract owner can add a minter
            await shared.token.connect(shared.signers[0]).addMinter(shared.addresses[3]);
            await shared.token.connect(shared.signers[0]).removeMinter(shared.addresses[3]);

            for (const partition of shared.partitions) {
                await expect(shared.token.connect(shared.signers[3]).issueByPartition(partition, shared.addresses[3], 1n, "0x00"))
                    .to.be.reverted;
            }
        });


        // redeeming
        it("should allow redeeming tokens by partition by a token holder (addr0)", async function () {
            for (const partition of shared.partitions) {
                const balanceBefore = await shared.token.connect(shared.signers[0]).balanceOfByPartition(partition, shared.addresses[0]);

                await shared.token.connect(shared.signers[0]).redeemByPartition(partition, 1n, "0x00");
                const balanceAfter = await shared.token.connect(shared.signers[0]).balanceOfByPartition(partition, shared.addresses[0]);
                expect(balanceAfter).to.equal(balanceBefore - 1n);
            }
        });

        it("should NOT allow redeeming tokens by partition by a non-token holder (addr3)", async function () {
            for (const partition of shared.partitions) {
                await expect(shared.token.connect(shared.signers[3]).redeemByPartition(partition, 1n, "0x00"))
                    .to.be.reverted;
            }
        });


        it("should allow redeeming tokens by partition by an operator (addr2)", async function () {
            for (const partition of shared.partitions) {

                await shared.token.connect(shared.signers[1]).authorizeOperatorByPartition(partition, shared.addresses[2]);
                const balanceBefore = await shared.token.connect(shared.signers[2]).balanceOfByPartition(partition, shared.addresses[1]);

                await shared.token.connect(shared.signers[2]).operatorRedeemByPartition(partition, shared.addresses[1], 1n, "0x00");
                const balanceAfter = await shared.token.connect(shared.signers[2]).balanceOfByPartition(partition, shared.addresses[1]);
                expect(balanceAfter).to.equal(balanceBefore - 1n);
            }
        });

        it("should NOT allow redeeming tokens by partition by a non-operator (addr1)", async function () {
            for (const partition of shared.partitions) {

                // addr1 is not an operator for addr0
                // addr0 as the contract owner may be allowed to redeem by using other function
                await expect(shared.token.connect(shared.signers[1]).operatorRedeemByPartition(partition, shared.addresses[0], 1n, "0x00"))
                    .to.be.reverted;
            }
        });

        it("should NOT allow a prior operator to redeem tokens by partition after revocation", async function () {
            for (const partition of shared.partitions) {


                await shared.token.connect(shared.signers[1]).authorizeOperatorByPartition(partition, shared.addresses[2]);
                await shared.token.connect(shared.signers[1]).revokeOperatorByPartition(partition, shared.addresses[2]);

                // addr2 is no longer an operator for addr1
                await expect(shared.token.connect(shared.signers[2]).operatorRedeemByPartition(partition, shared.addresses[1], 1n, "0x00"))
                    .to.be.reverted;
            }
        });
    });
}

module.exports = partitionsCompliance;
