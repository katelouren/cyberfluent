"""Deterministic review scheduling; not machine learning."""

from datetime import datetime, timedelta, timezone


def schedule(correct: bool, confidence: int, streak: int) -> dict:
    if not correct:
        days, next_streak, reason = 1, 0, "Erro: retomar o conceito amanhã."
    elif confidence <= 2:
        days, next_streak, reason = 2, 0, "Acerto com baixa confiança: reforçar em dois dias."
    else:
        next_streak = streak + 1
        days = [3, 7, 14, 30][min(streak, 3)]
        reason = f"Acerto seguro consecutivo {next_streak}: ampliar o intervalo."
    return {
        "interval_days": days,
        "streak": next_streak,
        "reason": reason,
        "due_at": (datetime.now(timezone.utc) + timedelta(days=days)).isoformat(),
    }
