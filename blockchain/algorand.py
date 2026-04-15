"""
blockchain/algorand.py — Algorand testnet purchase logging and Escrow.

Phase 4: PaymentTxn with note field (Pera Wallet user-signed flow).
Phase 5: PyTeal smart contract escrow (server-signed deploy + fund).
"""

import json
import os
import logging
import base64

logger = logging.getLogger(__name__)

ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""


def _get_client():
    from algosdk.v2client import algod
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


def _get_private_key_and_address():
    from algosdk import account, mnemonic
    sender_mnemonic = os.getenv("ALGORAND_MNEMONIC")
    if not sender_mnemonic:
        raise ValueError("ALGORAND_MNEMONIC not set.")
    private_key = mnemonic.to_private_key(sender_mnemonic)
    address = account.address_from_private_key(private_key)
    return private_key, address


# ── Phase 4: Pera Wallet unsigned transaction ─────────────────────────────────

def build_unsigned_transaction(product: dict) -> dict:
    """
    Build an unsigned PaymentTxn for the Pera Wallet to sign.

    The sender is the connected Pera wallet address (buyer).
    Sends 1 microALGO with a structured note → on-chain purchase log.
    No server mnemonic needed — the user pays and signs.

    Args:
        product: dict containing title, price, source, score, sender_address, user_id.

    Returns:
        {"txn_b64": str, "note_preview": str, "amount_micro": int, "receiver": str}
        OR {"txn_b64": "", "fallback": True, "error": str}
    """
    sender_address = product.get("sender_address")

    # If no Pera address supplied, try server mnemonic-derived address
    if not sender_address:
        try:
            _, sender_address = _get_private_key_and_address()
        except ValueError:
            return {
                "txn_b64": "",
                "fallback": True,
                "error": "No sender address provided — connect Pera Wallet first",
            }

    receiver = os.getenv("ALGORAND_RECEIVER") or sender_address

    try:
        client = _get_client()
        params = client.suggested_params()
    except Exception as e:
        logger.warning(f"Algorand node unreachable: {e}")
        return {"txn_b64": "", "fallback": True, "error": f"Node unreachable: {e}"}

    note_data = {
        "app":       "kartiq",
        "title":     product.get("title", "")[:60],
        "price_inr": product.get("price"),
        "source":    product.get("source"),
        "score":     product.get("score"),
        "user_id":   product.get("user_id", "demo"),
    }
    note = json.dumps(note_data).encode()

    from algosdk import transaction, encoding

    txn = transaction.PaymentTxn(
        sender=sender_address,
        sp=params,
        receiver=receiver,
        amt=1,      # 1 microALGO — minimum meaningful transaction
        note=note,
    )

    encoded = encoding.msgpack_encode(txn)
    if isinstance(encoded, str):
        txn_b64 = encoded
    else:
        txn_b64 = base64.b64encode(encoded).decode("utf-8")

    return {
        "txn_b64":      txn_b64,
        "note_preview": f"KartIQ: {product.get('title', '')[:40]}",
        "amount_micro": 1,
        "receiver":     receiver,
    }


def submit_signed_transaction(signed_txn_b64: str) -> dict:
    """
    Accept a base64-encoded signed transaction from the frontend
    (signed by Pera Wallet) and submit it to the Algorand network.

    Returns: {"tx_id": str, "explorer_url": str}
    """
    from algosdk import transaction, encoding

    client = _get_client()
    signed_bytes = base64.b64decode(signed_txn_b64)
    signed_txn = encoding.future_msgpack_decode(signed_bytes)
    tx_id = client.send_transaction(signed_txn)

    logger.info(f"Pera-signed tx submitted: {tx_id}")
    transaction.wait_for_confirmation(client, tx_id, 4)

    return {
        "tx_id":        tx_id,
        "explorer_url": f"https://lora.algokit.io/testnet/transaction/{tx_id}",
    }


# ── Phase 5: Server-signed smart contract escrow deploy ───────────────────────

