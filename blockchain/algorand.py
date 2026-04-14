"""
blockchain/algorand.py — Algorand testnet purchase logging.

Phase 4: plain PaymentTxn with JSON note field (no smart contract).
Phase 5: upgrade to PyTeal escrow contract (see IMPLEMENTATION.md).

Uses AlgoNode free public testnet endpoint — no API key needed.
"""

import json
import os
import logging
import base64

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
        "explorer_url": f"https://lora.algokit.io/testnet/transaction/{tx_id}",
    }


def compile_contract() -> bytes:
    """
    Compile the approval.teal file and return binary bytes.
    Uses the Algod client compile endpoint.
    """
    client = _get_client()
    teal_path = os.path.join(os.path.dirname(__file__), "compiled", "approval.teal")
    with open(teal_path, encoding="utf-8") as f:
        teal_source = f.read()
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def build_unsigned_transaction(product: dict) -> dict:
    """
    Build a payment transaction for user wallet signing.
    Returns the transaction serialized as base64 for frontend wallet signing.

    Returns:
    {
      "txn_b64":       str,
      "note_preview":  str,
      "amount_micro":  int,
      "receiver":      str,
    }
    """
    from algosdk import mnemonic, account, transaction, encoding

    # If frontend provided the user's active wallet address, use it as sender
    # Otherwise fallback to the backend's default account
    sender = product.get("sender_address")
    receiver = os.getenv("ALGORAND_RECEIVER")

    sender_mnemonic = os.getenv("ALGORAND_MNEMONIC")
    if not sender and not sender_mnemonic:
        raise ValueError("ALGORAND_MNEMONIC not set and no wallet connected")

    if sender_mnemonic:
        private_key = mnemonic.to_private_key(sender_mnemonic)
        if not sender:
            sender = account.address_from_private_key(private_key)
        if not receiver:
            receiver = account.address_from_private_key(private_key)
            
    if not receiver:
        receiver = sender  # fallback: send to self

    note_data = {
        "app": "kartiq",
        "product_id": product.get("link", "")[-30:],
        "title": product.get("title", "")[:60],
        "price_inr": product.get("price"),
        "source": product.get("source"),
        "score": product.get("score"),
        "signed_by": "pera_wallet",
    }
    note = json.dumps(note_data).encode()

    client = _get_client()
    params = client.suggested_params()

    txn = transaction.PaymentTxn(
        sender=sender,
        sp=params,
        receiver=receiver,
        amt=1,
        note=note,
    )

    # SDK provides msgpack as base64 string; keep stable frontend contract by
    # always returning standard base64 text payload.
    encoded = encoding.msgpack_encode(txn)
    if isinstance(encoded, str):
        txn_b64 = encoded
    else:
        txn_b64 = base64.b64encode(encoded).decode("utf-8")

    return {
        "txn_b64": txn_b64,
        "note_preview": f"Kartiq purchase: {product.get('title', '')[:40]}",
        "amount_micro": 1,
        "receiver": receiver,
    }


def submit_signed_transaction(signed_txn_b64: str) -> dict:
    """
    Accept a base64-encoded signed transaction from the frontend
    and submit it to the network.

    Returns: {"tx_id": str, "explorer_url": str}
    """
    from algosdk import transaction, encoding

    client = _get_client()
    signed_bytes = base64.b64decode(signed_txn_b64)
    signed_txn = encoding.future_msgpack_decode(signed_bytes)
    tx_id = client.send_transaction(signed_txn)

    logger.info(f"Pera-signed tx submitted: {tx_id}")

    return {
        "tx_id": tx_id,
        "explorer_url": f"https://lora.algokit.io/testnet/transaction/{tx_id}",
    }
