# Band - 음악 협업 플랫폼

## 프로젝트 설명
실시간 음악 협업 및 AI 기반 음원 분리 기능을 제공하는 웹 애플리케이션

## 주요 기능
- 🎵 음원 분리 (보컬, 드럼, 베이스, 피아노, 기타, 기타 악기)
- 🎤 실시간 음악 협업
- 📝 악보 변환 (MusicXML, MIDI)
- 🎹 가상 노래방

---

## 🚀 빠른 시작 가이드

### 필수 요구사항
- **Node.js** 16 이상
- **Python** 3.8 이상
- **npm** 또는 **yarn**
- 최소 8GB RAM (음원 분리 기능 사용 시)

---

## 📦 설치 방법

### 1단계: 프로젝트 클론
```bash
git clone <repository-url>
cd Band
```

### 2단계: Node.js 패키지 설치

#### 서버 설치
```bash
cd server
npm install
```

#### 클라이언트 설치
```bash
cd ../client
npm install
```

### 3단계: Python 환경 설정 (음원 분리 기능용)

#### Python 설치 확인
```bash
python --version
```

Python이 없다면 [Python 공식 사이트](https://www.python.org/downloads/)에서 다운로드

#### 필수 Python 패키지 설치
```bash
pip install demucs torch torchaudio soundfile torchcodec
```

**중요**: 모든 패키지를 설치해야 합니다!

설치 시간: 약 5-10분 (torch 패키지가 큽니다)

#### GPU 사용 (선택사항 - NVIDIA GPU만 해당)
```bash
pip install demucs torch torchaudio soundfile torchcodec --index-url https://download.pytorch.org/whl/cu118
```

---

## 🎮 실행 방법

### 개발 모드로 실행

**터미널 1 - 서버 실행:**
```bash
cd server
npm run dev
```
서버: http://localhost:3001

**터미널 2 - 클라이언트 실행:**
```bash
cd client
npm run dev
```
클라이언트: http://localhost:5173

### 브라우저에서 접속
```
http://localhost:5173
```

---

## 🎵 음원 분리 기능 사용 방법

### 1. 음원 분리 페이지 접속
- 메뉴에서 "음악재생 방" 또는 "노래방(데모)" 선택

### 2. MP3 파일 업로드
- "파일 선택" 버튼 클릭
- MP3 파일 선택 (최대 10MB 권장)
- "업로드 및 분리" 클릭

### 3. 분리 대기
- **CPU 모드**: 3분 곡 기준 5-10분 소요
- **GPU 모드**: 3분 곡 기준 30초-1분 소요

### 4. 결과 확인
분리된 6개 트랙:
- 🎤 보컬 (vocals)
- 🥁 드럼 (drums)
- 🎸 베이스 (bass)
- 🎹 피아노 (piano)
- 🎸 기타 (guitar)
- 🎼 기타 악기 (other)

### 5. 다운로드
- 개별 트랙 다운로드: 각 트랙 옆 ⬇️ 버튼 클릭
- 전체 다운로드: "📥 모든 트랙 다운로드" 버튼 클릭

---

## 🔧 문제 해결

### Python 패키지 설치 오류

#### 1. "python을 찾을 수 없습니다"
**해결책:**
- Python 설치 확인
- 설치 시 "Add Python to PATH" 체크했는지 확인
- 터미널/명령 프롬프트 재시작
- 시스템 재부팅

#### 2. "pip를 찾을 수 없습니다"
**해결책:**
```bash
python -m pip install demucs torch torchaudio soundfile torchcodec
```

#### 3. "ModuleNotFoundError: No module named 'torchcodec'"
**해결책:**
```bash
pip install torchcodec
```

#### 4. "FFmpeg is not installed" 에러
**해결책:**
이미 해결되어 있습니다. soundfile을 사용하므로 FFmpeg 불필요.
만약 계속 발생하면:
```bash
pip install soundfile
```

#### 5. "Could not load libtorchcodec" 에러
**해결책:**
```bash
pip uninstall torchcodec
pip install torchcodec
```

### 음원 분리 실패

#### 1. "demucs failed with code 1"
**원인**: Python 패키지가 제대로 설치되지 않음

**해결책:**
```bash
# 모든 패키지 재설치
pip uninstall demucs torch torchaudio soundfile torchcodec -y
pip install demucs torch torchaudio soundfile torchcodec
```

#### 2. 음원 분리가 멈춤
**원인**: 메모리 부족

**해결책:**
- 더 짧은 음원 사용
- 다른 프로그램 종료
- 최소 8GB RAM 필요

#### 3. 6-stem 모델 다운로드 실패
**원인**: 처음 실행 시 모델 자동 다운로드 (약 1-2GB)

**해결책:**
- 안정적인 인터넷 연결 확인
- 충분한 저장 공간 확인 (최소 3GB)
- 첫 실행 시 10-15분 대기

### 서버 실행 오류

#### 1. "Port 3001 already in use"
**해결책:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID번호>

# Mac/Linux
lsof -ti:3001 | xargs kill -9
```

#### 2. "Port 5173 already in use"
**해결책:**
```bash
# Windows
netstat -ano | findstr :5173
taskkill /F /PID <PID번호>

# Mac/Linux
lsof -ti:5173 | xargs kill -9
```

---

## 📋 패키지 목록

### Python 패키지 (필수)
```
demucs          # 음원 분리 AI 모델
torch           # PyTorch 딥러닝 프레임워크
torchaudio      # 오디오 처리
soundfile       # 오디오 파일 입출력
torchcodec      # 오디오 코덱
```

### Node.js 패키지
서버 및 클라이언트의 `package.json` 참조

---

## 🎯 성능 예상

| 환경 | 3분 음원 분리 시간 | 모델 로드 시간 |
|------|-------------------|---------------|
| CPU (i5/i7) | 8-12분 | 처음만 2-3분 |
| CPU (i7/i9 고성능) | 5-8분 | 처음만 2-3분 |
| M1/M2 Mac | 4-6분 | 처음만 1-2분 |
| NVIDIA RTX 3060 | 30-60초 | 처음만 1분 |
| NVIDIA RTX 4090 | 15-30초 | 처음만 30초 |

**참고**:
- 첫 실행 시 6-stem 모델 다운로드 (약 1-2GB)
- 모델 다운로드는 한 번만 수행됨
- 이후 실행부터는 빠름

---

## 📂 프로젝트 구조

```
Band/
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/    # UI 컴포넌트
│   │   ├── pages/         # 페이지
│   │   ├── services/      # API 서비스
│   │   └── styles/        # CSS 스타일
│   └── package.json
│
├── server/                 # Node.js 백엔드
│   ├── src/
│   │   ├── routes/        # API 라우트
│   │   └── services/      # 비즈니스 로직
│   ├── demucs_separate.py # 음원 분리 스크립트
│   └── package.json
│
└── README.md              # 이 파일
```

---

## 🔒 보안 주의사항

1. `.env` 파일은 절대 커밋하지 마세요
2. API 키가 필요한 경우 환경 변수로 관리
3. 업로드 파일 크기 제한 확인

---

## 🤝 기여 방법

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 라이선스

이 프로젝트의 라이선스 정보

---

## 💬 문의

문제가 발생하면 GitHub Issues에 등록해주세요!

---

## 🎉 추가 기능

- ✅ 6-stem 음원 분리 (보컬, 드럼, 베이스, 피아노, 기타, 기타 악기)
- ✅ 개별 트랙 다운로드
- ✅ 전체 트랙 일괄 다운로드
- ✅ 실시간 재생 및 믹싱
- ✅ 템포/피치 조절

---

**즐거운 음악 활동 되세요! 🎵**
