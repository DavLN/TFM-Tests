const { expect } = require("chai");
const globalSetup = require("./tests/setup.js");
const erc20Compliance = require("./tests/erc20Compliance.js");
const edgeCases = require("./tests/edgeCases.js");

describe("ERC20 Tests", async function () {
    let shared = {};

    beforeEach(async function () {
        shared = await globalSetup();
    });

    // Provide a function to return the shared data once defined
    erc20Compliance(() => shared);
    edgeCases(() => shared);
});
