// Firebase 設定檔
// 專案 ID: project-971217462532

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "", // 請在網頁設定中輸入或在此直接填寫 Firebase Web API Key
  authDomain: "project-971217462532.firebaseapp.com",
  projectId: "project-971217462532",
  storageBucket: "project-971217462532.firebasestorage.app",
  messagingSenderId: "971217462532",
  appId: "" // 請在網頁設定中輸入或在此直接填寫 Firebase Web App ID
};

const STORAGE_KEY = "mytodolist_firebase_config";

export function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_FIREBASE_CONFIG,
        ...parsed,
        projectId: "project-971217462532" // 確保鎖定此專案 ID
      };
    }
  } catch (e) {
    console.warn("無法從 localStorage 讀取 Firebase 設定:", e);
  }
  return { ...DEFAULT_FIREBASE_CONFIG };
}

export function saveStoredFirebaseConfig(config) {
  try {
    const dataToSave = {
      apiKey: config.apiKey?.trim() || "",
      authDomain: config.authDomain?.trim() || "project-971217462532.firebaseapp.com",
      projectId: "project-971217462532",
      storageBucket: config.storageBucket?.trim() || "project-971217462532.firebasestorage.app",
      messagingSenderId: "971217462532",
      appId: config.appId?.trim() || ""
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    return true;
  } catch (e) {
    console.error("儲存 Firebase 設定失敗:", e);
    return false;
  }
}

export function clearStoredFirebaseConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("清除設定失敗:", e);
  }
}

export function isConfigComplete(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.apiKey.length > 5 &&
    config.projectId &&
    config.appId &&
    config.appId.length > 5
  );
}
