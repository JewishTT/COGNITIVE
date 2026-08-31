"""run_enricher.py — CLI-обёртка над TheBigBrotherEnricher.

Служит мостом глубокой интеграции: платформа (Node) шлёт JSON
{ "username": "...", "email": "..." } в stdin, а скрипт возвращает граф в
форме, понятной фронту (nodeLabel/nodeType/weight и т.д.).

Пример:
    echo '{"username":"ghost7"}' | python run_enricher.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from flowsint_enrichers.enrichers.person.thebigbrother_enricher import TheBigBrotherEnricher
from flowsint_enrichers.enrichers.base import GraphAPI

NODE_COLOR = {
    "person": "#22d3ee",
    "social_profile": "#a78bfa",
    "email": "#34d399",
    "phone": "#fbbf24",
    "place": "#f472b6",
}


def to_platform(graph):
    nds = []
    for n in graph.nodes.values():
        nds.append(
            {
                "id": n.id,
                "nodeLabel": n.node_label,
                "nodeType": n.node_type,
                "nodeColor": n.node_color or NODE_COLOR.get(n.node_type, "#22d3ee"),
                "nodeSize": 14 if n.node_type == "person" else 10,
                "x": getattr(n, "x", 0) or 0,
                "y": getattr(n, "y", 0) or 0,
                "nodeProperties": n.properties or {},
                "nodeMetadata": n.metadata or {},
            }
        )
    rls = []
    for r in graph.relationships.values():
        rls.append(
            {
                "id": r.id,
                "source": r.source,
                "target": r.target,
                "label": r.label,
                "type": r.rel_type,
                "weight": r.weight,
            }
        )
    return {"nds": nds, "rls": rls}


class _Target:
    def __init__(self, value):
        self.value = value


async def run(targets):
    graph = GraphAPI()
    enricher = TheBigBrotherEnricher(graph)
    raw = await enricher.scan(targets)
    enricher.postprocess(raw, targets)
    return to_platform(graph)


def main():
    data = json.load(sys.stdin)
    targets = [_Target(t) for t in (data.get("targets") or [])]
    if data.get("username"):
        targets.append(_Target(data["username"]))
    if data.get("email"):
        targets.append(_Target(data["email"]))
    result = asyncio.run(run(targets))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
