"""Opt-in the merchant wallet to USDC ASA 10458941 on Algorand testnet.

Run once before the x402 flow can work end-to-end.
Both the SENDER wallet (user) and MERCHANT wallet (payTo) must opt-in.

Usage:
    python scripts/optin_usdc.py
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

from algosdk import account, mnemonic, transaction
from algosdk.v2client import algod

USDC_ASA  = 10458941
ALGOD_URL = "https://testnet-api.algonode.cloud"

MNEMONIC = os.getenv("ALGORAND_MNEMONIC", "")
MERCHANT = os.getenv("KARTIQ_MERCHANT_WALLET", "")

if not MNEMONIC:
    print("ERROR: ALGORAND_MNEMONIC not set in .env")
    sys.exit(1)
if not MERCHANT:
    print("ERROR: KARTIQ_MERCHANT_WALLET not set in .env")
    sys.exit(1)

private_key = mnemonic.to_private_key(MNEMONIC)
sender      = account.address_from_private_key(private_key)

print(f"Merchant wallet : {MERCHANT}")
print(f"Key maps to     : {sender}")
if sender != MERCHANT:
    print("WARNING: ALGORAND_MNEMONIC does not correspond to KARTIQ_MERCHANT_WALLET!")
    print("The opt-in will be sent from the key address, not the merchant address.")

client = algod.AlgodClient("", ALGOD_URL)
info   = client.account_info(sender)

# ── ALGO balance check ────────────────────────────────────────────────────────
algo_bal = info.get("amount", 0) / 1_000_000
print(f"\nALGO balance    : {algo_bal:.4f} ALGO")
if algo_bal < 0.2:
    print("WARNING: Low ALGO balance. You need at least 0.2 ALGO for the opt-in txn fee + MBR.")
    print("Fund from: https://bank.testnet.algorand.network/")

# ── Check current ASA holdings ───────────────────────────────────────────────
assets = {a["asset-id"]: a for a in info.get("assets", [])}
print(f"\nCurrent ASA holdings ({len(assets)} assets):")
for aid, a in assets.items():
    print(f"  ASA {aid}: balance={a['amount']}")

if USDC_ASA in assets:
    usdc_bal = assets[USDC_ASA]["amount"] / 1_000_000
    print(f"\nAlready opted in to USDC (ASA {USDC_ASA}). Balance: {usdc_bal:.6f} USDC")
    sys.exit(0)

# ── Send opt-in transaction ───────────────────────────────────────────────────
print(f"\nSending opt-in txn for ASA {USDC_ASA}...")
sp  = client.suggested_params()
txn = transaction.AssetOptInTxn(sender=sender, sp=sp, index=USDC_ASA)
stxn = txn.sign(private_key)
txid = client.send_transaction(stxn)
print(f"Txn ID: {txid}")
print(f"Waiting for confirmation...")

result       = transaction.wait_for_confirmation(client, txid, 10)
confirmed_rnd = result["confirmed-round"]
print(f"Confirmed in round {confirmed_rnd}")
print(f"Explorer: https://testnet.algoexplorer.io/tx/{txid}")
print("\nMerchant wallet is now opted in to USDC!")
print("Next: fund your SENDER wallet (Pera Wallet) with testnet USDC.")
