// MyToDoList - 主應用程式 (支援 Google 登入與多人即時協作)
import { 
  getStoredFirebaseConfig, 
  saveStoredFirebaseConfig, 
  clearStoredFirebaseConfig, 
  isConfigComplete 
} from './firebase-config.js';

// 動態載入 Firebase SDK (官方 CDN ESM 模組)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  arrayUnion 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// ================= 全域狀態 (State) =================
let app = null;
let auth = null;
let db = null;
let currentUser = null;
let isDemoMode = false;

let lists = [];
let currentList = null;
let tasks = [];
let unsubscribeLists = null;
let unsubscribeTasks = null;

let currentFilter = 'all'; // 'all' | 'pending' | 'completed'
let currentPriorityFilter = 'all'; // 'all' | 'high' | 'medium' | 'low'
let searchQuery = '';

// ================= DOM 元素快取 =================
const dom = {
  // 導航與帳號
  btnGoogleLogin: document.getElementById('btnGoogleLogin'),
  userProfileSection: document.getElementById('userProfileSection'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  btnSignOut: document.getElementById('btnSignOut'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  
  // Banner 提示
  configWarningBanner: document.getElementById('configWarningBanner'),
  btnBannerOpenSettings: document.getElementById('btnBannerOpenSettings'),
  btnToggleDemoMode: document.getElementById('btnToggleDemoMode'),
  loginHeroBanner: document.getElementById('loginHeroBanner'),
  btnHeroGoogleLogin: document.getElementById('btnHeroGoogleLogin'),
  btnHeroOpenSettings: document.getElementById('btnHeroOpenSettings'),

  // 清單管理 (左邊欄)
  listsContainer: document.getElementById('listsContainer'),
  btnCreateListModal: document.getElementById('btnCreateListModal'),
  btnJoinListModal: document.getElementById('btnJoinListModal'),
  collaboratorsCard: document.getElementById('collaboratorsCard'),
  collaboratorsList: document.getElementById('collaboratorsList'),
  quickCopyListId: document.getElementById('quickCopyListId'),
  currentListIdText: document.getElementById('currentListIdText'),
  btnShareCurrentList: document.getElementById('btnShareCurrentList'),

  // 主內容區
  currentListTitle: document.getElementById('currentListTitle'),
  currentListBadge: document.getElementById('currentListBadge'),
  currentListDescription: document.getElementById('currentListDescription'),
  btnShareListTop: document.getElementById('btnShareListTop'),
  btnDeleteCurrentList: document.getElementById('btnDeleteCurrentList'),
  
  // 統計與進度
  statTotal: document.getElementById('statTotal'),
  statPending: document.getElementById('statPending'),
  statCompleted: document.getElementById('statCompleted'),
  statHigh: document.getElementById('statHigh'),
  statPercent: document.getElementById('statPercent'),
  progressBar: document.getElementById('progressBar'),

  // 新增任務表單
  addTaskForm: document.getElementById('addTaskForm'),
  inputTaskTitle: document.getElementById('inputTaskTitle'),
  inputTaskDueDate: document.getElementById('inputTaskDueDate'),
  inputTaskNotes: document.getElementById('inputTaskNotes'),
  btnToggleNotes: document.getElementById('btnToggleNotes'),
  notesContainer: document.getElementById('notesContainer'),
  
  // 篩選與搜尋
  filterButtons: document.querySelectorAll('.filter-btn'),
  selectPriorityFilter: document.getElementById('selectPriorityFilter'),
  inputSearch: document.getElementById('inputSearch'),
  tasksList: document.getElementById('tasksList'),

  // 彈窗 (Modals)
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
  settingsForm: document.getElementById('settingsForm'),
  configApiKey: document.getElementById('configApiKey'),
  configAppId: document.getElementById('configAppId'),
  configAuthDomain: document.getElementById('configAuthDomain'),
  configProjectId: document.getElementById('configProjectId'),
  btnResetSettings: document.getElementById('btnResetSettings'),

  createListModal: document.getElementById('createListModal'),
  btnCloseCreateListModal: document.getElementById('btnCloseCreateListModal'),
  createListForm: document.getElementById('createListForm'),
  inputListName: document.getElementById('inputListName'),
  inputListDescription: document.getElementById('inputListDescription'),
  checkboxIsCollaborative: document.getElementById('checkboxIsCollaborative'),
  btnCancelCreateList: document.getElementById('btnCancelCreateList'),

  joinListModal: document.getElementById('joinListModal'),
  btnCloseJoinListModal: document.getElementById('btnCloseJoinListModal'),
  joinListForm: document.getElementById('joinListForm'),
  inputJoinListId: document.getElementById('inputJoinListId'),
  btnCancelJoinList: document.getElementById('btnCancelJoinList'),

  shareModal: document.getElementById('shareModal'),
  btnCloseShareModal: document.getElementById('btnCloseShareModal'),
  shareModalListId: document.getElementById('shareModalListId'),
  shareModalUrl: document.getElementById('shareModalUrl'),
  btnCopyShareId: document.getElementById('btnCopyShareId'),
  btnCopyShareUrl: document.getElementById('btnCopyShareUrl'),

  editTaskModal: document.getElementById('editTaskModal'),
  btnCloseEditTaskModal: document.getElementById('btnCloseEditTaskModal'),
  editTaskForm: document.getElementById('editTaskForm'),
  editTaskId: document.getElementById('editTaskId'),
  editTaskTitle: document.getElementById('editTaskTitle'),
  editTaskNotes: document.getElementById('editTaskNotes'),
  editTaskPriority: document.getElementById('editTaskPriority'),
  editTaskDueDate: document.getElementById('editTaskDueDate'),
  btnCancelEditTask: document.getElementById('btnCancelEditTask'),

  toastContainer: document.getElementById('toastContainer')
};

// ================= 工具函數 (Utilities) =================
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColors = {
    info: 'bg-slate-800 text-white',
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-600 text-white',
    error: 'bg-rose-600 text-white'
  };

  toast.className = `${bgColors[type] || bgColors.info} px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg flex items-center space-x-2 transition-all transform duration-300 opacity-0 translate-y-2 pointer-events-auto`;
  toast.innerHTML = `<span>${message}</span>`;
  
  dom.toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch (e) {
    return dateStr;
  }
}

// ================= Firebase 初始化 =================
function initFirebaseApp() {
  const config = getStoredFirebaseConfig();
  
  // 填寫設定彈窗中的表單值
  dom.configApiKey.value = config.apiKey || '';
  dom.configAppId.value = config.appId || '';
  dom.configAuthDomain.value = config.authDomain || 'project-971217462532.firebaseapp.com';
  dom.configProjectId.value = config.projectId || 'project-971217462532';

  if (!isConfigComplete(config)) {
    console.log("Firebase 設定尚未填寫完整，顯示設定提示");
    dom.configWarningBanner.classList.remove('hidden');
    refreshIcons();
    return false;
  }

  dom.configWarningBanner.classList.add('hidden');

  try {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);

    console.log("Firebase 初始化成功，專案:", config.projectId);

    // 監聽使用者驗證狀態
    onAuthStateChanged(auth, handleAuthStateChanged);
    return true;
  } catch (err) {
    console.error("Firebase 初始化失敗:", err);
    showToast(`Firebase 初始化錯誤: ${err.message}`, 'error');
    dom.configWarningBanner.classList.remove('hidden');
    return false;
  }
}

