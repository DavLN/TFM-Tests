# TFM-Tests

This document outlines the setup and execution of performance and security tests used to developed the **Ethereum ERC Performance and security analysis** project. Tests are divided into **PERFORMANCE** and **SECURITY** directories, organized by ERC standard and specific implementation. The `graph.py` script generates visualizations of performance data after installing dependencies from `requirements.txt`.

> **Note**: Due to licensing restrictions, USD₮ (Tether) and BNB contracts are not redistributed. Their code is publicly available on the Ethereum blockchain via platforms like [Etherscan](https://etherscan.io). Place these contracts in a `contracts` directory within the relevant implementation folder.

## Test Network Setup

While not mandatory, using [Hardhat](https://hardhat.org) is recommended for a streamlined testing experience. Install Hardhat via `npm` and ensure a `hardhat.config.js` file exists in each implementation directory to run tests. Dependencies are included in each directory.

```bash
# Inside an implementation directory
npm install .
npx hardhat node --hostname 127.0.0.1 --port 8544
```
### Running Security Tests

Security tests reside in the SECURITY directory. To execute them, install dependencies and compile contracts:
```bash
npm install .
npx hardhat clean && npx hardhat compile
```

For all implementations except the ERC-3643 Oracle variant, run tests with:
```bash
npx hardhat test --network hh test.js
```

#### ERC-3643 Oracle Security Tests
The ERC-3643 Oracle implementation requires a different process due to its unique setup. Install dependencies, compile contracts, and deploy to the network:

```bash
npm install .
npx hardhat clean && npx hardhat compile
npx hardhat run --network hh deploy.js
```

Navigate to the ERC3643/Oracle/oracle directory, install Python dependencies, and run the oracle.py script:
```bash
pip install -r requirements.txt
python oracle.py
```

The oracle is preconfigured with a **widely known private** Hardhat address and uses data from deployment-addresses.json generated during contract deployment. Then, return to the parent directory and execute:
```bash
npx hardhat run --network hh testOracleRecognition.js

```

This confirms the legitimate oracle's functionality. Repeat the process for the maliciousOracle directory, then test its inability to affect the contract:
```bash
npx hardhat run --network hh testOracleRestriction.js
```

> Warning: Private keys in the .env file are publicly known and safe for Hardhat networks. However, on networks like Sepolia or Holesky, these keys could allow unauthorized access to any Ether in associated addresses. Use caution.

### Running Performance Tests

For real-world testing, modify configuration files and oracle code to include private keys for wallets with sufficient Ether on the target testnet (e.g., Sepolia or Holesky). At least three wallets with a reasonable amount of Ether are required.
Install dependencies and compile contracts in the desired implementation directory:

```bash
npm install
npx hardhat clean && npx hardhat compile
```

### Deployment
Rename .venv.example to .env and fill in the required details (e.g., private keys and network data). Deploy contracts to the target network:

```bash
npx hardhat run --network <hh | sepolia | holesky> deploy.js
```
This generates a deployment-addresses.json file containing deployment details and metrics, categorized by network. Note that redeploying overwrites data for the same network, so back up this file to avoid accidental data loss.

#### ERC-3643 Oracle Performance Tests
Before compiling contracts, add the oracle's private key to the .env file in the ERC3643/Oracle directory under PERFORMANCE. Navigate to ERC3643/Oracle/oracle, install Python dependencies, and update the oracle.py script:

```python
def get_non_module_address(json_data):
    network = "sepolia"  # Change to hh, sepolia, or holesky

# Load environment
private_key = os.getenv("ORACLE_PRIVATE_KEY")
#rpc_url = "http://127.0.0.1:8544"
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"  # Specify RPC URL
#rpc_url = "https://ethereum-holesky.publicnode.com"
```

Compile and deploy contracts, then run tests:

```bash
npx hardhat clean && npx hardhat compile
npx hardhat run --network <hh | sepolia | holesky> testTransfer.js  # Or another test.js
```

## Results
Test results are appended to results.csv in the implementation directory, created by the program itself if it doesn't exist. To visualize performance data, run the graph.py script in the PERFORMANCE directory after installing Python dependencies:

```bash
pip install -r requirements.txt
python graph.py
```
This script aggregates data and generates multiple charts for analysis.
