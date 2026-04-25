import { io } from 'socket.io-client';

if (!process.env.NEXT_PUBLIC_API_URL) {
  console.error("NEXT_PUBLIC_API_URL is missing in environment variables.");
}

const URL = process.env.NEXT_PUBLIC_API_URL as string;

export const socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
