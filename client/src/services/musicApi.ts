/**
 * 음악 파일 업로드 및 관리 API 서비스
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEMUCS_API_URL = import.meta.env.VITE_DEMUCS_API_URL || 'http://localhost:8000'

export interface UploadResponse {
  success: boolean
  fileType?: 'xml' | 'midi'
  fileName?: string
  originalName?: string
  filePath?: string
  message?: string
  converted?: boolean
  error?: string
}

/**
 * 악보 파일 업로드
 * @param file - MusicXML, MIDI, 또는 MP3 파일
 * @returns 업로드 결과
 */
export async function uploadMusicFile(file: File): Promise<UploadResponse> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/music/upload-score`, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Upload failed: ${response.status}`)
    }

    return data
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 서버에서 파일 다운로드
 * @param fileName - 파일명
 * @returns Blob 데이터
 */
export async function downloadMusicFile(fileName: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/music/file/${fileName}`)

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`)
  }

  return response.blob()
}

/**
 * 서버에서 파일 URL 가져오기
 * @param fileName - 파일명
 * @returns 파일 URL
 */
export function getMusicFileUrl(fileName: string): string {
  return `${API_BASE_URL}/uploads/${fileName}`
}

/**
 * 서버에서 파일 삭제
 * @param fileName - 파일명
 */
export async function deleteMusicFile(fileName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/music/file/${fileName}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error(`Delete failed: ${response.status}`)
  }
}

/**
 * 음원 분리 관련 타입
 * 4-stem 모델 (htdemucs_ft): vocals, drums, bass, other
 */
export interface SeparatedStems {
  vocals?: string
  drums?: string
  bass?: string
  other?: string  // piano, guitar 등이 포함됨
}

export interface SeparationResponse {
  success: boolean
  stems?: SeparatedStems
  availableStems?: string[]
  originalFile?: string
  message?: string
  error?: string
}

/**
 * 음원 분리 옵션
 */
export interface SeparationOptions {
  /**
   * 랜덤 시프트 횟수 (높을수록 정확도↑ 처리시간↑)
   * - 1: 빠름 (정확도 낮음)
   * - 2: 균형 (기본값, 권장)
   * - 5: 정확도 우선 (처리시간 약 5배)
   */
  shifts?: number
  /**
   * 세그먼트 겹침 비율 (0~1, 높을수록 부드러운 결과)
   * - 0.1: 속도 우선
   * - 0.25: 균형 (기본값)
   * - 0.5: 정확도 우선
   */
  overlap?: number
}

/**
 * MP3 파일을 세션별로 분리 (Demucs API 사용)
 * @param file - MP3 파일
 * @param options - 분리 옵션 (shifts, overlap)
 * @returns 분리된 스템 정보
 */
export async function separateAudioStems(
  file: File,
  options?: SeparationOptions
): Promise<SeparationResponse> {
  try {
    const formData = new FormData()
    formData.append('audio', file)  // Demucs 서버는 'audio' 필드 사용
    formData.append('model', 'htdemucs_ft')  // 4-stem 고품질 모델 사용

    // 정확도 향상 파라미터 (서버 기본값: shifts=5, overlap=0.5)
    if (options?.shifts !== undefined) {
      formData.append('shifts', String(options.shifts))
    }
    if (options?.overlap !== undefined) {
      formData.append('overlap', String(options.overlap))
    }

    const response = await fetch(`${DEMUCS_API_URL}/api/separate`, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Separation failed: ${response.status}`)
    }

    // Demucs 서버 응답을 클라이언트 형식으로 변환
    return {
      success: data.success,
      stems: data.stems,
      availableStems: data.stems ? Object.keys(data.stems) : [],
      message: `Separated using ${data.model}`
    }
  } catch (error) {
    console.error('Separation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
