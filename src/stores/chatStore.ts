import { create } from 'zustand';
import type { Friend, Message } from '../types';

// Function to generate fresh mock data
const createMockFriends = (): Friend[] => [
  {
    id: '1',
    name: 'Alice',
    avatar: 'https://i.pravatar.cc/100?img=5',
    lastMessage: '今天天氣真好',
    lastMessageTime: Date.now() - 300000,
    unreadCount: 2,
    online: true,
  },
  {
    id: '2',
    name: 'Bob',
    avatar: '👨',
    lastMessage: '晚上要不要吃飯？',
    lastMessageTime: Date.now() - 600000,
    unreadCount: 0,
    online: true,
  },
  {
    id: '3',
    name: 'Carol',
    avatar: '👩‍💼',
    lastMessage: '好的，收到了',
    lastMessageTime: Date.now() - 3600000,
    unreadCount: 0,
    online: false,
  },
  {
    id: '4',
    name: 'Dave',
    avatar: '🧑‍💻',
    lastMessage: '專案進度如何？',
    lastMessageTime: Date.now() - 7200000,
    unreadCount: 1,
    online: false,
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
}));
