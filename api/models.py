"""api/models.py — Pydantic models for request/response validation."""

from pydantic import BaseModel, field_validator
from typing import Optional


class SearchRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def query_must_be_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        if len(v) > 200:
            raise ValueError("Query too long (max 200 characters)")
        return v


class ScoreBreakdown(BaseModel):
    price_score:  float
    rating_score: float
    review_score: float


class ProductResult(BaseModel):
    title:           str
    price:           float
    rating:          float
    review_count:    int
    source:          str
    link:            str
    score:           Optional[float] = None
    score_breakdown: Optional[ScoreBreakdown] = None


class Recommendation(ProductResult):
    justification:  str
    rank:           int = 1
    total_compared: int


class SearchResponse(BaseModel):
    query:             str
    scored_products:   list[ProductResult]
    recommendation:    Optional[Recommendation] = None
    error:             Optional[str] = None
    budget_miss:       Optional[dict] = None
    battle_contenders: Optional[list] = None
    battle_report:     Optional[str] = None

    class Config:
        extra = "allow"  # forward-compatible with new pipeline fields


class ConfirmRequest(BaseModel):
    title:        str
    price:        float
    source:       str
    link:         str
    score:        Optional[float] = None
    user_id:      str = "demo"
    sender_address: Optional[str] = None
    signed_txn_b64: Optional[str] = None
    signed_txn_bytes: Optional[list[int]] = None
    app_id: Optional[int] = None
    contract_url: Optional[str] = None


class ConfirmResponse(BaseModel):
    success:      bool
    tx_id:        Optional[str] = None
    explorer_url: Optional[str] = None
    app_id:       Optional[int] = None   # smart contract app id (Phase 5 escrow)
    contract_url: Optional[str] = None  # link to the escrow smart contract
    error:        Optional[str] = None
