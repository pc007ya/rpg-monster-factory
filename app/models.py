from typing import Literal
from pydantic import BaseModel, Field


class Skill(BaseModel):
    name: str
    desc: str = ""
    power: int = 0


class SpriteAction(BaseModel):
    slot: Literal["idle", "attack", "hit", "die"] | str
    frames: int = Field(gt=0, le=64)


class SpriteRequest(BaseModel):
    canvas: str = ""
    actions: list[SpriteAction]
    layout: str = ""


class Monster(BaseModel):
    purpose: str = "AI art generation"
    style: str
    name: str
    type: str = "regular"
    level: int = 1
    element: str = ""
    weakness: str = ""
    appearance: str
    skills: list[Skill] = []
    drops: list[str] = []
    sprite_request: SpriteRequest
