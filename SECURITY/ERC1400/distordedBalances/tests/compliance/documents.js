const { expect } = require("chai");

function documentsCompliance(getSharedData) {
    describe ("ERC1400 documents compliance", function () {
        let shared;

        beforeEach(async function () {
            shared = getSharedData();

            if (!shared) {
                throw new Error("Shared data is not defined");
            }
        });

        it("(TS-1400-007) should add a document and retrieve the correct data", async function () {
            const documentName = ethers.keccak256(ethers.toUtf8Bytes("NEW DOCUMENT"));
            const documentHash = ethers.keccak256(ethers.toUtf8Bytes("NEW DATA"));
            const documentURI = "https://new.local/document";

            await expect(shared.token.connect(shared.signers[0]).setDocument(
                documentName,
                documentURI,
                documentHash
            )).to.emit(shared.token, "DocumentUpdated")
            .withArgs(documentName, documentURI, documentHash);

            const [uri, hash] = await shared.token.getDocument(documentName);
            expect(uri).to.equal(documentURI);
            expect(hash).to.equal(documentHash);
        });


        it("should return the correct document hash", async function () {
            const [, documentHash] = await shared.token.connect(shared.signers[0]).getDocument(shared.documentName);
            expect(documentHash).to.equal(shared.documentHash);
        });

        it("should return the correct document URI", async function () {
            const [documentURI, ] = await shared.token.connect(shared.signers[0]).getDocument(shared.documentName);
            expect(documentURI).to.equal(shared.documentURI);
        });

        // It is from 1643, but in some cases it does not appear 1400
        it("should erase the document", async function () {
            await expect(shared.token.connect(shared.signers[0]).removeDocument(shared.documentName))
            .to.emit(shared.token, "DocumentRemoved")
            .withArgs(shared.documentName, shared.documentURI, shared.documentHash);
        });

        it("should NOT return the document after it has been removed", async function () {
            const documentName = ethers.keccak256(ethers.toUtf8Bytes("REMOVED DOCUMENT"));
            const documentHash = ethers.keccak256(ethers.toUtf8Bytes("REMOVED DATA"));
            const documentURI = "https://removed.local/document";


            await expect(shared.token.connect(shared.signers[0]).setDocument(
                documentName,
                documentURI,
                documentHash
            )).to.emit(shared.token, "DocumentUpdated")
            .withArgs(documentName, documentURI, documentHash);

            await expect(shared.token.connect(shared.signers[0]).removeDocument(documentName))
            .to.emit(shared.token, "DocumentRemoved")
            .withArgs(documentName, documentURI, documentHash);
        });

        it("should NOT return a non-existent document", async function () {
            const nonExistentDocumentName = ethers.keccak256(ethers.toUtf8Bytes("NON-EXISTENT DOCUMENT"));

            await expect(shared.token.getDocument(nonExistentDocumentName))
                .to.be.reverted;
        });
    });
}

module.exports = documentsCompliance;
