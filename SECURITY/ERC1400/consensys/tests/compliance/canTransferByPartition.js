const { expect } = require('chai');


function canTransferByPartitionCompliance(getSharedData) {
    describe("ERC1400 canTransferByPartition compliance", function () {
        const address0 = "0x0000000000000000000000000000000000000000";
        let shared;

        beforeEach(async function (){
            shared = getSharedData();
            
            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        it("(TS-1400-049) should return 51 for valid transfers", async function () {
            const [canTransfer, _] = await shared.token.connect(shared.signers[1]).canTransferByPartition(shared.addresses[1], shared.addresses[2], shared.partitions[0], 1n, "0x00");
            expect(canTransfer).to.equal("0x51");
        });

        it("should return 51 for valid transfersFrom", async function () {
            await shared.token.connect(shared.signers[1]).approveByPartition(shared.partitions[0], shared.addresses[2], 1n);

            const [canTransfer, _] = await shared.token.connect(shared.signers[2]).canTransferByPartition(shared.addresses[1], shared.addresses[2], shared.partitions[0], 1n, "0x00");
            expect(canTransfer).to.equal("0x51");
        });

        it("should return 52 for transfers above the balance", async function () {
            const balance = await shared.token.connect(shared.signers[3]).balanceOf(shared.addresses[3]);

            const [canTransfer, _] = await shared.token.connect(shared.signers[3]).canTransferByPartition(shared.addresses[3], shared.addresses[2], shared.partitions[0], balance + 1n, "0x00");
            expect(canTransfer).to.equal("0x52");
        });

        it("should return 53 for transfers without enough allowance", async function () {
            const [canTransfer, _] = await shared.token.connect(shared.signers[1]).canTransferByPartition(shared.addresses[2], shared.addresses[3], shared.partitions[0], 1n, "0x00");
            expect(canTransfer).to.equal("0x53");
        });

        // 54: It seems non-standard. Wich means that I cannot test it


        it("should return 56 for an invalid sender", async function() {
            let revertReason = null;
            try {
                await shared.token.connect(shared.signers[1]).approve(address0, 1n);
            } catch (error) {
                revertReason = error.reason || error.message;
            }

            const [canTransfer, _] = await shared.token.connect(shared.signers[1]).canTransferByPartition(address0, shared.addresses[1], shared.partitions[0], 1n, "0x00");

            // If 56 is provided at some point it is valid, but only if 0x53 is also provided
            if (canTransfer !== "0x53" || revertReason) {
                console.log("Your are able to approve the zero address, even though this operation states that it is not allowed.")
                console.log("Revert reason:", revertReason);
                expect(canTransfer).to.equal("0x56");
            } else {
                expect(canTransfer).to.equal("0x53");
            }
        });

        it("should return 57 for an invalid receiver", async function() {
            const [canTransfer, _] = await shared.token.connect(shared.signers[1]).canTransferByPartition(shared.addresses[1], address0, shared.partitions[0], 1n, "0x00");
            expect(canTransfer).to.equal("0x57");
        });


        it("should return 58 when an address tries to act as an operator", async function() {
            const [canTransfer, _] = await shared.token.connect(shared.signers[1]).canTransferByPartition(shared.addresses[2], shared.addresses[3], shared.partitions[0], 1n, "0x00");
            
            if (canTransfer !== "0x53") {
                expect(canTransfer).to.equal("0x58");
            }
            else {
                console.log("It can be argued a 53 or a 58 depending on the implementation. You need to be an operator (58) or have enough allowance (53).")
            }
            
        });
    });
}

module.exports = canTransferByPartitionCompliance;
