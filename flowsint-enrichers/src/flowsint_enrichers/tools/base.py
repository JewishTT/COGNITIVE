from __future__ import annotations

from abc import ABC, abstractmethod


class Tool(ABC):
    """Базовый класс для низкоуровневых обёрток внешних OSINT-инструментов.

    Tool отвечает только за запуск утилиты и парсинг сырого вывода в словарь.
    Вся логика превращения этого словаря в граф лежит на Enricher'е.
    """

    @classmethod
    @abstractmethod
    def get_name(cls) -> str:
        """Уникальное имя тула (используется для логов и маршрутизации)."""
        raise NotImplementedError

    @abstractmethod
    def launch(self, target: str, **kwargs) -> dict:
        """Запустить тул для `target` (ник / email / домен) и вернуть словарь.

        Реализация не должна бросать исключение при штатном отсутствии данных —
        лучше вернуть пустую структуру, чтобы Enricher мог продолжить.
        """
        raise NotImplementedError
