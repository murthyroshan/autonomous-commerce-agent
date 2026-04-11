"""
blockchain/algorand.py — Algorand testnet purchase logging.

Phase 4: plain PaymentTxn with JSON note field (no smart contract).
Phase 5: upgrade to PyTeal escrow contract (see IMPLEMENTATION.md).

Uses AlgoNode free public testnet endpoint — no API key needed.
"""

import json
import os
import logging

logger = logging.getLogger(__name__)

ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""  # AlgoNode is free, no token required


def _get_client():
    """Create and return an Algod client for testnet."""
    from algosdk.v2client import algod
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


def record_purchase_intent(product: dict, user_id: str = "demo") -> dict:
    """
    Record a purchase intent on Algorand testnet.

    Sends a 1 microALGO PaymentTxn from the configured account to itself,
    with a note field encoding the purchase details as JSON.

    Args:
        product: dict with title, price, source, link fields
        user_id: identifier for the user (default "demo")

    Returns:
        {"tx_id": str, "explorer_url": str}

    Raises:
        ValueError: if ALGORAND_MNEMONIC env var is not set
        Exception: if the transaction fails on-chain
    """
    from algosdk import account, mnemonic, transaction

    sender_mnemonic = os.getenv("ALGORAND_MNEMONIC")
    if not sender_mnemonic:
        raise ValueError(
            "ALGORAND_MNEMONIC not set. "
            "Generate a testnet account and fund it at testnet.algoexplorer.io/dispenser"
        )

    private_key = mnemonic.to_private_key(sender_mnemonic)
    sender      = account.address_from_private_key(private_key)
    receiver    = os.getenv("ALGORAND_RECEIVER", sender)  # send to self if unset

    # Build note payload — keep under 1000 bytes (Algorand note limit)
    note_data = {
        "app":        "commerce-ai-agent",
        "product_id": product.get("link", "")[-30:],
        "title":      product.get("title", "")[:60],
        "price_inr":  product.get("price"),
        "source":     product.get("source"),
        "score":      product.get("score"),
        "user_id":    user_id,
    }
    note = json.dumps(note_data).encode()

    client = _get_client()
    params = client.suggested_params()

    txn = transaction.PaymentTxn(
        sender=sender,
        sp=params,
        receiver=receiver,
        amt=1,      # 1 microALGO — minimum meaningful transaction
        note=note,
    )

    signed = txn.sign(private_key)
    tx_id  = client.send_transaction(signed)

    logger.info(f"Algorand tx submitted: {tx_id}")

    return {
        "tx_id":        tx_id,
        "explorer_url": f"https://testnet.algoexplorer.io/tx/{tx_id}",
    }
