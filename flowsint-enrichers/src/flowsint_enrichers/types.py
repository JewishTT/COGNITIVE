from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class GraphNode:
    """Узел графа расследования (зеркало сущности Flowsint)."""

    id: str
    node_type: str
    node_label: str
    node_color: Optional[str] = None
    x: float = 0.0
    y: float = 0.0
    properties: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphRelationship:
    """Связь графа расследования."""

    id: str
    source: str
    target: str
    label: str
    rel_type: str = "one-way"
    weight: Optional[float] = None


# Типы сущностей, с которыми работает TheBigBrother.
USERNAME = "username"
EMAIL = "email"
PHONE = "phone"
SOCIAL_PROFILE = "social_profile"
PERSON = "person"
PLACE = "place"
PLATFORM = "platform"


# Экспертные веса платформ — уверенность в том, что профиль принадлежит цели.
PLATFORM_CONFIDENCE: dict[str, float] = {
    "linkedin": 0.95,
    "github": 0.90,
    "keybase": 0.88,
    "twitter": 0.80,
    "x": 0.80,
    "mastodon": 0.78,
    "instagram": 0.72,
    "telegram": 0.75,
    "facebook": 0.70,
    "reddit": 0.68,
    "youtube": 0.66,
    "vk": 0.62,
    "discord": 0.60,
    "tiktok": 0.60,
    "medium": 0.55,
    "pastebin": 0.30,
    "unknown": 0.50,
}


def platform_confidence(platform: str) -> float:
    key = (platform or "unknown").lower()
    return PLATFORM_CONFIDENCE.get(key, PLATFORM_CONFIDENCE["unknown"])