// ================= 驗證狀態變更 (Auth State) =================
async function handleAuthStateChanged(user) {
  currentUser = user;

  if (user) {
    // 使用者已登入 Google
    dom.btnGoogleLogin.classList.add('hidden');
    dom.userProfileSection.classList.remove('hidden');
    dom.loginHeroBanner.classList.add('hidden');

    dom.userName.textContent = user.displayName || 'Google 使用者';
    dom.userEmail.textContent = user.email || '';
    dom.userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=4f46e5&color=fff`;

    // 儲存/更新使用者資訊至 Firestore 集合 (供協作顯示頭像與姓名)
    if (db && !isDemoMode) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          displayName: user.displayName || 'Google 使用者',
          email: user.email || '',
          photoURL: user.photoURL || '',
          lastActive: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("無法同步使用者資料庫:", e);
      }
    }

    showToast(`歡迎回來，${user.displayName || '使用者'}！`, 'success');

    // 檢查網址是否有待加入的協作清單 ?join=LIST_ID
    checkUrlJoinParam();

    // 載入使用者可見的所有清單 (監聽即時更新)
    subscribeUserLists(user.uid);

  } else {
    // 未登入
    dom.btnGoogleLogin.classList.remove('hidden');
    dom.userProfileSection.classList.add('hidden');
    dom.loginHeroBanner.classList.remove('hidden');
    
    // 清除監聽
    if (unsubscribeLists) unsubscribeLists();
    if (unsubscribeTasks) unsubscribeTasks();
    lists = [];
    currentList = null;
    tasks = [];

    renderLists();
    renderTasks();
  }
  refreshIcons();
}

// 檢查 URL 中的 ?join=LIST_ID
async function checkUrlJoinParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const joinId = urlParams.get('join');
  if (joinId && currentUser) {
    console.log("偵測到加入清單請求:", joinId);
    await joinListById(joinId);
    // 清除網址參數，維持乾淨
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ================= Google 登入 / 登出 =================
async function signInWithGoogle() {
  if (isDemoMode) {
    // 示範模式下的模擬登入
    currentUser = {
      uid: 'demo-user-123',
      displayName: '體驗者 (Demo)',
      email: 'demo@example.com',
      photoURL: 'https://ui-avatars.com/api/?name=Demo&background=6366f1&color=fff'
    };
    handleAuthStateChanged(currentUser);
    return;
  }

  if (!auth) {
    showToast("請先點選右上角齒輪設定 Firebase Web API Key", "warning");
    openSettingsModal();
    return;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    dom.btnGoogleLogin.disabled = true;
    dom.btnHeroGoogleLogin.disabled = true;
    showToast("正在開啟 Google 登入視窗...", "info");
    
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Google 登入失敗:", err);
    if (err.code === 'auth/unauthorized-domain') {
      showToast("此網域尚未加入 Firebase 已授權網域，請至控制台確認 localhost 是否已授權", "error");
    } else if (err.code === 'auth/popup-closed-by-user') {
      showToast("登入視窗已關閉", "info");
    } else if (err.code === 'auth/operation-not-allowed') {
      showToast("尚未在 Firebase Console 啟用 Google 登入方式", "error");
    } else {
      showToast(`登入失敗: ${err.message}`, "error");
    }
  } finally {
    dom.btnGoogleLogin.disabled = false;
    dom.btnHeroGoogleLogin.disabled = false;
  }
}

async function userSignOut() {
  if (isDemoMode) {
    currentUser = null;
    handleAuthStateChanged(null);
    showToast("已登出展示帳號", "info");
    return;
  }

  if (!auth) return;
  try {
    await signOut(auth);
    showToast("已安全登出", "info");
  } catch (err) {
    console.error("登出失敗:", err);
    showToast("登出失敗", "error");
  }
}

// ================= 清單即時同步 (Lists Sync) =================
function subscribeUserLists(uid) {
  if (isDemoMode) {
    loadDemoLists();
    return;
  }

  if (!db) return;
  if (unsubscribeLists) unsubscribeLists();

  // 監聽協作者包含目前使用者或建立者為目前使用者的清單
  const listsRef = collection(db, 'lists');
  const q = query(listsRef, where('collaborators', 'array-contains', uid));

  unsubscribeLists = onSnapshot(q, (snapshot) => {
    lists = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 若使用者完全沒有清單，自動建立一個「協作待辦範本」
    if (lists.length === 0) {
      createDefaultWelcomeList();
      return;
    }

    // 若目前尚未選取清單或目前清單已被刪除，切換至第一個清單
    if (!currentList || !lists.some(l => l.id === currentList.id)) {
      selectList(lists[0]);
    } else {
      // 更新目前選中清單的資料
      const updated = lists.find(l => l.id === currentList.id);
      if (updated) {
        currentList = updated;
        updateCurrentListHeader();
      }
    }

    renderLists();
  }, (err) => {
    console.error("監聽清單列表失敗:", err);
    showToast("讀取清單資料失敗，請檢查 Firestore 安全性規則", "error");
  });
}

// 自動建立首個預設清單
async function createDefaultWelcomeList() {
  if (!db || !currentUser) return;
  try {
    const listData = {
      name: "🚀 團隊多人協作待辦",
      description: "歡迎！此清單已開啟多人協作，點擊右上方「邀請成員」分享給隊友同步編輯！",
      isCollaborative: true,
      createdBy: currentUser.uid,
      creatorName: currentUser.displayName || '使用者',
      creatorPhoto: currentUser.photoURL || '',
      collaborators: [currentUser.uid],
      collaboratorDetails: [{
        uid: currentUser.uid,
        displayName: currentUser.displayName || '使用者',
        photoURL: currentUser.photoURL || '',
        email: currentUser.email || ''
      }],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'lists'), listData);

    // 加入兩筆範例任務
    await addDoc(collection(db, 'lists', docRef.id, 'tasks'), {
      title: "歡迎使用 MyToDoList！點擊核取方塊標記完成",
      notes: "支援優先級、截止日期與即時同步，大家都能看到更新。",
      priority: "high",
      dueDate: new Date().toISOString().split('T')[0],
      completed: false,
      createdBy: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || '使用者',
        photoURL: currentUser.photoURL || ''
      },
      createdAt: serverTimestamp()
    });

    await addDoc(collection(db, 'lists', docRef.id, 'tasks'), {
      title: "邀請其他隊友加入協作",
      notes: "複製協作 ID 或加入連結分享給隊友，立即享受 Google 登入多人同步！",
      priority: "medium",
      dueDate: "",
      completed: false,
      createdBy: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || '使用者',
        photoURL: currentUser.photoURL || ''
      },
      createdAt: serverTimestamp()
    });

  } catch (e) {
    console.error("建立預設清單失敗:", e);
  }
}

// 切換選取的清單
function selectList(list) {
  currentList = list;
  updateCurrentListHeader();
  renderLists();
  subscribeTasks(list.id);
}

function updateCurrentListHeader() {
  if (!currentList) {
    dom.currentListTitle.textContent = "請選擇清單";
    dom.currentListDescription.textContent = "";
    dom.currentListBadge.textContent = "無";
    dom.currentListBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600";
    dom.collaboratorsCard.classList.add('hidden');
    dom.btnShareListTop.classList.add('hidden');
    return;
  }

  dom.currentListTitle.textContent = currentList.name;
  dom.currentListDescription.textContent = currentList.description || "未提供說明";

  if (currentList.isCollaborative) {
    dom.currentListBadge.textContent = `多人協作 (${(currentList.collaborators || []).length} 人)`;
    dom.currentListBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700";
    dom.collaboratorsCard.classList.remove('hidden');
    dom.btnShareListTop.classList.remove('hidden');
    dom.currentListIdText.textContent = currentList.id;

    // 渲染協作者資訊卡
    renderCollaborators();
  } else {
    dom.currentListBadge.textContent = "個人私有";
    dom.currentListBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700";
    dom.collaboratorsCard.classList.add('hidden');
    dom.btnShareListTop.classList.add('hidden');
  }

  refreshIcons();
}

function renderCollaborators() {
  if (!currentList || !currentList.collaboratorDetails) {
    dom.collaboratorsList.innerHTML = `<div class="text-xs text-slate-400">目前尚無其他成員</div>`;
    return;
  }

  const details = currentList.collaboratorDetails || [];
  dom.collaboratorsList.innerHTML = details.map(c => `
    <div class="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-50 transition">
      <div class="flex items-center space-x-2 min-w-0">
        <img src="${c.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.displayName || 'U')}&background=4f46e5&color=fff`}" 
             alt="${c.displayName}" 
             class="w-6 h-6 rounded-full object-cover border border-slate-200 flex-shrink-0">
        <div class="truncate">
          <span class="font-medium text-slate-700 block truncate">${c.displayName || '使用者'}</span>
          ${c.uid === currentList.createdBy ? '<span class="text-[10px] text-brand-600 block">建立者</span>' : ''}
        </div>
      </div>
      ${c.uid === currentUser?.uid ? '<span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">您</span>' : ''}
    </div>
  `).join('');
}

function renderLists() {
  if (!currentUser) {
    dom.listsContainer.innerHTML = `
      <div class="text-center py-8 px-2 text-slate-400 text-xs">
        <i data-lucide="lock" class="w-6 h-6 mx-auto mb-1 text-slate-300"></i>
        請先登入 Google 帳號以檢視與建立清單
      </div>
    `;
    refreshIcons();
    return;
  }

  if (lists.length === 0) {
    dom.listsContainer.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        尚無待辦清單，請點上方「新增清單」
      </div>
    `;
    refreshIcons();
    return;
  }

  dom.listsContainer.innerHTML = lists.map(list => {
    const isSelected = currentList && currentList.id === list.id;
    return `
      <button 
        onclick="window.__selectListById('${list.id}')"
        class="w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between group ${
          isSelected 
            ? 'bg-brand-50 border border-brand-200 text-brand-900 font-semibold shadow-xs' 
            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
        }"
      >
        <div class="flex items-center space-x-2.5 truncate">
          <i data-lucide="${list.isCollaborative ? 'users' : 'list-todo'}" class="w-4 h-4 ${isSelected ? 'text-brand-600' : 'text-slate-400'} flex-shrink-0"></i>
          <span class="text-xs truncate">${list.name}</span>
        </div>
        ${list.isCollaborative ? '<span class="text-[10px] bg-indigo-50 text-brand-600 px-1.5 py-0.5 rounded font-mono font-medium">協作</span>' : ''}
      </button>
    `;
  }).join('');

  refreshIcons();
}

