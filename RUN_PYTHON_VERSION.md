# 數字獵人 Python 後端版

這一份是「Python Flask 後端 + HTML/CSS/JS 前端」版本。

## 啟動方式

```powershell
cd "C:\Users\ggesh\Downloads\運算思維桌遊設計\內容確認配對完成_20260526_2215\數字獵人_Python後端版"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

開啟：

```text
http://127.0.0.1:5000
```

## 前後端連線

- `GET /api/status`：前端確認 Python Flask 後端是否啟動。
- `POST /api/results`：遊戲結束時可把勝利結果送到 Python 後端。
- `GET /api/results`：查看後端暫存的最近結果。

目前遊戲核心仍在前端 JavaScript，Python 負責提供網頁、API 狀態與結果紀錄。
