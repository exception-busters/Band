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

wss.on('connection', (ws) => {
	const id = uuidv4();
	const client: Client = { id, ws };
	clients.set(id, client);
	send(ws, { type: 'welcome', clientId: id });

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());
			if (msg.type === 'join' && typeof msg.roomId === 'string') {
				client.roomId = msg.roomId;
				if (!rooms.has(msg.roomId)) rooms.set(msg.roomId, new Set());
				rooms.get(msg.roomId)!.add(id);

				const peerIds = Array.from(rooms.get(msg.roomId)!);
				for (const peerId of peerIds) {
					const peer = clients.get(peerId);
					if (!peer || peer.ws === ws) continue;
					send(peer.ws, { type: 'peer-joined', peerId: id });
				}
				send(ws, { type: 'peers', peerIds: peerIds.filter((pid) => pid !== id) });
				return;
			}

			if ([ 'offer', 'answer', 'ice-candidate' ].includes(msg.type) && typeof msg.to === 'string') {
				const to = clients.get(msg.to);
				if (to) send(to.ws, { ...msg, from: id });
				return;
			}
		} catch {}
	});

	ws.on('close', () => {
		clients.delete(id);
		if (client.roomId && rooms.has(client.roomId)) {
			const set = rooms.get(client.roomId)!;
			set.delete(id);
			for (const peerId of set) {
				const peer = clients.get(peerId);
				if (peer) send(peer.ws, { type: 'peer-left', peerId: id });
			}
			if (set.size === 0) rooms.delete(client.roomId);
		}
	});
});

console.log(`WS signaling server listening on ws://localhost:${PORT}`);
