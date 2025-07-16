const { expect } = require("chai");
const globalSetup = require("./tests/setup.js");
const erc1400Compliance = require("./tests/erc1400Compliance.js");
const edgeCases = require("./tests/edgeCases.js");

describe("ERC1400 Tests", async function () {
    let shared = {};

    beforeEach(async function () {
        shared = await globalSetup();
    });

    // Provide a function to return the shared data once defined
    erc1400Compliance(() => shared);
    edgeCases(() => shared);
});