window.__selectListById = function(listId) {
  const found = lists.find(l => l.id === listId);
  if (found) selectList(found);
};

// ================= 任務即時監聽與操作 (Tasks Sync) =================
function subscribeTasks(listId) {
  if (isDemoMode) {
    loadDemoTasks(listId);
    return;
  }

  if (!db) return;
  if (unsubscribeTasks) unsubscribeTasks();

  const tasksRef = collection(db, 'lists', listId, 'tasks');
  const q = query(tasksRef);

  unsubscribeTasks = onSnapshot(q, (snapshot) => {
    tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 依未完成在前、已完成在後排序，且建立時間最新在前
    tasks.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    renderTasks();
    updateStats();
  }, (err) => {
    console.error("監聽任務失敗:", err);
    showToast("即時載入任務失敗", "error");
  });
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const high = tasks.filter(t => !t.completed && t.priority === 'high').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  dom.statTotal.textContent = total;
  dom.statPending.textContent = pending;
  dom.statCompleted.textContent = completed;
  dom.statHigh.textContent = high;
  dom.statPercent.textContent = `${percent}%`;
  dom.progressBar.style.width = `${percent}%`;
}

function renderTasks() {
  if (!currentList) {
    dom.tasksList.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-200">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
        <p class="text-slate-500 font-medium text-sm">請先選擇或新增一個待辦清單</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  // 篩選與搜尋
  let filtered = tasks.filter(t => {
    if (currentFilter === 'pending' && t.completed) return false;
    if (currentFilter === 'completed' && !t.completed) return false;
    if (currentPriorityFilter !== 'all' && t.priority !== currentPriorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      if (!matchTitle && !matchNotes) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    dom.tasksList.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-200">
        <i data-lucide="check-check" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
        <p class="text-slate-500 font-medium text-sm">沒有符合條件的任務</p>
        <p class="text-slate-400 text-xs mt-1">在上方輸入框輸入任務開始協作！</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  const priorityBadges = {
    high: '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">🔥 高優先</span>',
    medium: '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">中優先</span>',
    low: '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">低優先</span>'
  };

  dom.tasksList.innerHTML = filtered.map(t => {
    const isCompleted = Boolean(t.completed);
    const creator = t.createdBy || { displayName: '成員', photoURL: '' };
    const completer = t.completedBy || null;

    return `
      <div class="bg-white rounded-2xl border transition-all duration-200 p-4 shadow-xs hover:shadow-md flex items-start justify-between gap-3 ${
        isCompleted ? 'border-slate-200 bg-slate-50/70 opacity-75' : 'border-slate-200/90'
      }">
        
        <!-- 左側核取框與主要文字 -->
        <div class="flex items-start space-x-3 min-w-0 flex-1">
          <!-- 核取方塊 -->
          <button 
            onclick="window.__toggleTask('${t.id}', ${!isCompleted})" 
            title="${isCompleted ? '標記為未完成' : '標記為已完成'}"
            class="mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
              isCompleted 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'border-slate-300 hover:border-brand-500 bg-white text-transparent'
            }"
          >
            <i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>
          </button>

          <!-- 任務標題與補充內容 -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'} break-words">
                ${escapeHtml(t.title)}
              </span>
              ${priorityBadges[t.priority] || ''}
              ${t.dueDate ? `
                <span class="inline-flex items-center space-x-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <i data-lucide="calendar" class="w-3 h-3"></i>
                  <span>${formatDate(t.dueDate)}</span>
                </span>
              ` : ''}
            </div>

            ${t.notes ? `
              <p class="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">${escapeHtml(t.notes)}</p>
            ` : ''}

            <!-- 協作者即時頭像與狀態標記 -->
            <div class="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
              <!-- 建立者 -->
              <div class="flex items-center space-x-1.5" title="建立者">
                <img src="${creator.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.displayName || 'U')}&background=4f46e5&color=fff`}" 
                     class="w-4 h-4 rounded-full object-cover">
                <span>${creator.displayName || '成員'} 建立</span>
              </div>

              <!-- 完成者資訊 -->
              ${isCompleted && completer ? `
                <div class="flex items-center space-x-1.5 text-emerald-600 font-medium" title="完成者">
                  <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                  <span>${completer.displayName || '成員'} 已完成</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 右側操作按鈕 (編輯 / 刪除) -->
        <div class="flex items-center space-x-1 flex-shrink-0">
          <button 
            onclick="window.__openEditModal('${t.id}')"
            title="編輯任務" 
            class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button 
            onclick="window.__deleteTask('${t.id}')"
            title="刪除任務" 
            class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

      </div>
    `;
  }).join('');

  refreshIcons();
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 待辦任務全域視窗掛載函數
window.__toggleTask = async function(taskId, completedStatus) {
  if (isDemoMode) {
    const t = tasks.find(item => item.id === taskId);
    if (t) {
      t.completed = completedStatus;
      if (completedStatus) {
        t.completedBy = { displayName: currentUser?.displayName || '示範者' };
      }
      renderTasks();
      updateStats();
    }
    return;
  }

  if (!db || !currentList) return;
  try {
    const taskDocRef = doc(db, 'lists', currentList.id, 'tasks', taskId);
    const updatePayload = {
      completed: completedStatus,
      updatedAt: serverTimestamp()
    };

    if (completedStatus) {
      updatePayload.completedBy = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || '使用者',
        photoURL: currentUser.photoURL || ''
      };
      updatePayload.completedAt = serverTimestamp();
    }

    await updateDoc(taskDocRef, updatePayload);
  } catch (err) {
    console.error("更新任務狀態失敗:", err);
    showToast("更新狀態失敗", "error");
  }
};

window.__deleteTask = async function(taskId) {
  if (!confirm("確定要刪除這筆待辦事項嗎？")) return;

  if (isDemoMode) {
    tasks = tasks.filter(t => t.id !== taskId);
    renderTasks();
    updateStats();
    showToast("任務已刪除", "info");
    return;
  }

  if (!db || !currentList) return;
  try {
    await deleteDoc(doc(db, 'lists', currentList.id, 'tasks', taskId));
    showToast("任務已刪除", "info");
  } catch (err) {
    console.error("刪除任務失敗:", err);
    showToast("刪除失敗", "error");
  }
};

window.__openEditModal = function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  dom.editTaskId.value = task.id;
  dom.editTaskTitle.value = task.title || '';
  dom.editTaskNotes.value = task.notes || '';
  dom.editTaskPriority.value = task.priority || 'medium';
  dom.editTaskDueDate.value = task.dueDate || '';

  dom.editTaskModal.classList.remove('hidden');
  refreshIcons();
};

// ================= 表單提交與操作事件 =================

// 1. 新增任務提交
dom.addTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showToast("請先登入 Google 帳號後再新增任務", "warning");
    signInWithGoogle();
    return;
  }

  if (!currentList) {
    showToast("請先建立或選取清單", "warning");
    return;
  }

  const title = dom.inputTaskTitle.value.trim();
  if (!title) return;

  const priorityEl = document.querySelector('input[name="priority"]:checked');
  const priority = priorityEl ? priorityEl.value : 'medium';
  const dueDate = dom.inputTaskDueDate.value;
  const notes = dom.inputTaskNotes.value.trim();

  if (isDemoMode) {
    const newTask = {
      id: 'demo-task-' + Date.now(),
      title,
      notes,
      priority,
      dueDate,
      completed: false,
      createdBy: {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      },
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    };
    tasks.unshift(newTask);
    renderTasks();
    updateStats();
    dom.addTaskForm.reset();
    showToast("任務已新增 (展示模式)", "success");
    return;
  }

  try {
    dom.addTaskForm.querySelector('button[type="submit"]').disabled = true;
    
    await addDoc(collection(db, 'lists', currentList.id, 'tasks'), {
      title,
      notes,
      priority,
      dueDate,
      completed: false,
      createdBy: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || '使用者',
        photoURL: currentUser.photoURL || ''
      },
      createdAt: serverTimestamp()
    });

    dom.addTaskForm.reset();
    dom.notesContainer.classList.add('hidden');
    showToast("任務已新增，即時同步至隊友螢幕！", "success");
  } catch (err) {
    console.error("新增任務失敗:", err);
    showToast(`新增任務失敗: ${err.message}`, "error");
  } finally {
    dom.addTaskForm.querySelector('button[type="submit"]').disabled = false;
  }
});

