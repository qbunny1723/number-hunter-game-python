from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import os
from pathlib import Path
import random
from typing import Any

from flask import Flask, jsonify, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
MIN_NUMBER = 1
MAX_NUMBER = 100
SHARED_HINTS_PER_ROUND = 2

ROLE_DEFS = [
    {"id": "detective", "icon": "🕵️", "name": "偵探", "image": "H1.png", "detectivePrivilege": True},
    {"id": "sniper", "icon": "🎯", "name": "狙擊手", "image": "H2.png", "nearRange": 5},
    {"id": "recorder", "icon": "📝", "name": "記錄員", "image": "H3.png", "freeMiss": True},
    {"id": "star", "icon": "⭐", "name": "星星獵人", "image": "H4.png", "winBonusStar": 1},
]

RESULTS: list[dict[str, Any]] = []


def blank_game() -> dict[str, Any]:
    return {
        "answer": None,
        "status": "setup",
        "currentPlayerIndex": 0,
        "nextStartingPlayerIndex": 0,
        "players": [],
        "events": [],
        "roundGuesses": [],
        "hints": [],
        "sharedHintsLeft": SHARED_HINTS_PER_ROUND,
        "firstTightRangePlayer": None,
        "records": [{"wins": 0, "stars": 0} for _ in ROLE_DEFS],
        "roleAssignments": [],
        "message": "請設定玩家並開始遊戲。",
    }


GAME = blank_game()
app = Flask(__name__, static_folder=None)


def clean_name(value: Any, fallback: str) -> str:
    name = " ".join(str(value or "").strip().split()) or fallback
    return "".join(list(name)[:3])


def role_by_id(role_id: str | None) -> dict[str, Any]:
    return next((role for role in ROLE_DEFS if role["id"] == role_id), ROLE_DEFS[0])


def draw_roles(count: int) -> list[str]:
    roles = ROLE_DEFS[:]
    random.shuffle(roles)
    return [role["id"] for role in roles[:count]]


def log_event(title: str, detail: str, event_type: str = "event") -> None:
    GAME["events"].append({"event": True, "type": event_type, "title": title, "detail": detail})


def add_star(player: dict[str, Any], reason: str) -> None:
    record = GAME["records"][player["order"]]
    record["stars"] += 1
    player["stars"] = record["stars"]
    log_event("⭐ 獲得星星", f"{player['name']}：{reason}", "star")


def bounds_from_guesses() -> tuple[int, int]:
    low = MIN_NUMBER
    high = MAX_NUMBER
    for guess in GAME["roundGuesses"]:
        if guess["result"] == "higher":
            low = max(low, guess["guess"] + 1)
        elif guess["result"] == "lower":
            high = min(high, guess["guess"] - 1)
        elif guess["result"] == "correct":
            low = high = guess["guess"]
    return low, high


def remember_tight_range(player: dict[str, Any]) -> None:
    if GAME["firstTightRangePlayer"] is not None:
        return
    low, high = bounds_from_guesses()
    if high >= low and high - low + 1 <= 10:
        GAME["firstTightRangePlayer"] = player["order"]


def current_player() -> dict[str, Any]:
    return GAME["players"][GAME["currentPlayerIndex"]]


def next_player() -> None:
    GAME["currentPlayerIndex"] = (GAME["currentPlayerIndex"] + 1) % len(GAME["players"])


def build_players(names: list[Any], role_assignments: list[str]) -> list[dict[str, Any]]:
    defaults = ["小獵人", "小可愛", "小灰貓", "小星星"]
    players = []
    for index, raw_name in enumerate(names):
        role = role_by_id(role_assignments[index] if index < len(role_assignments) else None)
        record = GAME["records"][index]
        players.append(
            {
                "name": clean_name(raw_name, defaults[index]),
                "role": role,
                "wins": record["wins"],
                "stars": record["stars"],
                "guesses": 0,
                "hintsUsed": 0,
                "won": False,
                "freeMissUsed": False,
                "detectivePrivilegeUsed": False,
                "order": index,
            }
        )
    return players


