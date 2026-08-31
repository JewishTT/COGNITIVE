from __future__ import annotations

import asyncio
from typing import Any

from ..base import Enricher, GraphAPI
from ...tools.osint.thebigbrother_tool import TheBigBrotherTool
from ...types import (  # noqa: F401 - переэкспорт для удобства импорта
    PLATFORM,
    PLACE,
    PHONE,
    SOCIAL_PROFILE,
    USERNAME,
    EMAIL,
    PERSON,
    GraphNode,
    GraphRelationship,
    platform_confidence,
)


class TheBigBrotherEnricher(Enricher):
    """Глубокий профайлинг ников/email через TheBigBrother.

    Место в пайплайне: Этап 2, после первичного сбора (BBOT/theHarvester),
    который наполнил граф сущностями `Username`/`Email`. Результаты (профили,
    доп. email/телефоны, гео) становятся узлами графа с экспертными весами и
    далее питают TDA-Enricher (Этап 4).
    """

    input_type = USERNAME
    output_type = SOCIAL_PROFILE

    def __init__(self, graph: GraphAPI | None = None) -> None:
        self._graph = graph or GraphAPI()
        self._tool = TheBigBrotherTool()
        self._counter = 0

    def get_graph(self) -> GraphAPI:
        return self._graph

    async def scan(self, inputs: list[Any]) -> list[dict]:
        raw: list[dict] = []
        for item in inputs:
            # Вход — сущность с .value (Username/Email) либо просто строка.
            target = getattr(item, "value", None) or (item if isinstance(item, str) else None)
            if not target:
                continue
            raw.append(await asyncio.to_thread(self._tool.launch, target))
        return raw

    # --- порождение узлов/связей ------------------------------------------------
    def postprocess(self, results: list[dict], inputs: list[Any]) -> None:
        graph = self.get_graph()
        for data in results:
            root_id = self._root_id(inputs, data)
            root_node = graph.nodes.get(root_id)
            if root_node is None:
                root_node = graph.create_node(
                    GraphNode(id=root_id, node_type=PERSON, node_label=str(data.get("target", root_id)))
                )

            # Профили на платформах — вес = экспертная уверенность платформы.
            for platform, url in (data.get("profiles") or {}).items():
                node = graph.create_node(
                    GraphNode(
                        id=self._nid("profile", url),
                        node_type=SOCIAL_PROFILE,
                        node_label=f"{platform}: {self._handle(url)}",
                        node_color="#a78bfa",
                        properties={"platform": platform, "url": url},
                    )
                )
                graph.create_relationship(
                    self._rel(root_node.id, node.id, "HAS_PROFILE", platform_confidence(platform))
                )

            # Дополнительные email.
            for email in data.get("emails") or []:
                node = graph.create_node(
                    GraphNode(id=self._nid("email", email), node_type=EMAIL, node_label=email, node_color="#34d399")
                )
                graph.create_relationship(self._rel(root_node.id, node.id, "HAS_EMAIL", 0.7))

            # Телефоны.
            for phone in data.get("phones") or []:
                node = graph.create_node(
                    GraphNode(id=self._nid("phone", phone), node_type=PHONE, node_label=phone, node_color="#fbbf24")
                )
                graph.create_relationship(self._rel(root_node.id, node.id, "HAS_PHONE", 0.6))

            # Геолокация из EXIF/метаданных.
            geo = data.get("geolocation")
            if geo and (geo.get("place") or geo.get("lat") is not None):
                label = geo.get("place") or f"{geo.get('lat')}, {geo.get('lon')}"
                node = graph.create_node(
                    GraphNode(id=self._nid("geo", label), node_type=PLACE, node_label=label, node_color="#f472b6")
                )
                graph.create_relationship(self._rel(root_node.id, node.id, "LOCATED_AT", 0.5))

    # --- утилиты ----------------------------------------------------------------
    @staticmethod
    def _root_id(inputs: list[Any], data: dict) -> str:
        target = data.get("target")
        if target:
            return f"person:{target}"
        return "person:unknown"

    @staticmethod
    def _handle(url: str) -> str:
        return url.rstrip("/").split("/")[-1]

    def _nid(self, kind: str, value: str) -> str:
        return f"tbb:{kind}:{abs(hash(value))}"

    def _rel(self, source: str, target: str, label: str, weight: float) -> GraphRelationship:
        return GraphRelationship(
            id=f"tbb:rel:{source}:{target}:{label}",
            source=source,
            target=target,
            label=label,
            rel_type="one-way",
            weight=weight,
        )


if __name__ == "__main__":  # pragma: no cover - демонстрация
    async def _demo() -> None:
        graph = GraphAPI()
        enricher = TheBigBrotherEnricher(graph)
        raw = await enricher.scan([type("X", (), {"value": "ghost7"})()])
        enricher.postprocess(raw, [type("X", (), {"value": "ghost7"})()])
        print(f"nodes={len(graph.nodes)} relationships={len(graph.relationships)}")
        for rel in graph.relationships.values():
            print(f"  {rel.source} -[{rel.label} w={rel.weight}]-> {rel.target}")

    asyncio.run(_demo())
