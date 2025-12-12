import { create } from 'zustand';
import type { Friend, Message, TrustLevel } from '../types';
import * as storage from '../services/storage';

// 用戶設定儲存 key
const USER_PROFILE_KEY = 'mist_user_profile';

interface UserProfile {
  displayName: string;
}

interface ChatState {
  friends: Friend[];
  currentFriendId: string | null;
  messages: Record<string, Message[]>;
  isDisguiseMode: boolean;
  isLoaded: boolean; // 是否已從本地載入
  userProfile: UserProfile;

  // Actions
  selectFriend: (friendId: string) => void;
  clearSelection: () => void;
  sendMessage: (content: string, myPublicKey: string) => void;
  burnMessage: (messageId: string) => void;
  toggleDisguise: () => void;
  markAsRead: (friendId: string) => void;
  resetAll: () => void;
  loadFromStorage: () => void;

  // 用戶設定
  setDisplayName: (name: string) => void;

  // 新增好友操作
  addFriend: (publicKey: string, name: string, trustLevel: TrustLevel, avatar?: string) => void;
  updateFriendTrust: (friendId: string, trustLevel: TrustLevel) => void;
  removeFriend: (friendId: string) => void;
  getFriendByPublicKey: (publicKey: string) => Friend | undefined;

  // 訊息操作
  receiveMessage: (friendId: string, message: Message) => void;
}

// 從 localStorage 載入用戶設定
function loadUserProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(USER_PROFILE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('[chatStore] Failed to load user profile:', e);
  }
  return { displayName: '' };
}