def compile_contract(contract_name="approval.teal") -> bytes:
    """Compile a TEAL program and return the byte code."""
    client = _get_client()
    teal_path = os.path.join(os.path.dirname(__file__), "compiled", contract_name)
    with open(teal_path, encoding="utf-8") as f:
        teal_source = f.read()
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def deploy_and_fund_escrow(product: dict, user_id: str = "demo") -> dict:
    """
    Deploy a PyTeal escrow smart contract and fund it with the product price.

    Server signs the deploy + fund transactions using ALGORAND_MNEMONIC.
    Returns app_id so the frontend can show a link to the smart contract.
    """
    from algosdk.transaction import ApplicationCreateTxn, StateSchema, PaymentTxn
    from algosdk import transaction
    from algosdk.logic import get_application_address

    private_key, sender = _get_private_key_and_address()
    receiver = os.getenv("ALGORAND_RECEIVER", sender)

    client = _get_client()
    params = client.suggested_params()

    approval_prog = compile_contract("approval.teal")
    clear_prog    = compile_contract("clear.teal")

    # Global state: 2 ints (price, expiry), 3 bytestrings (buyer, seller, status)
    global_schema = StateSchema(num_uints=2, num_byte_slices=3)
    local_schema  = StateSchema(num_uints=0,  num_byte_slices=0)

    price_inr    = product.get("price", 0)
    amount_micro = max(int(price_inr * 1000), 100_000)  # min app balance

    status_info  = client.status()
    expiry_round = status_info.get("last-round", 0) + 135_000  # ~7 days

    app_args = [
        amount_micro.to_bytes(8, "big"),
        expiry_round.to_bytes(8, "big"),
    ]

    # 1. Deploy the app
    deploy_txn = ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_prog,
        clear_program=clear_prog,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=app_args,
        accounts=[sender, receiver],
    )
    signed_deploy = deploy_txn.sign(private_key)
    deploy_tx_id  = client.send_transaction(signed_deploy)

    logger.info(f"Deploying escrow contract... tx: {deploy_tx_id}")
    res     = transaction.wait_for_confirmation(client, deploy_tx_id, 4)
    app_id  = res["application-index"]
    app_address = get_application_address(app_id)
    logger.info(f"Escrow app {app_id} at {app_address}")

    # 2. Fund the escrow app with MBR + price amount
    params = client.suggested_params()
    mbr    = 100_000 + (2 * 28_500) + (3 * 50_000)  # safe MBR estimate
    fund_txn    = PaymentTxn(
        sender=sender,
        sp=params,
        receiver=app_address,
        amt=amount_micro + mbr,
    )
    signed_fund = fund_txn.sign(private_key)
    fund_tx_id  = client.send_transaction(signed_fund)
    logger.info(f"Funded escrow... tx: {fund_tx_id}")

    return {
        "tx_id":        deploy_tx_id,
        "app_id":       app_id,
        "app_address":  app_address,
        "explorer_url": f"https://lora.algokit.io/testnet/transaction/{deploy_tx_id}",
        "contract_url": f"https://lora.algokit.io/testnet/application/{app_id}",
    }


def call_confirm_delivery(app_id: int) -> dict:
    """Call confirm_delivery on the Escrow Smart Contract."""
    from algosdk.transaction import ApplicationCallTxn
    from algosdk import transaction

    private_key, sender = _get_private_key_and_address()
    client = _get_client()
    params = client.suggested_params()
    params.fee = 2000  # cover inner txn fee

    receiver = os.getenv("ALGORAND_RECEIVER", sender)
    txn = ApplicationCallTxn(
        sender=sender,
        sp=params,
        index=app_id,
        on_complete=transaction.OnComplete.NoOpOC,
        app_args=[b"confirm_delivery"],
        accounts=[receiver],
    )
    signed_txn = txn.sign(private_key)
    tx_id      = client.send_transaction(signed_txn)

    logger.info(f"Confirm delivery sent... tx: {tx_id}")
    transaction.wait_for_confirmation(client, tx_id, 4)
    return {"tx_id": tx_id}


def call_auto_refund_after_expiry(app_id: int) -> dict:
    """Call auto_refund_after_expiry on the Escrow Smart Contract."""
    from algosdk.transaction import ApplicationCallTxn
    from algosdk import transaction

    private_key, sender = _get_private_key_and_address()
    client = _get_client()
    params = client.suggested_params()
    params.fee = 2000

    txn = ApplicationCallTxn(
        sender=sender,
        sp=params,
        index=app_id,
        on_complete=transaction.OnComplete.NoOpOC,
        app_args=[b"auto_refund"],
        accounts=[sender],
    )
    signed_txn = txn.sign(private_key)
    tx_id      = client.send_transaction(signed_txn)

    logger.info(f"Auto-refund sent... tx: {tx_id}")
    transaction.wait_for_confirmation(client, tx_id, 4)
    return {"tx_id": tx_id}


# ── Alias: /confirm endpoint uses Pera-signed flow when sender_address given ──
# Falls back to server-signed escrow deploy when ALGORAND_MNEMONIC is set.

def record_purchase_intent(product: dict, user_id: str = "demo") -> dict:
    """
    Log a confirmed purchase on Algorand.

    If sender_address is in product (Pera wallet connected):
        → Just falls through; frontend handles the Pera sign flow via 
          /confirm/prepare + /confirm/submit.
        → Here we do a server-signed note txn as a backup log.

    If ALGORAND_MNEMONIC is set (server-signed):
        → Deploy escrow contract and fund it.
    """
    # Prefer escrow if mnemonic available
    mnemonic_set = bool(os.getenv("ALGORAND_MNEMONIC"))
    if mnemonic_set:
        try:
            return deploy_and_fund_escrow(product, user_id)
        except Exception as e:
            logger.warning(f"Escrow deploy failed, falling back to note txn: {e}")

    # Fall back to simple note PaymentTxn (server-signed)
    try:
        private_key, sender = _get_private_key_and_address()
    except ValueError as e:
        raise ValueError(str(e))

    from algosdk import transaction

    receiver = os.getenv("ALGORAND_RECEIVER", sender)
    client   = _get_client()
    params   = client.suggested_params()

    note_data = {
        "app":       "kartiq",
        "title":     product.get("title", "")[:60],
        "price_inr": product.get("price"),
        "source":    product.get("source"),
        "score":     product.get("score"),
        "user_id":   user_id,
    }
    note     = json.dumps(note_data).encode()
    txn      = transaction.PaymentTxn(sender=sender, sp=params, receiver=receiver, amt=1, note=note)
    signed   = txn.sign(private_key)
    tx_id    = client.send_transaction(signed)

    logger.info(f"Algorand note tx submitted: {tx_id}")
    return {
        "tx_id":        tx_id,
        "explorer_url": f"https://lora.algokit.io/testnet/transaction/{tx_id}",
    }
