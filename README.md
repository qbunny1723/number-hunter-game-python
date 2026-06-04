# 數字獵人 Python 後端版

這是「Python Flask 後端控制遊戲 + HTML/CSS/JavaScript 前端呈現畫面」版本。

## Python 後端負責

- 產生神秘數字
- 管理玩家、角色、回合與下一局起始玩家
- 判斷猜測結果：答案更大、答案更小、猜中
- 管理共用提示池
- 執行角色能力：偵探、狙擊手、記錄員、星星獵人
- 計算星星與勝場
- 記錄事件簿

## 前端負責

- 顯示遊戲畫面
- 顯示數字地圖、玩家排行、事件簿、提示狀態
- 收集玩家輸入
- 透過 API 把操作送到 Python 後端
- 根據 Python 回傳的狀態更新畫面

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

## API

```text
GET  /api/status
POST /api/game/new
GET  /api/game/state
POST /api/game/guess
POST /api/game/hint/range
POST /api/game/hint/near
POST /api/game/restart
GET  /api/results
```

## 主要檔案

```text
app.py             Python Flask 後端與遊戲規則
index.html         前端頁面
style.css          前端樣式
script.js          前端 API 操作與畫面更新
backend-status.js  前端確認 Python 後端連線
requirements.txt   Python 套件需求
```
