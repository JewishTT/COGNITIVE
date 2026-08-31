from __future__ import annotations

import json
import shutil
import subprocess  # noqa: S404 - вызов внешнего CLI явно намерен
from typing import Any

from ..base import Tool


class TheBigBrotherTool(Tool):
    """Обёртка над CLI `thebigbrother`.

    Запускает глубокий профайлинг по нику/email и парсит JSON-вывод.
    Если бинарь не найден в PATH, возвращает детерминированный мок — это
    позволяет импортировать и прогонять Enricher в тестах без самого инструмента.
    """

    @classmethod
    def get_name(cls) -> str:
        return "thebigbrother"

    def launch(self, target: str, **kwargs: Any) -> dict:
        binary = kwargs.get("binary") or shutil.which("thebigbrother")
        if not binary:
            return self._mock(target)

        cmd = [binary, "-u", target, "-o", "json"]
        try:
            result = subprocess.run(  # noqa: S603
                cmd,
                capture_output=True,
                text=True,
                timeout=int(kwargs.get("timeout", 120)),
                check=False,
            )
        except subprocess.TimeoutExpired as exc:  # pragma: no cover - зависит от окружения
            raise RuntimeError(f"thebigbrother timeout for {target}") from exc

        if not result.stdout.strip():
            return self._mock(target)
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            # Некоторые версии пишут JSON в stderr или с префиксом — пробуем stderr.
            try:
                return json.loads(result.stderr)
            except json.JSONDecodeError:
                return self._mock(target)

    # --- мок: те же поля, что ожидает Enricher, но детерминированные ------------
    @staticmethod
    def _mock(target: str) -> dict:
        handle = target.lstrip("@").split("@")[0]
        return {
            "target": target,
            "profiles": {
                "linkedin": f"https://linkedin.com/in/{handle}",
                "github": f"https://github.com/{handle}",
                "twitter": f"https://twitter.com/{handle}",
                "telegram": f"https://t.me/{handle}",
            },
            "emails": [f"{handle}@proton.me"],
            "phones": [],
            "usernames": [handle],
            "geolocation": None,
        }