// 2. 儲存編輯任務
dom.editTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const taskId = dom.editTaskId.value;
  const title = dom.editTaskTitle.value.trim();
  const notes = dom.editTaskNotes.value.trim();
  const priority = dom.editTaskPriority.value;
  const dueDate = dom.editTaskDueDate.value;

  if (!taskId || !title) return;

  if (isDemoMode) {
    const t = tasks.find(item => item.id === taskId);
    if (t) {
      t.title = title;
      t.notes = notes;
      t.priority = priority;
      t.dueDate = dueDate;
      renderTasks();
      updateStats();
    }
    dom.editTaskModal.classList.add('hidden');
    showToast("變更已儲存", "success");
    return;
  }

  try {
    await updateDoc(doc(db, 'lists', currentList.id, 'tasks', taskId), {
      title,
      notes,
      priority,
      dueDate,
      updatedAt: serverTimestamp()
    });

    dom.editTaskModal.classList.add('hidden');
    showToast("變更已成功同步", "success");
  } catch (err) {
    console.error("編輯任務失敗:", err);
    showToast("儲存失敗", "error");
  }
});

// 3. 建立新清單提交
dom.createListForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) {
    showToast("請先登入 Google 帳號", "warning");
    return;
  }

  const name = dom.inputListName.value.trim();
  const description = dom.inputListDescription.value.trim();
  const isCollaborative = dom.checkboxIsCollaborative.checked;

  if (!name) return;

  if (isDemoMode) {
    const newList = {
      id: 'demo-list-' + Date.now(),
      name,
      description,
      isCollaborative,
      createdBy: currentUser.uid,
      collaborators: [currentUser.uid],
      collaboratorDetails: [{
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      }]
    };
    lists.push(newList);
    selectList(newList);
    dom.createListModal.classList.add('hidden');
    dom.createListForm.reset();
    showToast("清單建立成功！", "success");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, 'lists'), {
      name,
      description,
      isCollaborative,
      createdBy: currentUser.uid,
      creatorName: currentUser.displayName || '使用者',
      creatorPhoto: currentUser.photoURL || '',
      collaborators: [currentUser.uid],
      collaboratorDetails: [{
        uid: currentUser.uid,
        displayName: currentUser.displayName || '使用者',
        photoURL: currentUser.photoURL || '',
        email: currentUser.email || ''
      }],
      createdAt: serverTimestamp()
    });

    dom.createListModal.classList.add('hidden');
    dom.createListForm.reset();
    showToast(`清單「${name}」建立成功！`, "success");
  } catch (err) {
    console.error("建立清單失敗:", err);
    showToast(`建立清單失敗: ${err.message}`, "error");
  }
});

