import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const PORT = Number(process.env.PORT || 8080);

type Client = { id: string; roomId?: string; ws: import('ws').WebSocket };

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map<string, Set<string>>(); // roomId -> clientIds
const clients = new Map<string, Client>(); // clientId -> client

function send(ws: import('ws').WebSocket, data: any) {
	if (ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

// 같은 방의 다른 피어들에게 브로드캐스트
function broadcastToRoom(roomId: string, senderId: string, data: any) {
	const room = rooms.get(roomId);
	if (!room) return;
	for (const peerId of room) {
		if (peerId === senderId) continue;
		const peer = clients.get(peerId);
		if (peer) send(peer.ws, { ...data, from: senderId });
	}
}

wss.on('connection', (ws) => {
	const id = uuidv4();
	const client: Client = { id, ws };
	clients.set(id, client);
	console.log(`[CONNECT] Client ${id.slice(0, 8)} connected. Total clients: ${clients.size}`);
	send(ws, { type: 'welcome', clientId: id });

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());

			if (msg.type === 'join' && typeof msg.roomId === 'string') {
				client.roomId = msg.roomId;
				if (!rooms.has(msg.roomId)) rooms.set(msg.roomId, new Set());
				rooms.get(msg.roomId)!.add(id);

				const peerIds = Array.from(rooms.get(msg.roomId)!);
				console.log(`[JOIN] Client ${id.slice(0, 8)} joined room ${msg.roomId.slice(0, 8)}. Room size: ${peerIds.length}`);

				for (const peerId of peerIds) {
					const peer = clients.get(peerId);
					if (!peer || peer.ws === ws) continue;
					send(peer.ws, { type: 'peer-joined', peerId: id });
				}
				send(ws, { type: 'peers', peerIds: peerIds.filter((pid) => pid !== id) });
				return;
			}

			if (['offer', 'answer', 'ice-candidate'].includes(msg.type) && typeof msg.to === 'string') {
				const to = clients.get(msg.to);
				if (to) {
					console.log(`[RTC] ${msg.type} from ${id.slice(0, 8)} to ${msg.to.slice(0, 8)}`);
					send(to.ws, { ...msg, from: id });
				}
				return;
			}

			// 채팅 메시지 브로드캐스트
			if (msg.type === 'chat' && client.roomId) {
				console.log(`[CHAT] from ${id.slice(0, 8)} in room ${client.roomId.slice(0, 8)}`);
				broadcastToRoom(client.roomId, id, msg);
				return;
			}

			// 악기 정보 브로드캐스트
			if (msg.type === 'instrument' && client.roomId) {
				console.log(`[INSTRUMENT] ${id.slice(0, 8)} set instrument: ${msg.instrument}`);
				broadcastToRoom(client.roomId, id, msg);
				return;
			}
		} catch (err) {
			console.error('[ERROR] Failed to parse message:', err);
		}
	});

	ws.on('close', () => {
		console.log(`[DISCONNECT] Client ${id.slice(0, 8)} disconnected. Total clients: ${clients.size - 1}`);
		clients.delete(id);
		if (client.roomId && rooms.has(client.roomId)) {
			const set = rooms.get(client.roomId)!;
			set.delete(id);
			console.log(`[LEAVE] Client ${id.slice(0, 8)} left room. Room size: ${set.size}`);
			for (const peerId of set) {
				const peer = clients.get(peerId);
				if (peer) send(peer.ws, { type: 'peer-left', peerId: id });
			}
			if (set.size === 0) rooms.delete(client.roomId);
		}
	});
});

console.log(`WS signaling server listening on ws://localhost:${PORT}`);
