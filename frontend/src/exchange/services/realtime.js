// shuffle: sockets go through the gateway (`/ws/sports/socket.io`); in dev the Vite proxy forwards `/ws`.
import { API_BASE } from './client';

export const SOCKET_BASE = API_BASE;