def public_state() -> dict[str, Any]:
    state = {
        "min": MIN_NUMBER,
        "max": MAX_NUMBER,
        "hintQuota": SHARED_HINTS_PER_ROUND,
        "roleDefs": ROLE_DEFS,
        "status": GAME["status"],
        "currentPlayerIndex": GAME["currentPlayerIndex"],
        "nextStartingPlayerIndex": GAME["nextStartingPlayerIndex"],
        "players": deepcopy(GAME["players"]),
        "guesses": deepcopy(GAME["events"]),
        "roundGuesses": deepcopy(GAME["roundGuesses"]),
        "hints": deepcopy(GAME["hints"]),
        "sharedHintsLeft": GAME["sharedHintsLeft"],
        "firstTightRangePlayer": GAME["firstTightRangePlayer"],
        "roleAssignments": deepcopy(GAME["roleAssignments"]),
        "message": GAME["message"],
        "roomCode": "PY",
    }
    if GAME["status"] == "finished":
        state["answer"] = GAME["answer"]
    return state


def reset_round() -> None:
    GAME["answer"] = random.randint(MIN_NUMBER, MAX_NUMBER)
    GAME["status"] = "playing"
    GAME["currentPlayerIndex"] = GAME["nextStartingPlayerIndex"] % len(GAME["players"])
    GAME["roundGuesses"] = []
    GAME["hints"] = []
    GAME["sharedHintsLeft"] = SHARED_HINTS_PER_ROUND
    GAME["firstTightRangePlayer"] = None
    for player in GAME["players"]:
        player.update(
            {
                "guesses": 0,
                "hintsUsed": 0,
                "won": False,
                "freeMissUsed": False,
                "detectivePrivilegeUsed": False,
                "wins": GAME["records"][player["order"]]["wins"],
                "stars": GAME["records"][player["order"]]["stars"],
            }
        )
    starter = current_player()
    GAME["message"] = f"{starter['name']} 先開始，請猜出 1 到 100 的神秘數字。"
    log_event("新局開始", f"{starter['name']} 先開始。共用提示池 {SHARED_HINTS_PER_ROUND} 次。", "round")


def award_round(player: dict[str, Any]) -> None:
    record = GAME["records"][player["order"]]
    record["wins"] += 1
    player["wins"] = record["wins"]
    add_star(player, "猜中神秘數字。")
    if player["role"].get("winBonusStar"):
        add_star(player, "星星獵人猜中時額外多 1 顆星。")
    if player["hintsUsed"] == 0:
        add_star(player, "本局沒有使用提示。")
    if GAME["firstTightRangePlayer"] == player["order"]:
        add_star(player, "最先把答案範圍縮小到 10 個以內。")


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/api/status")
def api_status():
    return jsonify(
        {
            "backend": "Python Flask",
            "game": "number-hunter",
            "mode": "backend-controlled",
            "server_time": datetime.now().isoformat(timespec="seconds"),
        }
    )


@app.post("/api/game/new")
def api_game_new():
    global GAME
    data = request.get_json(silent=True) or {}
    names = list(data.get("players") or [])[:4]
    if len(names) < 2:
        return jsonify({"error": "至少需要 2 位玩家。"}), 400
    GAME = blank_game()
    role_assignments = list(data.get("roles") or [])[: len(names)]
    if len(role_assignments) != len(names):
        role_assignments = draw_roles(len(names))
    GAME["roleAssignments"] = role_assignments
    GAME["players"] = build_players(names, role_assignments)
    reset_round()
    return jsonify(public_state())


@app.post("/api/game/restart")
def api_game_restart():
    if not GAME["players"]:
        return jsonify({"error": "尚未建立遊戲。"}), 400
    reset_round()
    return jsonify(public_state())


@app.get("/api/game/state")
def api_game_state():
    return jsonify(public_state())