// 4. 輸入清單代碼加入協作
dom.joinListForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawInput = dom.inputJoinListId.value.trim();
  if (!rawInput) return;

  // 支援貼上整個 URL 或純清單 ID
  let targetId = rawInput;
  try {
    if (rawInput.includes('?join=')) {
      const u = new URL(rawInput);
      targetId = u.searchParams.get('join') || targetId;
    }
  } catch (_) {}

  dom.joinListModal.classList.add('hidden');
  dom.joinListForm.reset();
  await joinListById(targetId);
});

async function joinListById(listId) {
  if (!currentUser) {
    showToast("請先登入 Google 帳號以加入協作清單", "warning");
    signInWithGoogle();
    return;
  }

  if (isDemoMode) {
    showToast("展示模式不支援雲端加入清單", "info");
    return;
  }

  try {
    showToast("正在加入協作清單...", "info");
    const docRef = doc(db, 'lists', listId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      showToast("找不到該清單，請確認清單 ID 是否正確", "error");
      return;
    }

    const listData = snap.data();

    // 將使用者加入清單協作者陣列
    const userDetail = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || '使用者',
      photoURL: currentUser.photoURL || '',
      email: currentUser.email || ''
    };

    // 檢查是否已在協作者中
    const existingDetails = listData.collaboratorDetails || [];
    const hasDetail = existingDetails.some(d => d.uid === currentUser.uid);
    const updatedDetails = hasDetail ? existingDetails : [...existingDetails, userDetail];

    await updateDoc(docRef, {
      collaborators: arrayUnion(currentUser.uid),
      collaboratorDetails: updatedDetails
    });

    showToast(`已成功加入「${listData.name}」協作！`, "success");
    selectList({ id: snap.id, ...listData, collaboratorDetails: updatedDetails });

  } catch (err) {
    console.error("加入清單失敗:", err);
    showToast(`加入失敗: ${err.message}`, "error");
  }
}

