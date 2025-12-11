import { create } from 'zustand';
import type { Friend, Message, TrustLevel } from '../types';

// Function to generate fresh mock data
const createMockFriends = (): Friend[] => [
  {
    id: '1',
    publicKey: 'mock-pubkey-alice-xxxxxxxxxxxxxxxxxxxxx',
    name: 'Alice',
    avatar: 'https://i.pravatar.cc/100?img=5',
    lastMessage: '今天天氣真好',
    lastMessageTime: Date.now() - 300000,
    unreadCount: 2,
    online: true,
    trustLevel: 'verified',
    addedAt: Date.now() - 86400000 * 7,
  },
  {
    id: '2',
    publicKey: 'mock-pubkey-bob-xxxxxxxxxxxxxxxxxxxxxxx',
    name: 'Bob',
    avatar: '👨',
    lastMessage: '晚上要不要吃飯？',
    lastMessageTime: Date.now() - 600000,
    unreadCount: 0,
    online: true,
    trustLevel: 'verified',
    addedAt: Date.now() - 86400000 * 5,
  },
  {
    id: '3',
    publicKey: 'mock-pubkey-carol-xxxxxxxxxxxxxxxxxxxxx',
    name: 'Carol',
    avatar: '👩‍💼',
    lastMessage: '好的，收到了',
    lastMessageTime: Date.now() - 3600000,
    unreadCount: 0,
    online: false,
    trustLevel: 'unverified',
    addedAt: Date.now() - 86400000 * 3,
  },
  {
    id: '4',
    publicKey: 'mock-pubkey-dave-xxxxxxxxxxxxxxxxxxxxxxx',
    name: 'Dave',
    avatar: '🧑‍💻',
    lastMessage: '專案進度如何？',
    lastMessageTime: Date.now() - 7200000,
    unreadCount: 1,
    online: false,
    trustLevel: 'unverified',
    addedAt: Date.now() - 86400000,
  },
];

const createMockMessages = (): Record<string, Message[]> => ({
  '1': [
    { id: 'm1', senderId: '1', content: '嗨！最近好嗎？', timestamp: Date.now() - 400000, type: 'text', isRead: true, isBurned: false },
    { id: 'm2', senderId: 'me', content: '不錯啊，你呢？', timestamp: Date.now() - 350000, type: 'text', isRead: true, isBurned: false },
    { id: 'm3', senderId: '1', content: '今天天氣真好', timestamp: Date.now() - 300000, type: 'text', isRead: false, isBurned: false },
    { id: 'm4', senderId: '1', content: '要不要出去走走？', timestamp: Date.now() - 280000, type: 'text', isRead: false, isBurned: false },
  ],
  '2': [
    { id: 'm5', senderId: 'me', content: '今天有空嗎？', timestamp: Date.now() - 700000, type: 'text', isRead: true, isBurned: false },
    { id: 'm6', senderId: '2', content: '有啊，怎麼了？', timestamp: Date.now() - 650000, type: 'text', isRead: true, isBurned: false },
    { id: 'm7', senderId: '2', content: '晚上要不要吃飯？', timestamp: Date.now() - 600000, type: 'text', isRead: true, isBurned: false },
  ],
  '3': [
    { id: 'm8', senderId: 'me', content: 'https://picsum.photos/400/300', timestamp: Date.now() - 3800000, type: 'image', isRead: true, isBurned: false },
    { id: 'm9', senderId: 'me', content: '文件收到了嗎？', timestamp: Date.now() - 3700000, type: 'text', isRead: true, isBurned: false },
    { id: 'm10', senderId: '3', content: '好的，收到了', timestamp: Date.now() - 3600000, type: 'text', isRead: true, isBurned: false },
  ],
  '4': [
    { id: 'm11', senderId: '4', content: '專案進度如何？', timestamp: Date.now() - 7200000, type: 'text', isRead: false, isBurned: false, ttl: 10 },
  ],
});

interface ChatState {
  friends: Friend[];
  currentFriendId: string | null;
  messages: Record<string, Message[]>;
  isDisguiseMode: boolean;

