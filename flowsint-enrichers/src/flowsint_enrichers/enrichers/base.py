from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..types import GraphNode, GraphRelationship


class Enricher(ABC):
    """Базовый класс Enricher'а Flowsint.

    Enricher принимает сущности из графа, обращается к соответствующему Tool'у,
    и записывает новые узлы/связи обратно в граф через `get_graph()`.
    """

    #: Тип входной сущности (username / email / ...).
    input_type: str = ""
    #: Тип выходной сущности (для маршрутизации результатов).
    output_type: str = ""

    @abstractmethod
    async def scan(self, inputs: list[Any]) -> list[dict]:
        """Прогнать `inputs` через тул и вернуть список сырых словарей."""
        raise NotImplementedError

    @abstractmethod
    def postprocess(self, results: list[dict], inputs: list[Any]) -> None:
        """Превратить сырые результаты в узлы/связи графа."""
        raise NotImplementedError

    def get_graph(self) -> "GraphAPI":
        """Возвращает интерфейс графа (заглушка — в Flowsint это Neo4j-сессия)."""
        raise NotImplementedError


class GraphAPI:
    """Минимальный интерфейс графа, чтобы Enricher был самодостаточным в тестах.

    В реальном Flowsint методы делегируют в Neo4j-сессию; здесь — in-memory.
    """

    def __init__(self) -> None:
        self.nodes: dict[str, GraphNode] = {}
        self.relationships: dict[str, GraphRelationship] = {}

    def create_node(self, node: GraphNode) -> GraphNode:
        self.nodes[node.id] = node
        return node

    def create_relationship(self, rel: GraphRelationship) -> GraphRelationship:
        self.relationships[rel.id] = rel
        return rel
