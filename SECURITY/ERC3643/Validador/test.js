const { expect } = require("chai");
const globalSetup = require("./tests/setup.js");
const edgeCases = require("./tests/edgeCases.js");

describe("ERC3643 Tests", async function () {
    let shared = {};

    beforeEach(async function () {
        shared = await globalSetup();
    });

    // Provide a function to return the shared data once defined
    edgeCases(() => shared);
});
