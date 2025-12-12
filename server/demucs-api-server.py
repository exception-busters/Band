"""
간단한 DEMUCS API 서버
FastAPI를 사용하여 음원 분리 기능 제공
"""

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import shutil
from pathlib import Path
import subprocess
import json

app = FastAPI(title="DEMUCS API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "DEMUCS API Server", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/separate")
async def separate_audio(
    audio: UploadFile = File(...),
    model: str = Form("htdemucs"),
    shifts: int = Form(1),
    split: bool = Form(True)
):
    """
    음원 분리 API

    Parameters:
    - audio: 업로드할 오디오 파일
    - model: 사용할 모델 (htdemucs, htdemucs_ft, htdemucs_6s)
    - shifts: Random shifts (기본값: 1)
    - split: Split audio (기본값: True)
    """

    # 임시 디렉토리 생성
    with tempfile.TemporaryDirectory() as temp_dir:
        # 입력 파일 저장
        input_path = os.path.join(temp_dir, audio.filename)
        with open(input_path, "wb") as f:
            shutil.copyfileobj(audio.file, f)

        # 출력 디렉토리
        output_dir = os.path.join(temp_dir, "separated")

        # demucs 실행
        cmd = [
            "python", "-m", "demucs.separate",
            "-n", model,
            "-o", output_dir,
            "--two-stems", "vocals",  # vocals와 no_vocals로 분리
            input_path
        ]

        if split:
            cmd.append("--split")

        if shifts > 1:
            cmd.extend(["--shifts", str(shifts)])

        try:
            # demucs 실행
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10분 타임아웃
            )

            if result.returncode != 0:
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "Separation failed",
                        "details": result.stderr
                    }
                )

            # 출력 파일 찾기
            song_name = Path(audio.filename).stem
            separated_path = os.path.join(output_dir, model, song_name)

            # 파일 목록
            stems = {}
            if os.path.exists(separated_path):
                for file in os.listdir(separated_path):
                    if file.endswith(".wav"):
                        stem_name = file.replace(".wav", "")
                        file_path = os.path.join(separated_path, file)

                        # 파일 읽기 및 base64 인코딩 (실제로는 파일 URL 반환)
                        # 여기서는 파일이 있다는 정보만 반환
                        stems[stem_name] = f"/files/{song_name}/{file}"

            return {
                "success": True,
                "stems": stems,
                "model": model,
                "song_name": song_name
            }

        except subprocess.TimeoutExpired:
            return JSONResponse(
                status_code=500,
                content={"error": "Separation timeout (>10 minutes)"}
            )
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": str(e)}
            )

@app.get("/docs")
async def custom_docs():
    return {
        "endpoints": {
            "/": "API 상태",
            "/health": "헬스 체크",
            "/api/separate": "음원 분리 (POST)",
        },
        "usage": {
            "method": "POST",
            "url": "/api/separate",
            "body": {
                "audio": "오디오 파일 (multipart/form-data)",
                "model": "htdemucs (선택)",
                "shifts": "1 (선택)",
                "split": "true (선택)"
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
