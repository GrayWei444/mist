// Mist Demo Types

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  online: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
  isRead: boolean;
  isBurned: boolean;
  ttl?: number; // Time to live in seconds
}

export interface ChatRoom {
  friendId: string;
  messages: Message[];
}
