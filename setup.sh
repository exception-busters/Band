#!/bin/bash

echo "===================================="
echo "Band 프로젝트 자동 설치 스크립트"
echo "===================================="
echo ""

# Python 확인
echo "[1/5] Python 설치 확인 중..."
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "[ERROR] Python이 설치되지 않았습니다."
        echo "https://www.python.org/downloads/ 에서 다운로드해주세요."
        exit 1
    fi
    PYTHON_CMD=python
else
    PYTHON_CMD=python3
fi
echo "[OK] Python 설치됨"
echo ""

# pip 확인
echo "pip 확인 중..."
if ! command -v pip3 &> /dev/null; then
    if ! command -v pip &> /dev/null; then
        echo "[ERROR] pip이 설치되지 않았습니다."
        exit 1
    fi
    PIP_CMD=pip
else
    PIP_CMD=pip3
fi
echo "[OK] pip 설치됨"
echo ""

# Node.js 확인
echo "[2/5] Node.js 설치 확인 중..."
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js가 설치되지 않았습니다."
    echo "https://nodejs.org/ 에서 다운로드해주세요."
    exit 1
fi
echo "[OK] Node.js 설치됨"
echo ""

# Python 패키지 설치
echo "[3/5] Python 패키지 설치 중..."
echo "시간이 걸릴 수 있습니다 (5-10분)..."
$PIP_CMD install demucs torch torchaudio soundfile torchcodec
if [ $? -ne 0 ]; then
    echo "[ERROR] Python 패키지 설치 실패"
    echo "수동으로 설치해주세요: $PIP_CMD install demucs torch torchaudio soundfile torchcodec"
    exit 1
fi
echo "[OK] Python 패키지 설치 완료"
echo ""

# 서버 패키지 설치
echo "[4/5] 서버 패키지 설치 중..."
cd server
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] 서버 패키지 설치 실패"
    exit 1
fi
cd ..
echo "[OK] 서버 패키지 설치 완료"
echo ""

# 클라이언트 패키지 설치
echo "[5/5] 클라이언트 패키지 설치 중..."
cd client
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] 클라이언트 패키지 설치 실패"
    exit 1
fi
cd ..
echo "[OK] 클라이언트 패키지 설치 완료"
echo ""

echo "===================================="
echo "설치 완료!"
echo "===================================="
echo ""
echo "실행 방법:"
echo "1. 터미널 1: cd server && npm run dev"
echo "2. 터미널 2: cd client && npm run dev"
echo "3. 브라우저: http://localhost:5173"
echo ""
