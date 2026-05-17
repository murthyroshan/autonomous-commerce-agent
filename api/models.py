"""api/models.py — Pydantic models for request/response validation."""

import re
from pydantic import BaseModel, ConfigDict, field_validator, Field
from typing import Optional


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)

    @field_validator("query")
    @classmethod
    def sanitize_query(cls, v: str) -> str:
        """Strip whitespace, enforce length limits, and remove HTML/script injection attempts."""
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        if len(v) > 200:
            raise ValueError("Query too long")
        # Remove any HTML/script injection attempts
        v = re.sub(r'<[^>]+>', '', v)
        v = re.sub(r'[<>"\']', '', v)
        return v


class ScoreBreakdown(BaseModel):
    price_score:  float
    rating_score: float
    review_score: float


class ProductResult(BaseModel):
    title:           str = Field(..., max_length=500)
    price:           float
    rating:          float
    review_count:    int
    source:          str = Field(..., max_length=200)
    link:            str = Field(..., max_length=2000)
    score:           Optional[float] = None
    score_breakdown: Optional[ScoreBreakdown] = None


class Recommendation(ProductResult):
    justification:  str = Field(..., max_length=2000)
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

    model_config = ConfigDict(extra="ignore")  # prevent internal pipeline fields from leaking to client


class ConfirmRequest(BaseModel):
    title:        str
    price:        float
    source:       str
    link:         str
    score:        Optional[float] = None
    user_id:      str = "demo"
    sender_address: Optional[str] = None
    signed_txn_b64: Optional[str] = None
    signed_txn_bytes: Optional[list[int]] = Field(default=None, max_length=4096)
    app_id: Optional[int] = None
    contract_url: Optional[str] = None


class ConfirmResponse(BaseModel):
    success:      bool
    tx_id:        Optional[str] = None
    explorer_url: Optional[str] = None
    app_id:       Optional[int] = None   # smart contract app id (Phase 5 escrow)
    contract_url: Optional[str] = None  # link to the escrow smart contract
    nft_url:      Optional[str] = None  # link to the receipt NFT
    error:        Optional[str] = None
