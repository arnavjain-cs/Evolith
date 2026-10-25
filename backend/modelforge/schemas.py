from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Weights(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    coding: float = Field(default=0.65, ge=0, le=1)
    writing: float = Field(default=0.35, ge=0, le=1)
    humor: float = Field(default=0, ge=0, le=1)
    thinking: float = Field(default=0, ge=0, le=1)


class MergeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weights: Weights = Field(default_factory=Weights)
    normalize: bool = True


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    recipe_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-f0-9]+$")
    prompt: str = Field(min_length=1, max_length=6000)
    max_new_tokens: int = Field(default=256, ge=16, le=768)
    temperature: float = Field(default=0, ge=0, le=1.5)
    seed: int = Field(default=42, ge=0, le=2147483647)


class JobRequest(GenerateRequest):
    kind: Literal["compare", "benchmark"] = "compare"


PRESETS = [
    {"id": "balanced", "name": "Balanced", "description": "Equal coding and writing influence", "coding": 0.5, "writing": 0.5, "humor": 0, "thinking": 0},
    {"id": "builder", "name": "The builder", "description": "Implementation first, with clear explanations", "coding": 0.8, "writing": 0.2},
    {"id": "storyteller", "name": "The storyteller", "description": "Expressive prose with a technical foundation", "coding": 0.2, "writing": 0.8},
    {"id": "inventor", "name": "The inventor", "description": "Code, wit, planning and a clear voice", "coding": 0.4, "humor": 0.15, "thinking": 0.3, "writing": 0.15},
    {"id": "comedian", "name": "The comedian", "description": "A playful voice with clear delivery", "coding": 0, "humor": 0.7, "thinking": 0.1, "writing": 0.2},
    {"id": "strategist", "name": "The strategist", "description": "Planning and problem solving first", "coding": 0.15, "humor": 0, "thinking": 0.65, "writing": 0.2},
    {"id": "baseline", "name": "Base model", "description": "No adapter influence", "coding": 0, "writing": 0},
]