// 5. 刪除目前清單
dom.btnDeleteCurrentList.addEventListener('click', async () => {
  if (!currentList) return;
  if (!confirm(`確定要刪除「${currentList.name}」清單及其所有待辦任務嗎？`)) return;

  if (isDemoMode) {
    lists = lists.filter(l => l.id !== currentList.id);
    currentList = lists[0] || null;
    updateCurrentListHeader();
    renderLists();
    renderTasks();
    showToast("清單已刪除", "info");
    return;
  }

  try {
    await deleteDoc(doc(db, 'lists', currentList.id));
    showToast("清單已刪除", "info");
  } catch (err) {
    console.error("刪除清單失敗:", err);
    showToast("刪除清單失敗，可能權限不足", "error");
  }
});

// 6. 設定表單提交
dom.settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const apiKey = dom.configApiKey.value.trim();
  const appId = dom.configAppId.value.trim();
  const authDomain = dom.configAuthDomain.value.trim();

  if (!apiKey || !appId) {
    showToast("請填寫 apiKey 與 appId", "warning");
    return;
  }

  saveStoredFirebaseConfig({
    apiKey,
    appId,
    authDomain,
    projectId: "project-971217462532"
  });

  dom.settingsModal.classList.add('hidden');
  showToast("Firebase 設定已儲存，正在重新整理網頁...", "success");
  setTimeout(() => {
    window.location.reload();
  }, 1000);
});

