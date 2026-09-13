ACADEMY_URL = "https://www.paloaltonetworks.com/services/education/academy"
ALLOWED_URLS = frozenset({ACADEMY_URL})


def companion():
    return {
        "title": "Palo Alto Learning Companion — English Readiness",
        "url": ACADEMY_URL,
        "description": "Prática linguística original para compreender orientações defensivas. Não é uma certificação técnica.",
        "prompt": "In the sentence 'Report the suspicious email through a trusted channel', what does 'trusted channel' mean?",
        "options": [
            {"id": "known", "text": "A known, verified way to contact the security team."},
            {"id": "sender", "text": "Any address supplied by the suspicious sender."},
        ],
    }
