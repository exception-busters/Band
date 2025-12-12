# 빠른 설치 가이드

## 자동 설치 (권장)

### Windows
```bash
setup.bat
```

### Mac/Linux
```bash
chmod +x setup.sh
./setup.sh
```

---

## 수동 설치

### 1. Python 패키지 설치
```bash
pip install demucs torch torchaudio soundfile torchcodec
```

### 2. 서버 패키지 설치
```bash
cd server
npm install
```

### 3. 클라이언트 패키지 설치
```bash
cd client
npm install
```

---

## 실행

### 터미널 1 - 서버
```bash
cd server
npm run dev
```

### 터미널 2 - 클라이언트
```bash
cd client
npm run dev
```

### 브라우저
```
http://localhost:5173
```

---

## 문제 해결

### 필수 패키지 누락 시
모든 Python 패키지를 설치했는지 확인하세요:
```bash
pip list | grep demucs
pip list | grep torch
pip list | grep soundfile
pip list | grep torchcodec
```

하나라도 없으면:
```bash
pip install demucs torch torchaudio soundfile torchcodec
```

### 음원 분리 실패 시
```bash
# 패키지 재설치
pip uninstall demucs torch torchaudio soundfile torchcodec -y
pip install demucs torch torchaudio soundfile torchcodec
```

---

자세한 내용은 [README.md](README.md)를 참조하세요.