// 重設設定
dom.btnResetSettings.addEventListener('click', () => {
  if (confirm("確定要重設 Firebase 設定嗎？")) {
    clearStoredFirebaseConfig();
    window.location.reload();
  }
});

// ================= 彈窗開關控制 =================
function openSettingsModal() {
  dom.settingsModal.classList.remove('hidden');
  refreshIcons();
}

dom.btnOpenSettings.addEventListener('click', openSettingsModal);
dom.btnBannerOpenSettings.addEventListener('click', openSettingsModal);
dom.btnHeroOpenSettings.addEventListener('click', openSettingsModal);
dom.btnCloseSettingsModal.addEventListener('click', () => dom.settingsModal.classList.add('hidden'));

dom.btnCreateListModal.addEventListener('click', () => {
  dom.createListModal.classList.remove('hidden');
  refreshIcons();
});
dom.btnCloseCreateListModal.addEventListener('click', () => dom.createListModal.classList.add('hidden'));
dom.btnCancelCreateList.addEventListener('click', () => dom.createListModal.classList.add('hidden'));

dom.btnJoinListModal.addEventListener('click', () => {
  dom.joinListModal.classList.remove('hidden');
  refreshIcons();
});
dom.btnCloseJoinListModal.addEventListener('click', () => dom.joinListModal.classList.add('hidden'));
dom.btnCancelJoinList.addEventListener('click', () => dom.joinListModal.classList.add('hidden'));

// 分享彈窗
function openShareModal() {
  if (!currentList) return;
  dom.shareModalListId.value = currentList.id;
  dom.shareModalUrl.value = `${window.location.origin}${window.location.pathname}?join=${currentList.id}`;
  dom.shareModal.classList.remove('hidden');
  refreshIcons();
}

