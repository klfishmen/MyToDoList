# MyToDoList - 多人協作待辦清單 (Firebase Web App)

一個專為團隊與個人打造的現代化待辦清單網頁應用程式，支援 **Google 帳號登入** 與 **Firebase Cloud Firestore 多人即時同步協作**。

專案綁定現有 Firebase 專案：`project-971217462532`。

---

## ✨ 核心特色

1. **Google 帳號一鍵登入**：支援 Google 官方驗證（Popup 登入），自動同步使用者個人頭像與暱稱。
2. **多人即時協作 (Real-time Collaboration)**：
   - 使用 Firebase Cloud Firestore `onSnapshot` 即時監聽機制。
   - 團隊成員打勾、新增、修改、刪除任務時，其他成員的螢幕**立即無縫同步更新**。
   - 清楚顯示每筆任務由哪位成員建立、哪位成員標記完成。
3. **多人清單分享與邀請**：
   - 支援「個人私有清單」與「多人協作清單」。
   - 提供專屬清單 ID 與一鍵複製加入連結（例如 `http://localhost:3000/?join=<清單ID>`），隊友點擊即可自動加入協作。
4. **豐富任務管理**：
   - 優先度分級（🔥 高優先、中優先、低優先）。
   - 截止日期（Due Date）提醒與格式化顯示。
   - 任務備註與補充細節展開。
   - 狀態篩選（全部、進行中、已完成）、優先度篩選及即時關鍵字搜尋。
   - 完成度進度條與統計卡片（總數、待辦、已完成、高優先）。
5. **免編譯、極速輕量架構**：
   - 純 HTML5 + Tailwind CSS + 原生 ES Module。
   - 內建零依賴 Node.js 本機伺服器 (`server.js`)。
   - 內建設定精靈與離線展示模式（Demo Mode）。

---

## 🚀 快速啟動

### 1. 啟動本機伺服器

在此專案目錄（`C:\Users\pcmci\.gemini\antigravity\scratch\MyToDoList`）開啟終端機並執行：

```bash
node server.js
```

或使用 npm：

```bash
npm start
```

### 2. 開啟瀏覽器

在瀏覽器網址列輸入：
👉 **http://localhost:3000**

> ⚠️ **重要提醒**：Google 帳號登入必須在 HTTP 伺服器環境下執行（如 `http://localhost:3000`），無法直接使用 `file:///` 開啟。

---

## ⚙️ Firebase 控制台設定指南 (project-971217462532)

若您尚未在 Firebase 控制台完成設定，請依照以下步驟啟用相應服務：

### 步驟 1：開啟 Firebase 控制台
前往專案頁面：
👉 [Firebase Console - project-971217462532](https://console.firebase.google.com/project/project-971217462532)

### 步驟 2：啟用 Google 登入驗證
1. 在左側選單點選 **建置 (Build)** > **Authentication**。
2. 點擊 **開始使用 (Get started)**。
3. 在 **登入方式 (Sign-in method)** 標籤頁中，點選 **Google**。
4. 開啟 **啟用 (Enable)** 開關，設定專案支援電子郵件，然後點選 **儲存 (Save)**。
5. 切換到 **設定 (Settings)** 標籤頁 > **已授權網域 (Authorized domains)**，確認已有 `localhost`（通常預設已包含）。

### 步驟 3：建立 Cloud Firestore 資料庫
1. 在左側選單點選 **建置 (Build)** > **Firestore Database**。
2. 點擊 **建立資料庫 (Create database)**。
3. 資料庫 ID 保留 `(default)`，選擇伺服器位置（例如 `asia-east1` 台灣或 `asia-northeast1` 東京）。
4. 安全性規則可先選擇 **以測試模式啟動 (Start in test mode)**，或參考下方貼上生產安全性規則。

### 步驟 4：取得 Web 應用程式設定 (apiKey 與 appId)
1. 點擊左上角齒輪圖示 **專案設定 (Project settings)** > **一般 (General)**。
2. 滾動到最下方 **您的應用程式 (Your apps)** 區塊：
   - 若尚未建立 Web 應用程式，點擊網頁圖示 `</>`（Web），輸入應用程式暱稱（例如 `MyToDoList`）並註冊。
3. 在 `firebaseConfig` 程式碼片段中找到：
   - `apiKey: "AIzaSy..."`
   - `appId: "1:971217462532:web:..."`

### 步驟 5：在 MyToDoList 中套用金鑰
您可以選擇以下任一種方式套用：
- **方式 A（推薦）**：在網頁介面右上角點擊 ⚙️ **齒輪按鈕**，直接貼入 `apiKey` 與 `appId` 並儲存。
- **方式 B**：直接編輯專案內的 `firebase-config.js`，填入 `apiKey` 與 `appId`。

---

## 🛡️ Cloud Firestore 安全性規則 (推薦設定)

在 Firebase 控制台的 **Firestore Database** > **規則 (Rules)** 中貼入以下內容：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // 清單規則：登入成員可讀取與建立清單
    match /lists/{listId} {
      allow read, create: if isAuthenticated();
      
      // 更新：協作者或建立者可更新，且允許新成員加入協作者
      allow update: if isAuthenticated() && (
        resource.data.createdBy == request.auth.uid ||
        resource.data.collaborators.hasAny([request.auth.uid]) ||
        request.resource.data.collaborators.hasAny([request.auth.uid])
      );
      
      // 刪除：只有建立者可刪除清單
      allow delete: if isAuthenticated() && resource.data.createdBy == request.auth.uid;
      
      // 清單內之任務規則：協作成員均可讀寫
      match /tasks/{taskId} {
        allow read, write: if isAuthenticated();
      }
    }
    
    // 使用者資訊快取規則
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}
```

---

## 📁 專案檔案結構

```text
MyToDoList/
├── index.html            # 主介面 HTML (Tailwind CSS, Lucide Icons, 響應式佈局)
├── app.js                # 主邏輯模組 (Firebase 10 Auth, Firestore 即時監聽與狀態管理)
├── firebase-config.js    # Firebase 設定檔 (預設專案 project-971217462532 與 LocalStorage 管理)
├── server.js             # 內建本機靜態伺服器 (Node.js 原生 http 模組，監聽 Port 3000)
├── firestore.rules       # Cloud Firestore 建議安全規則
├── package.json          # 專案資訊與啟動腳本
└── README.md             # 專案完整說明文件
```

---

## 💡 多人協作操作步驟示範

1. **A 使用者** 使用 Google 帳號登入系統。
2. 建立新清單並勾選「**開啟多人協作**」（例如「專案開發衝刺」）。
3. 點選「**邀請成員**」或點擊清單 ID 複製專屬分享連結。
4. 將連結發送給 **B 使用者**。
5. **B 使用者** 在瀏覽器開啟該連結並以 Google 帳號登入，系統將自動將 B 使用者加入此清單的協作者。
6. 任何一方新增待辦事項或點擊打勾完成，兩邊畫面皆會在**毫秒內即時同步**！
