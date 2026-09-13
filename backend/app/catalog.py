import json
from pathlib import Path

ROOT = Path(__file__).parent / "content"
SLUGS = ["daily-standup", "bug-report", "phishing-incident-communication"]
FILES = ["daily-standup", "bug-report", "phishing"]
MISSIONS = {
    slug: json.loads((ROOT / f"{file}.json").read_text()) for slug, file in zip(SLUGS, FILES)
}
MISSIONS[SLUGS[2]]["worked_example"] = "You need to contact the support team."
MISSIONS[SLUGS[2]]["minigames"] = ["Spot the Risk", "Choose Your Response"]
GAMES = {
    "daily-standup": [
        {
            "id": "build",
            "type": "order",
            "title": "Build the Message",
            "prompt": "Monte uma atualização na ordem: ontem → hoje → bloqueio.",
            "options": [
                {"id": "blocker", "text": "I need access to staging. Can someone help?"},
                {"id": "today", "text": "Today, I will write tests."},
                {"id": "yesterday", "text": "Yesterday, I fixed the login bug."},
            ],
            "accepted": ["yesterday", "today", "blocker"],
            "explanation": "Comece pelo resultado anterior, indique o plano e termine com o pedido específico de ajuda.",
        },
        {
            "id": "decide",
            "type": "single",
            "title": "Choose Your Response",
            "prompt": "O acesso ainda não chegou. Qual atualização ajuda a equipe?",
            "options": [
                {"id": "wait", "text": "Everything is fine."},
                {
                    "id": "ask",
                    "text": "I am blocked by missing staging access. Could you help me get access?",
                },
                {"id": "blame", "text": "This is your fault."},
            ],
            "accepted": ["ask"],
            "explanation": "Nomear o bloqueio e pedir ajuda permite uma ação concreta, sem culpa.",
        },
    ],
    "bug-report": [
        {
            "id": "build",
            "type": "classify",
            "title": "Bug Report Builder",
            "prompt": "Classifique cada parte do relato.",
            "options": [
                {"id": "save", "text": "The app should save the task."},
                {
                    "id": "error",
                    "text": "It shows Error 500 and the task is missing after refresh.",
                },
                {"id": "work", "text": "Users cannot record their work."},
            ],
            "labels": ["expected", "actual", "impact"],
            "accepted": ["expected", "actual", "impact"],
            "explanation": "Expected descreve o esperado; actual registra o observado; impact explica a consequência.",
        },
        {
            "id": "decide",
            "type": "single",
            "title": "Choose Your Response",
            "prompt": "Qual informação torna o relato reproduzível sem inventar uma causa?",
            "options": [
                {"id": "cause", "text": "The database is definitely broken."},
                {
                    "id": "steps",
                    "text": "Click Save, observe Error 500, then refresh and check whether the task appears.",
                },
                {"id": "delete", "text": "Delete all tasks and try again."},
            ],
            "accepted": ["steps"],
            "explanation": "Passos e observações ajudam a reproduzir; uma hipótese de causa não é um fato comprovado.",
        },
    ],
    "phishing-incident-communication": [
        {
            "id": "risk",
            "type": "select_many",
            "title": "Spot the Risk",
            "prompt": "Selecione três pistas suspeitas. Endereços fictícios; não são links.",
            "options": [
                {"id": "sender", "text": "From: IT Support <help@northstar-security.example>"},
                {"id": "urgent", "text": "Subject: Your account will be closed in 10 minutes"},
                {
                    "id": "password",
                    "text": "Please enter your password at northstar-verify.example",
                },
                {"id": "hello", "text": "Hello Alex,"},
            ],
            "accepted": ["sender", "urgent", "password"],
            "explanation": "O domínio difere de northstar.example; a urgência pressiona a agir; o pedido de senha leva a outro domínio. Uma saudação não comprova legitimidade nem risco.",
        },
        {
            "id": "decide",
            "type": "single",
            "title": "Choose Your Response",
            "prompt": "Alex inseriu a senha. Qual é a orientação defensiva adequada?",
            "options": [
                {"id": "reply", "text": "Reply to the sender with your password."},
                {
                    "id": "safe",
                    "text": "Open the official website independently, change your password, and report the email through a trusted channel.",
                },
                {"id": "click", "text": "Click the same link again to check."},
            ],
            "accepted": ["safe"],
            "explanation": "Acesse o site oficial por um caminho independente e reporte por canal conhecido. Não responda nem reutilize o link suspeito.",
        },
    ],
}
RETRIEVALS = {
    "daily-standup": {
        "id": "future-will",
        "prompt": "Complete: Today, I will ___ tests. (write / wrote / writing)",
        "answer_type": "fill_blank",
        "answers": ["write"],
    },
    "bug-report": {
        "id": "modal-should",
        "prompt": "Complete: The button should ___ the task. (save / saves / saving)",
        "answer_type": "fill_blank",
        "answers": ["save"],
    },
    "phishing-incident-communication": {
        "id": "need-to-1",
        "prompt": "Complete: The analyst needs ___ review the alert and notify the manager.",
        "answer_type": "fill_blank",
        "answers": ["to"],
    },
}


def public_mission(slug: str) -> dict:
    mission = {k: v for k, v in MISSIONS[slug].items() if k not in {"rubric", "accepted_answers"}}
    mission["games"] = [
        {k: v for k, v in g.items() if k not in {"accepted", "explanation"}} for g in GAMES[slug]
    ]
    mission["position"] = SLUGS.index(slug) + 1
    return mission


def grade_game(slug: str, game_id: str, answers: list[str]) -> dict:
    game = next((g for g in GAMES[slug] if g["id"] == game_id), None)
    if game is None:
        return {"correct": False, "explanation": "Atividade não encontrada."}
    correct = (
        sorted(answers) == sorted(game["accepted"])
        if game["type"] == "select_many"
        else answers == game["accepted"]
    )
    return {"correct": correct, "explanation": game["explanation"]}


def retrieval(slug: str) -> dict:
    return {k: v for k, v in RETRIEVALS[slug].items() if k != "answers"}
