@echo off
echo ====================================
echo Band 프로젝트 자동 설치 스크립트
echo ====================================
echo.

REM Python 확인
echo [1/5] Python 설치 확인 중...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python이 설치되지 않았습니다.
    echo https://www.python.org/downloads/ 에서 다운로드해주세요.
    echo 설치 시 "Add Python to PATH"를 반드시 체크하세요!
    pause
    exit /b 1
)
echo [OK] Python 설치됨
echo.

REM Node.js 확인
echo [2/5] Node.js 설치 확인 중...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js가 설치되지 않았습니다.
    echo https://nodejs.org/ 에서 다운로드해주세요.
    pause
    exit /b 1
)
echo [OK] Node.js 설치됨
echo.

REM Python 패키지 설치
echo [3/5] Python 패키지 설치 중...
echo 시간이 걸릴 수 있습니다 (5-10분)...
pip install demucs torch torchaudio soundfile torchcodec
if %errorlevel% neq 0 (
    echo [ERROR] Python 패키지 설치 실패
    echo 수동으로 설치해주세요: pip install demucs torch torchaudio soundfile torchcodec
    pause
    exit /b 1
)
echo [OK] Python 패키지 설치 완료
echo.

REM 서버 패키지 설치
echo [4/5] 서버 패키지 설치 중...
cd server
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] 서버 패키지 설치 실패
    pause
    exit /b 1
)
cd ..
echo [OK] 서버 패키지 설치 완료
echo.

REM 클라이언트 패키지 설치
echo [5/5] 클라이언트 패키지 설치 중...
cd client
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] 클라이언트 패키지 설치 실패
    pause
    exit /b 1
)
cd ..
echo [OK] 클라이언트 패키지 설치 완료
echo.

echo ====================================
echo 설치 완료!
echo ====================================
echo.
echo 실행 방법:
echo 1. 터미널 1: cd server && npm run dev
echo 2. 터미널 2: cd client && npm run dev
echo 3. 브라우저: http://localhost:5173
echo.
pause
