import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const PORT = Number(process.env.PORT || 8080);

// 클라이언트 정보 (연주 상태 포함)
interface Client {
	id: string;
	ws: import('ws').WebSocket;
	roomId?: string;
	nickname: string;
	instrument?: string;
	isPerforming: boolean;
	isHost: boolean;
}

// 참여자 정보 (클라이언트에 전송용)
interface Participant {
	oderId: string;
	nickname: string;
	instrument?: string;
	isPerforming: boolean;
	isHost: boolean;
}

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map<string, Set<string>>(); // roomId -> clientIds
const clients = new Map<string, Client>(); // clientId -> client

function send(ws: import('ws').WebSocket, data: any) {
	if (ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

// 방의 모든 참여자 정보 가져오기
function getRoomParticipants(roomId: string): Participant[] {
	const room = rooms.get(roomId);
	if (!room) return [];

	const participants: Participant[] = [];
	for (const oderId of room) {
		const client = clients.get(oderId);
		if (client) {
			participants.push({
				oderId: client.id,
				nickname: client.nickname,
				instrument: client.instrument,
				isPerforming: client.isPerforming,
				isHost: client.isHost
			});
		}
	}
	return participants;
}

// 같은 방의 다른 피어들에게 브로드캐스트
function broadcastToRoom(roomId: string, senderId: string, data: any) {
	const room = rooms.get(roomId);
	if (!room) return;
	for (const oderId of room) {
		if (oderId === senderId) continue;
		const peer = clients.get(oderId);
		if (peer) send(peer.ws, { ...data, oderId: senderId });
	}
}

// 방의 모든 피어에게 브로드캐스트 (본인 포함)
function broadcastToRoomAll(roomId: string, data: any) {
	const room = rooms.get(roomId);
	if (!room) return;
	for (const oderId of room) {
		const peer = clients.get(oderId);
		if (peer) send(peer.ws, data);
	}
}

wss.on('connection', (ws) => {
	const id = uuidv4();
	const client: Client = {
		id,
		ws,
		nickname: `User${id.slice(0, 4)}`,
		isPerforming: false,
		isHost: false
	};
	clients.set(id, client);
	console.log(`[CONNECT] Client ${id.slice(0, 8)} connected. Total clients: ${clients.size}`);
	send(ws, { type: 'welcome', clientId: id });

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());

			// 방 입장
			if (msg.type === 'join' && typeof msg.roomId === 'string') {
				// 닉네임 설정
				if (msg.nickname) {
					client.nickname = msg.nickname;
				}
				// 방장 여부 설정
				if (msg.isHost === true) {
					client.isHost = true;
				}
				console.log(`[JOIN-DEBUG] Client ${id.slice(0, 8)} joining with isHost: ${msg.isHost} (type: ${typeof msg.isHost}), stored: ${client.isHost}`);

				client.roomId = msg.roomId;
				if (!rooms.has(msg.roomId)) rooms.set(msg.roomId, new Set());
				rooms.get(msg.roomId)!.add(id);

				const participants = getRoomParticipants(msg.roomId);
				console.log(`[JOIN] Client ${id.slice(0, 8)} (${client.nickname}) joined room ${msg.roomId.slice(0, 8)}. Room size: ${participants.length}${client.isHost ? ' [HOST]' : ''}`);

				// 기존 피어들에게 새 참여자 알림
				broadcastToRoom(msg.roomId, id, {
					type: 'participant-joined',
					participant: {
						oderId: id,
						nickname: client.nickname,
						instrument: client.instrument,
						isPerforming: client.isPerforming,
						isHost: client.isHost
					}
				});

				// 새 참여자에게 현재 방 상태 전송
				send(ws, {
					type: 'room-state',
					participants: participants.filter(p => p.oderId !== id),
					peerIds: participants.filter(p => p.oderId !== id).map(p => p.oderId)
				});
				return;
			}

			// 연주 시작
			if (msg.type === 'start-performing' && client.roomId) {
				client.isPerforming = true;
				client.instrument = msg.instrument;
				if (msg.nickname) client.nickname = msg.nickname;
				// isHost가 메시지에 포함되어 있으면 업데이트
				if (msg.isHost === true) {
					client.isHost = true;
				}

				console.log(`[START-PERFORMING] ${id.slice(0, 8)} (${client.nickname}) started performing: ${client.instrument}, isHost: ${client.isHost}`);

				// 방의 모든 피어에게 알림
				broadcastToRoom(client.roomId, id, {
					type: 'performer-updated',
					oderId: id,
					nickname: client.nickname,
					instrument: client.instrument,
					isPerforming: true,
					isHost: client.isHost
				});
				return;
			}

			// 연주 중단 (관람자로 전환)
			if (msg.type === 'stop-performing' && client.roomId) {
				client.isPerforming = false;
				client.instrument = undefined;

				console.log(`[STOP-PERFORMING] ${id.slice(0, 8)} (${client.nickname}) stopped performing`);

				// 방의 모든 피어에게 알림
				broadcastToRoom(client.roomId, id, {
					type: 'performer-updated',
					oderId: id,
					nickname: client.nickname,
					instrument: undefined,
					isPerforming: false
				});
				return;
			}

			// WebRTC 시그널링
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
				broadcastToRoom(client.roomId, id, { ...msg, nickname: client.nickname });
				return;
			}

			// 방 나가기 (명시적)
			if (msg.type === 'leave' && client.roomId) {
				const roomId = client.roomId;
				const set = rooms.get(roomId);
				if (set) {
					set.delete(id);
					console.log(`[LEAVE] Client ${id.slice(0, 8)} left room. Room size: ${set.size}`);

					// 방의 모든 피어에게 알림
					for (const oderId of set) {
						const peer = clients.get(oderId);
						if (peer) send(peer.ws, { type: 'participant-left', oderId: id });
					}

					if (set.size === 0) rooms.delete(roomId);
				}
				client.roomId = undefined;
				client.isPerforming = false;
				client.instrument = undefined;
				return;
			}
		} catch (err) {
			console.error('[ERROR] Failed to parse message:', err);
		}
	});

	ws.on('close', () => {
		console.log(`[DISCONNECT] Client ${id.slice(0, 8)} disconnected. Total clients: ${clients.size - 1}`);

		if (client.roomId && rooms.has(client.roomId)) {
			const roomId = client.roomId;
			const set = rooms.get(roomId)!;
			set.delete(id);
			console.log(`[LEAVE] Client ${id.slice(0, 8)} left room. Room size: ${set.size}`);

			// 방의 모든 피어에게 알림
			for (const oderId of set) {
				const peer = clients.get(oderId);
				if (peer) send(peer.ws, { type: 'participant-left', oderId: id });
			}

			if (set.size === 0) rooms.delete(roomId);
		}

		clients.delete(id);
	});
});

console.log(`WS signaling server listening on ws://localhost:${PORT}`);
