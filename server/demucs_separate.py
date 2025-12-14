"""
Demucs 음원 분리 스크립트 (soundfile 백엔드 강제 사용)

파라미터:
- shifts: 랜덤 시프트 횟수 (높을수록 정확도 ↑, 처리시간 ↑) 기본값: 2
- overlap: 세그먼트 겹침 비율 (0~1, 높을수록 부드러운 결과) 기본값: 0.25
"""
import sys
import os
import json
import argparse

def main():
    parser = argparse.ArgumentParser(description='Demucs 음원 분리')
    parser.add_argument('input_file', help='입력 오디오 파일 경로')
    parser.add_argument('output_dir', help='출력 디렉토리 경로')
    parser.add_argument('--shifts', type=int, default=1, help='랜덤 시프트 횟수 (기본값: 1, CPU에서는 1 권장)')
    parser.add_argument('--overlap', type=float, default=0.1, help='세그먼트 겹침 비율 (기본값: 0.1, CPU에서는 낮게)')
    parser.add_argument('--segment', type=float, default=None, help='세그먼트 길이(초), None이면 모델 기본값')

    args = parser.parse_args()

    input_file = args.input_file
    output_dir = args.output_dir
    shifts = args.shifts
    overlap = args.overlap
    segment = args.segment

    # 환경 변수 설정 - soundfile 백엔드 강제
    os.environ['TORCHAUDIO_BACKEND'] = 'soundfile'

    # 이제 torchaudio를 import하면 soundfile 백엔드를 사용
    import torch
    import torchaudio
    from pathlib import Path

    # soundfile 백엔드로 강제 설정
    try:
        torchaudio.set_audio_backend("soundfile")
    except:
        pass

    # demucs import
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    print(f"[DEMUCS] 음원 분리 시작: {input_file}", file=sys.stderr)
    print(f"[DEMUCS] 출력 디렉토리: {output_dir}", file=sys.stderr)
    print(f"[DEMUCS] 파라미터 - shifts: {shifts}, overlap: {overlap}, segment: {segment}", file=sys.stderr)

    # 모델 로드 (4-stem 모델 사용: vocals, drums, bass, other)
    # htdemucs_ft: Fine-tuned 버전, 품질이 더 높음
    try:
        model = get_model('htdemucs_ft')
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        model.to(device)
        print(f"[DEMUCS] 4-stem (htdemucs_ft) 모델 로드 완료. Device: {device}", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 모델 로드 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 오디오 파일 로드
    try:
        # soundfile로 직접 로드
        import soundfile as sf
        audio_data, sample_rate = sf.read(input_file, dtype='float32')

        # numpy array를 torch tensor로 변환
        import numpy as np
        if audio_data.ndim == 1:
            # 모노를 스테레오로
            audio_data = np.stack([audio_data, audio_data])
        else:
            # (samples, channels) -> (channels, samples)
            audio_data = audio_data.T

        wav = torch.from_numpy(audio_data).to(device)

        # 필요한 경우 리샘플링
        if sample_rate != model.samplerate:
            print(f"[DEMUCS] 리샘플링: {sample_rate}Hz -> {model.samplerate}Hz", file=sys.stderr)
            import torchaudio.transforms as T
            resampler = T.Resample(sample_rate, model.samplerate).to(device)
            wav = resampler(wav)

        print(f"[DEMUCS] 오디오 로드 완료. Shape: {wav.shape}", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 오디오 로드 실패: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 음원 분리 실행
    try:
        wav = wav.unsqueeze(0)  # 배치 차원 추가

        with torch.no_grad():
            # shifts: 여러 번 분리 후 평균 → 정확도 향상
            # overlap: 세그먼트 겹침 → 부드러운 결과
            sources = apply_model(
                model,
                wav,
                device=device,
                shifts=shifts,
                overlap=overlap,
                segment=segment,
                progress=True
            )[0]

        print(f"[DEMUCS] 음원 분리 완료", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 음원 분리 실패: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 결과 저장
    try:
        # 출력 디렉토리 생성
        base_name = Path(input_file).stem
        output_path = Path(output_dir) / 'htdemucs_ft' / base_name
        output_path.mkdir(parents=True, exist_ok=True)

        stem_names = model.sources  # 모델에 정의된 스템 이름 사용
        results = {}

        for i, name in enumerate(stem_names):
            stem_path = output_path / f'{name}.wav'
            stem_audio = sources[i].cpu().numpy()

            # (channels, samples) -> (samples, channels)
            if stem_audio.ndim > 1:
                stem_audio = stem_audio.T

            sf.write(str(stem_path), stem_audio, model.samplerate)
            results[name] = str(stem_path)
            print(f"[DEMUCS] {name} 저장: {stem_path}", file=sys.stderr)

        # 결과를 JSON으로 출력
        print(json.dumps(results))

    except Exception as e:
        print(f"[DEMUCS] 파일 저장 실패: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
