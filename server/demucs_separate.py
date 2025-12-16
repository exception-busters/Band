"""
Demucs 2단계 음원 분리 스크립트

1단계: htdemucs_ft (4-stem) → vocals, drums, bass, other (고품질)
2단계: htdemucs_6s (6-stem) → other에서 piano, guitar, other 추출

최종 출력: vocals, drums, bass, piano, guitar, other (6개 스템)

파라미터:
- shifts: 랜덤 시프트 횟수 (기본값: 1, CPU에서는 1 권장)
- overlap: 세그먼트 겹침 비율 (기본값: 0.1, CPU에서는 낮게)
"""
import sys
import os
import json
import argparse

def main():
    parser = argparse.ArgumentParser(description='Demucs 2단계 음원 분리')
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
    import numpy as np
    import soundfile as sf
    from pathlib import Path

    # soundfile 백엔드로 강제 설정
    try:
        torchaudio.set_audio_backend("soundfile")
    except:
        pass

    # demucs import
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    # GPU 상세 진단
    print(f"\n[DEMUCS] ========== GPU 진단 ==========", file=sys.stderr)
    print(f"[DEMUCS] CUDA available: {torch.cuda.is_available()}", file=sys.stderr)
    print(f"[DEMUCS] CUDA version: {torch.version.cuda if torch.cuda.is_available() else 'N/A'}", file=sys.stderr)
    print(f"[DEMUCS] PyTorch version: {torch.__version__}", file=sys.stderr)

    if torch.cuda.is_available():
        print(f"[DEMUCS] GPU count: {torch.cuda.device_count()}", file=sys.stderr)
        print(f"[DEMUCS] GPU name: {torch.cuda.get_device_name(0)}", file=sys.stderr)
        print(f"[DEMUCS] GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB", file=sys.stderr)
        device = 'cuda'
    else:
        print(f"[DEMUCS] WARNING: CUDA not available, using CPU (very slow!)", file=sys.stderr)
        print(f"[DEMUCS] To use GPU, install: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118", file=sys.stderr)
        device = 'cpu'

    print(f"[DEMUCS] ===================================\n", file=sys.stderr)

    print(f"[DEMUCS] 2단계 음원 분리 시작: {input_file}", file=sys.stderr)
    print(f"[DEMUCS] 출력 디렉토리: {output_dir}", file=sys.stderr)
    print(f"[DEMUCS] 파라미터 - shifts: {shifts}, overlap: {overlap}, segment: {segment}", file=sys.stderr)
    print(f"[DEMUCS] Device: {device}", file=sys.stderr)

    # ========== 1단계: 4-stem 분리 (htdemucs_ft) ==========
    print(f"\n[DEMUCS] === 1단계: 4-stem 분리 (htdemucs_ft) ===", file=sys.stderr)

    try:
        model_4stem = get_model('htdemucs_ft')
        model_4stem.to(device)
        print(f"[DEMUCS] 4-stem 모델 로드 완료", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 4-stem 모델 로드 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 오디오 파일 로드
    try:
        audio_data, sample_rate = sf.read(input_file, dtype='float32')

        if audio_data.ndim == 1:
            audio_data = np.stack([audio_data, audio_data])
        else:
            audio_data = audio_data.T

        wav = torch.from_numpy(audio_data).to(device)

        if sample_rate != model_4stem.samplerate:
            print(f"[DEMUCS] 리샘플링: {sample_rate}Hz -> {model_4stem.samplerate}Hz", file=sys.stderr)
            import torchaudio.transforms as T
            resampler = T.Resample(sample_rate, model_4stem.samplerate).to(device)
            wav = resampler(wav)

        print(f"[DEMUCS] 오디오 로드 완료. Shape: {wav.shape}", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 오디오 로드 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 1단계 분리 실행
    try:
        wav_batch = wav.unsqueeze(0)

        with torch.no_grad():
            sources_4stem = apply_model(
                model_4stem,
                wav_batch,
                device=device,
                shifts=shifts,
                overlap=overlap,
                segment=segment,
                progress=True
            )[0]

        print(f"[DEMUCS] 1단계 완료: {model_4stem.sources}", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 1단계 분리 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 1단계 결과에서 other 트랙 추출
    stem_names_4stem = model_4stem.sources  # ['drums', 'bass', 'other', 'vocals']
    other_idx = stem_names_4stem.index('other')
    other_audio = sources_4stem[other_idx]  # (channels, samples)

    # ========== 2단계: other에서 piano, guitar, other 분리 (htdemucs_6s) ==========
    print(f"\n[DEMUCS] === 2단계: other에서 piano/guitar 분리 (htdemucs_6s) ===", file=sys.stderr)

    try:
        model_6stem = get_model('htdemucs_6s')
        model_6stem.to(device)
        print(f"[DEMUCS] 6-stem 모델 로드 완료", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 6-stem 모델 로드 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 2단계 분리 실행 (other 트랙에서)
    try:
        other_batch = other_audio.unsqueeze(0)

        with torch.no_grad():
            sources_6stem = apply_model(
                model_6stem,
                other_batch,
                device=device,
                shifts=shifts,
                overlap=overlap,
                segment=segment,
                progress=True
            )[0]

        print(f"[DEMUCS] 2단계 완료: {model_6stem.sources}", file=sys.stderr)
    except Exception as e:
        print(f"[DEMUCS] 2단계 분리 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # ========== 결과 저장 ==========
    print(f"\n[DEMUCS] === 결과 저장 ===", file=sys.stderr)

    try:
        base_name = Path(input_file).stem
        output_path = Path(output_dir) / 'htdemucs_2stage' / base_name
        output_path.mkdir(parents=True, exist_ok=True)

        results = {}
        samplerate = model_4stem.samplerate

        # 1단계 결과 저장 (vocals, drums, bass)
        for i, name in enumerate(stem_names_4stem):
            if name == 'other':
                continue  # other는 2단계 결과 사용

            stem_path = output_path / f'{name}.wav'
            stem_audio = sources_4stem[i].cpu().numpy()

            if stem_audio.ndim > 1:
                stem_audio = stem_audio.T

            sf.write(str(stem_path), stem_audio, samplerate)
            results[name] = str(stem_path)
            print(f"[DEMUCS] {name} 저장: {stem_path}", file=sys.stderr)

        # 2단계 결과 저장 (piano, guitar, other)
        stem_names_6stem = model_6stem.sources  # ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano']

        for target_stem in ['piano', 'guitar', 'other']:
            if target_stem in stem_names_6stem:
                idx = stem_names_6stem.index(target_stem)
                stem_path = output_path / f'{target_stem}.wav'
                stem_audio = sources_6stem[idx].cpu().numpy()

                if stem_audio.ndim > 1:
                    stem_audio = stem_audio.T

                sf.write(str(stem_path), stem_audio, samplerate)
                results[target_stem] = str(stem_path)
                print(f"[DEMUCS] {target_stem} 저장: {stem_path}", file=sys.stderr)

        # 결과를 JSON으로 출력
        print(json.dumps(results))
        print(f"\n[DEMUCS] 완료! 총 {len(results)}개 스템 분리됨", file=sys.stderr)

    except Exception as e:
        print(f"[DEMUCS] 파일 저장 실패: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