// 保存用戶設定到 localStorage
function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('[chatStore] Failed to save user profile:', e);
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  friends: [],
  currentFriendId: null,
  messages: {},
  isDisguiseMode: true,
  isLoaded: false,
  userProfile: loadUserProfile(),

  // 設定用戶名稱
  setDisplayName: (name: string) => {
    const newProfile = { ...get().userProfile, displayName: name };
    saveUserProfile(newProfile);
    set({ userProfile: newProfile });
    console.log('[chatStore] Display name updated:', name);
  },

  // 從本地儲存載入資料
  loadFromStorage: () => {
    if (!storage.isInitialized()) {
      console.log('[chatStore] Storage not initialized yet');
      return;
    }

    try {
      // 載入聯絡人
      const contacts = storage.getAllContacts();
      const friends: Friend[] = contacts.map((c) => ({
        id: `friend-${c.pubkey.slice(0, 16)}`,
        publicKey: c.pubkey,
        name: c.nickname,
        avatar: c.avatar || `https://i.pravatar.cc/100?u=${c.pubkey.slice(0, 8)}`,
        lastMessage: '',
        lastMessageTime: c.addedAt,
        unreadCount: 0,
        online: false,
        trustLevel: c.trustLevel,
        addedAt: c.addedAt,
      }));

      // 載入每個好友的訊息
      const messages: Record<string, Message[]> = {};
      for (const friend of friends) {
        const storedMessages = storage.getMessages(friend.publicKey, 100);
        messages[friend.id] = storedMessages.map((m) => ({
          id: m.id,
          senderId: m.isOutgoing ? 'me' : friend.id,
          content: m.content,
          timestamp: m.createdAt,
          type: m.type,
          isRead: m.readAt !== null,
          isBurned: false,
          ttl: m.ttl || undefined,
          encrypted: true,
        }));

        // 更新最後訊息
        if (storedMessages.length > 0) {
          const lastMsg = storedMessages[storedMessages.length - 1];
          const friendIndex = friends.findIndex((f) => f.id === friend.id);
          if (friendIndex >= 0) {
            friends[friendIndex].lastMessage = lastMsg.content.slice(0, 50);
            friends[friendIndex].lastMessageTime = lastMsg.createdAt;
          }
        }
      }

      set({ friends, messages, isLoaded: true });
      console.log(`[chatStore] Loaded ${friends.length} friends from storage`);
    } catch (err) {
      console.error('[chatStore] Failed to load from storage:', err);
      set({ isLoaded: true });
    }
  },

  selectFriend: (friendId) => {
    set({ currentFriendId: friendId });
    get().markAsRead(friendId);
  },

  clearSelection: () => set({ currentFriendId: null }),

  sendMessage: (content, myPublicKey) => {
    const { currentFriendId, messages, friends } = get();
    if (!currentFriendId) return;

    const friend = friends.find((f) => f.id === currentFriendId);
    if (!friend) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      senderId: 'me',
      content,
      timestamp: Date.now(),
      type: 'text',
      isRead: true,
      isBurned: false,
    };

    const currentMessages = messages[currentFriendId] || [];
    set({
      messages: {
        ...messages,
        [currentFriendId]: [...currentMessages, newMessage],
      },
    });

    set({
      friends: get().friends.map((f) =>
        f.id === currentFriendId
          ? { ...f, lastMessage: content.slice(0, 50), lastMessageTime: Date.now() }
          : f
      ),
    });

    // 保存到本地儲存
    if (storage.isInitialized()) {
      const conversationId = storage.getConversationIdForPeer(friend.publicKey);
      storage.saveMessage({
        id: newMessage.id,
        conversationId,
        senderPubkey: myPublicKey,
        content,
        type: 'text',
        createdAt: newMessage.timestamp,
        ttl: 0,
        expiresAt: null,
        readAt: Date.now(),
        isOutgoing: true,
        status: 'sent',
      });
    }
  },

  burnMessage: (messageId) => {
    const { currentFriendId, messages } = get();
    if (!currentFriendId) return;

    set({
      messages: {
        ...messages,
        [currentFriendId]: messages[currentFriendId].map((m) =>
          m.id === messageId ? { ...m, isBurned: true } : m
        ),
      },
    });

    // 從本地儲存刪除
    if (storage.isInitialized()) {
      storage.deleteMessage(messageId);
    }
  },

  toggleDisguise: () => set((state) => ({ isDisguiseMode: !state.isDisguiseMode })),

  markAsRead: (friendId) => {
    const { messages, friends } = get();
    const friendMessages = messages[friendId] || [];

    set({
      friends: friends.map((f) =>
        f.id === friendId ? { ...f, unreadCount: 0 } : f
      ),
      messages: {
        ...messages,
        [friendId]: friendMessages.map((m) => ({ ...m, isRead: true })),
      },
    });

    // 標記本地儲存中的訊息為已讀
    if (storage.isInitialized()) {
      friendMessages.forEach((m) => {
        if (!m.isRead) {
          storage.markMessageAsRead(m.id);
        }
      });
    }
  },

  resetAll: () => {
    set({
      friends: [],
      messages: {},
      currentFriendId: null,
      isLoaded: false,
    });

    // 清除本地儲存
    if (storage.isInitialized()) {
      storage.clearAllData();
    }
  },

  // 新增好友
  addFriend: (publicKey, name, trustLevel, avatar?) => {
    const { friends } = get();

    // 檢查是否已存在
    if (friends.some((f) => f.publicKey === publicKey)) {
      console.log('[chatStore] Friend already exists:', publicKey.slice(0, 16));
      return;
    }

    const defaultAvatar = `https://i.pravatar.cc/100?u=${publicKey.slice(0, 8)}`;
    const friendId = `friend-${publicKey.slice(0, 16)}`;

    const newFriend: Friend = {
      id: friendId,
      publicKey,
      name: name || `好友 ${publicKey.slice(0, 8)}...`,
      avatar: avatar || defaultAvatar,
      lastMessage: '',
      lastMessageTime: Date.now(),
      unreadCount: 0,
      online: true,
      trustLevel,
      addedAt: Date.now(),
    };

    set({ friends: [...friends, newFriend] });
    console.log('[chatStore] Friend added:', newFriend.name, trustLevel);

    // 保存到本地儲存
    if (storage.isInitialized()) {
      storage.addContact({
        pubkey: publicKey,
        nickname: newFriend.name,
        avatar: newFriend.avatar,
        addedAt: newFriend.addedAt,
        trustLevel,
      });
    }
  },

  // 更新好友信任等級
  updateFriendTrust: (friendId, trustLevel) => {
    const friend = get().friends.find((f) => f.id === friendId);
    set({
      friends: get().friends.map((f) =>
        f.id === friendId ? { ...f, trustLevel } : f
      ),
    });

    // 更新本地儲存
    if (storage.isInitialized() && friend) {
      storage.addContact({
        pubkey: friend.publicKey,
        nickname: friend.name,
        avatar: friend.avatar,
        addedAt: friend.addedAt,
        trustLevel,
      });
    }
  },

  // 移除好友
  removeFriend: (friendId) => {
    const { messages, friends } = get();
    const friend = friends.find((f) => f.id === friendId);
    const newMessages = { ...messages };
    delete newMessages[friendId];

    set({
      friends: friends.filter((f) => f.id !== friendId),
      messages: newMessages,
      currentFriendId:
        get().currentFriendId === friendId ? null : get().currentFriendId,
    });

    // 從本地儲存刪除
    if (storage.isInitialized() && friend) {
      storage.removeContact(friend.publicKey);
    }
  },

  // 根據公鑰查找好友
  getFriendByPublicKey: (publicKey) => {
    return get().friends.find((f) => f.publicKey === publicKey);
  },

  // 接收訊息
  receiveMessage: (friendId, message) => {
    const { messages, friends, currentFriendId } = get();
    const friend = friends.find((f) => f.id === friendId);
    const currentMessages = messages[friendId] || [];

    // 更新訊息列表
    set({
      messages: {
        ...messages,
        [friendId]: [...currentMessages, message],
      },
    });

    // 更新好友列表的最後訊息
    set({
      friends: friends.map((f) =>
        f.id === friendId
          ? {
              ...f,
              lastMessage: message.content.slice(0, 50),
              lastMessageTime: message.timestamp,
              unreadCount:
                currentFriendId === friendId ? 0 : f.unreadCount + 1,
            }
          : f
      ),
    });

    // 保存到本地儲存
    if (storage.isInitialized() && friend) {
      const conversationId = storage.getConversationIdForPeer(friend.publicKey);
      const ttl = message.ttl || 0;
      storage.saveMessage({
        id: message.id,
        conversationId,
        senderPubkey: friend.publicKey,
        content: message.content,
        type: message.type,
        createdAt: message.timestamp,
        ttl,
        expiresAt: ttl > 0 ? message.timestamp + ttl * 1000 : null,
        readAt: currentFriendId === friendId ? Date.now() : null,
        isOutgoing: false,
        status: 'delivered',
      });
    }
  },
}));