  // Actions
  selectFriend: (friendId: string) => void;
  clearSelection: () => void;
  sendMessage: (content: string) => void;
  burnMessage: (messageId: string) => void;
  toggleDisguise: () => void;
  markAsRead: (friendId: string) => void;
  resetAll: () => void;

  // 新增好友操作
  addFriend: (publicKey: string, name: string, trustLevel: TrustLevel, avatar?: string) => void;
  updateFriendTrust: (friendId: string, trustLevel: TrustLevel) => void;
  removeFriend: (friendId: string) => void;
  getFriendByPublicKey: (publicKey: string) => Friend | undefined;

  // 訊息操作
  receiveMessage: (friendId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  friends: createMockFriends(),
  currentFriendId: null,
  messages: createMockMessages(),
  isDisguiseMode: true,

  selectFriend: (friendId) => {
    set({ currentFriendId: friendId });
    get().markAsRead(friendId);
  },

  clearSelection: () => set({ currentFriendId: null }),

  sendMessage: (content) => {
    const { currentFriendId, messages } = get();
    if (!currentFriendId) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
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
      friends: get().friends.map(f =>
        f.id === currentFriendId
          ? { ...f, lastMessage: content, lastMessageTime: Date.now() }
          : f
      ),
    });
  },

  burnMessage: (messageId) => {
    const { currentFriendId, messages } = get();
    if (!currentFriendId) return;

    set({
      messages: {
        ...messages,
        [currentFriendId]: messages[currentFriendId].map(m =>
          m.id === messageId ? { ...m, isBurned: true } : m
        ),
      },
    });
  },

  toggleDisguise: () => set(state => ({ isDisguiseMode: !state.isDisguiseMode })),

  markAsRead: (friendId) => {
    set({
      friends: get().friends.map(f =>
        f.id === friendId ? { ...f, unreadCount: 0 } : f
      ),
      messages: {
        ...get().messages,
        [friendId]: (get().messages[friendId] || []).map(m => ({ ...m, isRead: true })),
      },
    });
  },

  // Reset all data to initial state
  resetAll: () => {
    set({
      friends: createMockFriends(),
      messages: createMockMessages(),
      currentFriendId: null,
    });
  },

  // 新增好友
  addFriend: (publicKey, name, trustLevel, avatar?) => {
    const { friends } = get();

    // 檢查是否已存在
    if (friends.some((f) => f.publicKey === publicKey)) {
      console.log('[chatStore] Friend already exists:', publicKey.slice(0, 16));
      return;
    }

    // 預設頭像：機器人用特殊頭像，其他用隨機頭像
    const defaultAvatar = name?.includes('Bot')
      ? 'https://i.pravatar.cc/100?img=47'
      : `https://i.pravatar.cc/100?u=${publicKey.slice(0, 8)}`;

    const newFriend: Friend = {
      id: `friend-${Date.now()}`,
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
  },

  // 更新好友信任等級
  updateFriendTrust: (friendId, trustLevel) => {
    set({
      friends: get().friends.map((f) =>
        f.id === friendId
          ? { ...f, trustLevel, avatar: trustLevel === 'verified' ? '🟢' : '🟡' }
          : f
      ),
    });
  },

  // 移除好友
  removeFriend: (friendId) => {
    const { messages } = get();
    const newMessages = { ...messages };
    delete newMessages[friendId];

    set({
      friends: get().friends.filter((f) => f.id !== friendId),
      messages: newMessages,
      currentFriendId:
        get().currentFriendId === friendId ? null : get().currentFriendId,
    });
  },

  // 根據公鑰查找好友
  getFriendByPublicKey: (publicKey) => {
    return get().friends.find((f) => f.publicKey === publicKey);
  },

  // 接收訊息
  receiveMessage: (friendId, message) => {
    const { messages, friends, currentFriendId } = get();
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
              lastMessage: message.content,
              lastMessageTime: message.timestamp,
              unreadCount:
                currentFriendId === friendId ? 0 : f.unreadCount + 1,
            }
          : f
      ),
    });
  },
}));
