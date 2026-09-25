# 巴士站數學遊戲

一個為香港特殊學校高小學生設計的離線 HTML5 數學遊戲，練習 1–20 按數取量和序數。介面以 iPad 橫向為主要尺寸，同時支援桌面瀏覽器、觸控、滑鼠、鍵盤，以及會輸出滑鼠／指標事件的眼動儀。

## 開啟方法

### 電腦

最簡單的方法是直接雙擊 `dist/index.html`。Safari、Chrome、Edge 及 Firefox 均可使用。瀏覽器語音和下載 CSV 功能在部分瀏覽器的本地檔案模式可能受限制；遇到這情況可在專案資料夾執行：

```bash
python3 -m http.server 8000 --directory dist
```

然後開啟 `http://localhost:8000`。

### iPad

1. 把整個 `dist` 資料夾放到學校內聯網 Web 空間，或在同一 Wi‑Fi 的電腦執行上面的本地伺服器。
2. 在 iPad Safari 輸入該網址。
3. 可使用 Safari「分享」→「加入主畫面」，以接近 App 的方式開啟。
4. 建議鎖定 iPad 為橫向，長按「教師」3 秒進入設定頁，再選擇配色、字體和操作方式。

「教師」和遊戲內「主選單」均須持續按住 3 秒（或以眼動持續凝視 3 秒）才會開啟；進度環完成前移開或放手會立即取消，避免學生誤觸。

## 眼動儀

選擇「眼動」或「觸控＋眼動」。本版使用標準 pointer hover 事件，因此兼容把注視輸出為滑鼠指標的眼動軟件。視線進入大型目標會出現環形進度；移走立即取消，完成設定時間後才觸發。若眼動儀使用專用 JavaScript SDK，可日後只替換 `InputManager` 的事件來源，遊戲邏輯不用修改。

## 語音

所有 1–20 基數和序數粵語字串集中在 `app.js` 的 `NUMBERS`，所有語音呼叫集中在 `VoiceManager`。目前使用瀏覽器 `speechSynthesis` 並優先選擇 `zh-HK` 聲音；可日後把 `VoiceManager.say()` 換成預錄音檔播放器。

## 檔案結構

```text
mathgame/
├── README.md
├── tests/
│   ├── browser-tests.js       # 核心瀏覽器測試腳本
│   └── interaction-runner.html# 三秒長按互動測試頁
└── dist/
    ├── index.html             # 四個畫面及教師表單
    ├── styles.css             # 高對比、responsive、凝視環及動畫
    ├── app.js                 # 遊戲、輸入、語音、紀錄邏輯
    └── assets/
        ├── bus.png
        ├── bus-stop.png
        ├── passengers.png     # 原始 8 位一致風格乘客 sprite sheet
        ├── faces/             # 從原創素材裁出的 8 個獨立面部
        └── footprints.png
```

## 資料與私隱

設定和成果只儲存在裝置的 `localStorage`，不會傳送到伺服器。教師可在成果頁下載 CSV 或清除紀錄。清除瀏覽器網站資料亦會刪除本機紀錄。

## 建議課堂流程

先在「教師」頁使用注視測試區校準，開始時可選 1–5、簡單、較大字體和慢速語音；熟習後逐步提升數字範圍與難度。遊戲沒有倒數或限時，重聽不扣分。
