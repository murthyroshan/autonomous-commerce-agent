import os
from pyteal import *


def purchase_approval():
    """
    Stateless LogicSig contract.
    Approves a payment transaction only if:
    1. Transaction note is non-empty (contains product data)
    2. Amount is greater than 0
    3. Transaction type is payment
    4. Receiver matches the configured ALGORAND_RECEIVER address
    """
    expected_receiver = os.getenv("ALGORAND_RECEIVER", "")
    if not expected_receiver:
        raise ValueError(
            "ALGORAND_RECEIVER env var must be set before compiling contract"
        )
    has_note = Len(Txn.note()) > Int(0)
    has_amount = Txn.amount() > Int(0)
    is_payment = Txn.type_enum() == TxnType.Payment
    receiver_check = Txn.receiver() == Addr(expected_receiver)

    return And(has_note, has_amount, is_payment, receiver_check)


def clear_program():
    return Int(1)


if __name__ == "__main__":
    import os

    approval_teal = compileTeal(
        purchase_approval(),
        mode=Mode.Signature,
        version=6,
    )
    os.makedirs("blockchain/compiled", exist_ok=True)
    with open("blockchain/compiled/approval.teal", "w", encoding="utf-8") as f:
        f.write(approval_teal)
    print("Contract compiled to blockchain/compiled/approval.teal")
    print(approval_teal)
