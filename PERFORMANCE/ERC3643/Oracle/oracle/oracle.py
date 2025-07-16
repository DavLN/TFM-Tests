import os
import time
import json
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
from dotenv import load_dotenv

# Helper to get NonSanctionedModule address from nested JSON
def get_non_module_address(json_data):
    network = "sepolia" # Change this depending on the specific network

    try:
        return json_data[network]["deployment"]["contracts"]["moduleNonSanctioned"]["address"]
    except (KeyError, TypeError):
        raise ValueError("NonSanctionedModule address not found in deployment JSON")




# Load environment
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
private_key = os.getenv("ORACLE_PRIVATE_KEY")
#rpc_url = "http://127.0.0.1:8544"
rpc_url= "https://ethereum-sepolia-rpc.publicnode.com"
#rpc_url = "https://ethereum-holesky.publicnode.com"

# Print oracle address and wait for user confirmation
#oracle_account = Account.from_key(private_key)
#print(f"Oracle address: {oracle_account.address}")
#print()
#input("Save the address into the contract and press Enter to continue...")

# Read deployment addresses from JSON file
script_dir = os.path.dirname(os.path.abspath(__file__))
deployment_addresses_json_path = os.path.join(script_dir, "..", "deployment-addresses.json")
suspects_json_path = os.path.join(script_dir, "suspects.json")


with open(deployment_addresses_json_path) as f:
    deployment_data = json.load(f)

deployment_address = get_non_module_address(deployment_data)

with open(suspects_json_path) as f:
    suspects = set(json.load(f))

module_address = Web3.to_checksum_address(deployment_address)
print(f"Loaded ComplianceModule address: {module_address}")

# Connect to Ethereum
w3 = Web3(Web3.HTTPProvider(rpc_url))
oracle_account = Account.from_key(private_key)

# Load ABI for compliance module
with open("ModuleABI.json") as f:
    module_abi = json.load(f)

compliance_contract = w3.eth.contract(address=module_address, abi=module_abi)

# Set up event listener
event_filter = compliance_contract.events.OracleCheck.create_filter(from_block="latest")

def listen_for_approvals():
    print(f"Listening as oracle: {oracle_account.address}")
    while True:
        try:
            events = event_filter.get_new_entries()
            for event in events:
                from_addr = event.args["from"]
                to_addr = event.args["to"]

                print(f"[🛰️] Transfer observed: {from_addr} → {to_addr}")

                # If either address is in the blacklist, block this pair
                if from_addr in suspects and to_addr in suspects:
                    print("[🚫] Blocking pair due to blacklist match")
                    key = compliance_contract.functions.blockTransferPair(from_addr, to_addr).build_transaction({
                        'from': oracle_account.address,
                        'nonce': w3.eth.get_transaction_count(oracle_account.address),
                        'gas': 200000,
                        'gasPrice': w3.to_wei('10', 'gwei')
                    })
                    signed = oracle_account.sign_transaction(key)
                    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                    print(f"[✓] Blocked on-chain: tx {tx_hash.hex()}")
        except Exception as e:
            print("[ERROR]", e)

        time.sleep(5)

if __name__ == "__main__":
    listen_for_approvals()
