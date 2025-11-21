export type RoomStatus = 'open' | 'recording' | 'locked'

export type Room = {
  id: string
  title: string
  genre: string
  vibe: string
  bpm: number
  capacity: number
  musicians: number
  latencyMs: number
  region: string
  status: RoomStatus
}

export type SessionEvent = {
  time: string
  title: string
  description: string
}

export type SessionProfile = {
  instruments: string[]
  schedule: SessionEvent[]
}

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'neo-groove',
    title: 'Neo Groove Club',
    genre: 'Neo Soul',
    vibe: '따뜻한 전자피아노와 퍼커션이 어우러진 서울 저녁세션',
    bpm: 92,
    capacity: 6,
    musicians: 4,
    latencyMs: 18,
    region: 'Seoul',
    status: 'open',
  },
  {
    id: 'sunset-funk',
    title: 'Sunset Funk Bus',
    genre: 'City Funk',
    vibe: '도쿄 프루티 라운지, 베이스와 일렉트릭 키 중심',
    bpm: 108,
    capacity: 5,
    musicians: 3,
    latencyMs: 24,
    region: 'Tokyo',
    status: 'recording',
  },
  {
    id: 'nautica',
    title: 'Nautica Lab',
    genre: 'Ambient',
    vibe: '로스앤젤레스 레트로 신스페이즈',
    bpm: 76,
    capacity: 4,
    musicians: 2,
    latencyMs: 32,
    region: 'LA',
    status: 'open',
  },
  {
    id: 'midnight-brass',
    title: 'Midnight Brass Room',
    genre: 'Fusion',
    vibe: '서울-부산 리모트 브라스 섹션 전용',
    bpm: 122,
    capacity: 8,
    musicians: 6,
    latencyMs: 21,
    region: 'Busan',
    status: 'locked',
  },
]

export const ROOM_PROFILES: Record<string, SessionProfile> = {
  'neo-groove': {
    instruments: ['Vocal Booth', 'Analog Keys', 'Perc Pad', 'Bass DI'],
    schedule: [
      { time: '21:00', title: '라인 체크', description: '2채널 위상 매칭, 루프백 테스트' },
      { time: '21:10', title: '그루브 구축', description: 'EP + 베이스 리프 스케치' },
      { time: '21:25', title: '보컬 톱라인', description: '가이드 멜로디 공유 & 피드백' },
    ],
  },
  'sunset-funk': {
    instruments: ['TalkBox', 'J-Bass', 'Drum Pad', 'Keytar'],
    schedule: [
      { time: '20:30', title: '퍼커션 루프', description: 'SP-404 루프 싱크' },
      { time: '20:40', title: '훅 메이킹', description: '보컬 훅 아이디에이션' },
      { time: '21:00', title: '라이브 리허설', description: '3 take cap + 리뷰' },
    ],
  },
  nautica: {
    instruments: ['Modular Rack', 'Granular Pad', 'Field FX'],
    schedule: [
      { time: '18:00', title: '필드 레코딩', description: 'Pacifica 파도 소스 수집' },
      { time: '18:20', title: '드론 레이어', description: '모듈러 패치 합성' },
      { time: '18:45', title: '딥 믹스', description: '서브 · FX 밸런스' },
    ],
  },
  'midnight-brass': {
    instruments: ['Trumpet Section', 'Trombone', 'Sax Lead', 'Perc Loop'],
    schedule: [
      { time: '22:15', title: '섹션 튠업', description: '브라스 EQ, 위상 체크' },
      { time: '22:30', title: '메인 드롭', description: '후렴 킥오프' },
      { time: '22:45', title: '믹스 노트', description: '다음 take 피드백' },
    ],
  },
}

export type RoomFilter = {
  id: string
  label: string
  match?: (room: Room) => boolean
}

export const ROOM_FILTERS: RoomFilter[] = [
  { id: 'all', label: '전체' },
  { id: 'neo-soul', label: 'Neo Soul', match: (room) => room.genre === 'Neo Soul' },
  { id: 'city-funk', label: 'City Funk', match: (room) => room.genre === 'City Funk' },
  { id: 'ambient', label: 'Ambient', match: (room) => room.genre === 'Ambient' },
  { id: 'fusion', label: 'Fusion', match: (room) => room.genre === 'Fusion' },
]
