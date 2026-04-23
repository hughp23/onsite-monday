import * as signalR from '@microsoft/signalr';
import Constants from 'expo-constants';
import { auth } from '@/lib/firebase';
import { Message } from '@/constants/types';

function hubUrl(): string {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (__DEV__
      ? `http://${(Constants.expoConfig?.hostUri ?? 'localhost:8081').split(':')[0]}:5236/api`
      : 'https://api.onsitemonday.co.uk/api');
  // Strip trailing /api — the hub is at /hubs/chat, not /api/hubs/chat
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return `${baseUrl}/hubs/chat`;
}

// Backend sends MessageDto with sentAt; map to our Message type
interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isRead: boolean;
  sentAt: string;
}

function toMessage(m: ApiMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    timestamp: m.sentAt,
    isRead: m.isRead,
  };
}

type MessageHandler = (message: Message) => void;

let connection: signalR.HubConnection | null = null;
const handlers = new Set<MessageHandler>();

function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl(), {
        accessTokenFactory: async () => {
          const token = await auth.currentUser?.getIdToken();
          return token ?? '';
        },
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveMessage', (raw: ApiMessage) => {
      const msg = toMessage(raw);
      handlers.forEach(h => h(msg));
    });
  }
  return connection;
}

export const signalRService = {
  async start(): Promise<void> {
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
  },

  async stop(): Promise<void> {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.stop();
    }
  },

  async joinConversation(conversationId: string): Promise<void> {
    await getConnection().invoke('JoinConversation', conversationId);
  },

  async leaveConversation(conversationId: string): Promise<void> {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke('LeaveConversation', conversationId);
    }
  },

  onReceiveMessage(handler: MessageHandler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
};