@app.post("/api/game/guess")
def api_game_guess():
    data = request.get_json(silent=True) or {}
    if GAME["status"] != "playing":
        return jsonify({"error": "目前不是遊戲進行中。"}), 409
    try:
        guess = int(data.get("guess"))
    except (TypeError, ValueError):
        return jsonify({"error": "請輸入 1 到 100 的整數。"}), 400
    if not MIN_NUMBER <= guess <= MAX_NUMBER:
        return jsonify({"error": "請輸入 1 到 100 的整數。"}), 400

    player = current_player()
    if guess == GAME["answer"]:
        player["guesses"] += 1
        result = "correct"
        player["won"] = True
        GAME["roundGuesses"].append({"player": player["name"], "guess": guess, "result": result})
        GAME["events"].append({"player": player["name"], "guess": guess, "result": result})
        GAME["nextStartingPlayerIndex"] = (player["order"] + 1) % len(GAME["players"])
        award_round(player)
        GAME["status"] = "finished"
        GAME["message"] = f"{player['name']} 猜中答案 {GAME['answer']}，獲勝！"
        RESULTS.append(
            {
                "winner": player["name"],
                "answer": GAME["answer"],
                "players": deepcopy(GAME["players"]),
                "created_at": datetime.now().isoformat(timespec="seconds"),
            }
        )
        return jsonify(public_state())

    free_miss = bool(player["role"].get("freeMiss") and not player["freeMissUsed"])
    if free_miss:
        player["freeMissUsed"] = True
        log_event("📝 記錄員", f"{player['name']}第一次猜錯不計入猜測次數。", "role")
    else:
        player["guesses"] += 1

    result = "lower" if guess > GAME["answer"] else "higher"
    GAME["roundGuesses"].append({"player": player["name"], "guess": guess, "result": result})
    GAME["events"].append({"player": player["name"], "guess": guess, "result": result})
    remember_tight_range(player)
    next_player()
    direction = "答案更小" if result == "lower" else "答案更大"
    extra = "記錄員能力發動，本次不計猜測數。" if free_miss else ""
    GAME["message"] = f"{player['name']} 猜 {guess}，{direction}。{extra}換 {current_player()['name']}。"
    return jsonify(public_state())


def spend_hint(player: dict[str, Any]) -> bool:
    if GAME["sharedHintsLeft"] <= 0:
        return False
    GAME["sharedHintsLeft"] -= 1
    player["hintsUsed"] += 1
    return True


def finish_hint_turn(player: dict[str, Any], detail_text: str) -> None:
    if player["role"].get("detectivePrivilege") and not player["detectivePrivilegeUsed"]:
        player["detectivePrivilegeUsed"] = True
        log_event("🕵️ 偵探", f"{player['name']}提示後可繼續猜測。", "role")
        GAME["message"] = f"{player['name']} 使用提示：{detail_text}。偵探能力發動，可繼續猜。"
        return
    next_player()
    GAME["message"] = f"{player['name']} 使用提示：{detail_text}。使用提示跳過猜測，換 {current_player()['name']}。"


@app.post("/api/game/hint/range")
def api_hint_range():
    if GAME["status"] != "playing":
        return jsonify({"error": "目前不是遊戲進行中。"}), 409
    player = current_player()
    if not spend_hint(player):
        return jsonify({"error": "共用提示池已用完。"}), 409
    detail = "答案在 1~50" if GAME["answer"] <= 50 else "答案在 51~100"
    GAME["hints"].append({"player": player["name"], "label": "範圍掃描", "detail": detail})
    finish_hint_turn(player, f"範圍掃描：{detail}")
    return jsonify(public_state())


@app.post("/api/game/hint/near")
def api_hint_near():
    data = request.get_json(silent=True) or {}
    if GAME["status"] != "playing":
        return jsonify({"error": "目前不是遊戲進行中。"}), 409
    try:
        probe = int(data.get("probe"))
    except (TypeError, ValueError):
        return jsonify({"error": "請輸入 1 到 100 的探測數字。"}), 400
    if not MIN_NUMBER <= probe <= MAX_NUMBER:
        return jsonify({"error": "請輸入 1 到 100 的探測數字。"}), 400

    player = current_player()
    if not spend_hint(player):
        return jsonify({"error": "共用提示池已用完。"}), 409
    near_range = player["role"].get("nearRange", 10)
    if player["role"].get("nearRange"):
        log_event("🎯 狙擊手", f"{player['name']}鄰近探測範圍從 ±10 變成 ±5。", "role")
    close = abs(GAME["answer"] - probe) <= near_range
    detail = f"答案在 {probe} 的 ±{near_range} 內" if close else f"答案不在 {probe} 的 ±{near_range} 內"
    GAME["hints"].append({"player": player["name"], "label": f"鄰近探測 {probe}", "detail": detail})
    finish_hint_turn(player, f"鄰近探測：{detail}")
    return jsonify(public_state())


@app.get("/api/results")
def api_results():
    return jsonify({"results": RESULTS[-20:]})


@app.get("/<path:filename>")
def static_file(filename: str):
    target = (BASE_DIR / filename).resolve()
    if not str(target).startswith(str(BASE_DIR)) or not target.is_file():
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