dom.btnShareCurrentList.addEventListener('click', openShareModal);
dom.btnShareListTop.addEventListener('click', openShareModal);
dom.btnCloseShareModal.addEventListener('click', () => dom.shareModal.classList.add('hidden'));

dom.btnCopyShareId.addEventListener('click', () => {
  navigator.clipboard.writeText(dom.shareModalListId.value);
  showToast("已複製清單 ID 到剪貼簿！", "success");
});

dom.quickCopyListId.addEventListener('click', () => {
  if (currentList) {
    navigator.clipboard.writeText(currentList.id);
    showToast("已複製清單 ID 到剪貼簿！", "success");
  }
});

dom.btnCopyShareUrl.addEventListener('click', () => {
  navigator.clipboard.writeText(dom.shareModalUrl.value);
  showToast("已複製直接加入連結！", "success");
});

dom.btnCloseEditTaskModal.addEventListener('click', () => dom.editTaskModal.classList.add('hidden'));
dom.btnCancelEditTask.addEventListener('click', () => dom.editTaskModal.classList.add('hidden'));

// 備註摺疊
dom.btnToggleNotes.addEventListener('click', () => {
  dom.notesContainer.classList.toggle('hidden');
});

// 過濾器切換
dom.filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.filterButtons.forEach(b => {
      b.classList.remove('active', 'bg-white', 'text-slate-900', 'shadow-xs');
      b.classList.add('text-slate-600');
    });
    btn.classList.add('active', 'bg-white', 'text-slate-900', 'shadow-xs');
    btn.classList.remove('text-slate-600');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

dom.selectPriorityFilter.addEventListener('change', (e) => {
  currentPriorityFilter = e.target.value;
  renderTasks();
});

dom.inputSearch.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  renderTasks();
});

// 登入按鈕繫結
dom.btnGoogleLogin.addEventListener('click', signInWithGoogle);
dom.btnHeroGoogleLogin.addEventListener('click', signInWithGoogle);
dom.btnSignOut.addEventListener('click', userSignOut);

// 示範模式切換
dom.btnToggleDemoMode.addEventListener('click', () => {
  isDemoMode = true;
  dom.configWarningBanner.classList.add('hidden');
  showToast("已啟動離線展示模式，所有操作在記憶體中模擬", "info");
  currentUser = {
    uid: 'demo-user-123',
    displayName: '體驗者 (Demo)',
    email: 'demo@example.com',
    photoURL: 'https://ui-avatars.com/api/?name=Demo&background=6366f1&color=fff'
  };
  handleAuthStateChanged(currentUser);
});

function loadDemoLists() {
  lists = [
    {
      id: 'demo-list-1',
      name: '🚀 產品 Sprint 協作衝刺 (展示)',
      description: '這是一個多人即時協作待辦清單示範',
      isCollaborative: true,
      createdBy: 'demo-user-123',
      collaborators: ['demo-user-123', 'demo-user-456'],
      collaboratorDetails: [
        { uid: 'demo-user-123', displayName: '體驗者 (Demo)', photoURL: 'https://ui-avatars.com/api/?name=Demo&background=6366f1&color=fff' },
        { uid: 'demo-user-456', displayName: '工程師 Bob', photoURL: 'https://ui-avatars.com/api/?name=Bob&background=10b981&color=fff' }
      ]
    }
  ];
  selectList(lists[0]);
}

function loadDemoTasks(listId) {
  tasks = [
    {
      id: 't-1',
      title: '在 Firebase 控制台設定專案 project-971217462532',
      notes: '啟用 Google 登入驗證與 Firestore 即時資料庫',
      priority: 'high',
      dueDate: new Date().toISOString().split('T')[0],
      completed: true,
      createdBy: { displayName: '工程師 Bob' },
      completedBy: { displayName: '體驗者 (Demo)' }
    },
    {
      id: 't-2',
      title: '測試 Google 帳號多人同步打勾與新增任務',
      notes: '只要有清單 ID，任何登入成員都可以即時協作',
      priority: 'medium',
      dueDate: '',
      completed: false,
      createdBy: { displayName: '體驗者 (Demo)' }
    }
  ];
  renderTasks();
  updateStats();
}

// 點擊彈窗外部關閉
window.addEventListener('click', (e) => {
  if (e.target === dom.settingsModal) dom.settingsModal.classList.add('hidden');
  if (e.target === dom.createListModal) dom.createListModal.classList.add('hidden');
  if (e.target === dom.joinListModal) dom.joinListModal.classList.add('hidden');
  if (e.target === dom.shareModal) dom.shareModal.classList.add('hidden');
  if (e.target === dom.editTaskModal) dom.editTaskModal.classList.add('hidden');
});

// ================= 應用程式入口 =================
window.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  initFirebaseApp();
});
