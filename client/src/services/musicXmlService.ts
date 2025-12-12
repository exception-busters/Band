import { MusicScore, MusicNote, Measure, InstrumentType } from '../types/music';

export class MusicXMLService {
  private static instance: MusicXMLService;

  private constructor() {}

  /**
   * 디버깅용 - XML 파일 직접 테스트
   */
  public async testXMLFile(xmlContent: string): Promise<Document> {
    console.log('Testing XML file with DOMParser...');
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    
    // 파싱 오류 확인
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      throw new Error(`XML 파싱 오류: ${parserError.textContent}`);
    }
    
    console.log('XML parsed successfully');
    console.log('Root element:', xmlDoc.documentElement.tagName);
    console.log('Child elements:', Array.from(xmlDoc.documentElement.children).map(el => el.tagName));
    
    return xmlDoc;
  }

  public static getInstance(): MusicXMLService {
    if (!MusicXMLService.instance) {
      MusicXMLService.instance = new MusicXMLService();
    }
    return MusicXMLService.instance;
  }

  /**
   * XML 파일을 읽어서 MusicScore 객체로 변환
   */
  public async parseXMLFile(file: File): Promise<MusicScore> {
    try {
      console.log('Starting XML file parsing for:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      const xmlContent = await this.readFileAsText(file);
      console.log('XML content read successfully, length:', xmlContent.length);
      console.log('XML content preview:', xmlContent.substring(0, 200) + '...');
      
      return await this.parseXMLString(xmlContent);
    } catch (error) {
      console.error('XML file parsing error details:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof Error) {
        throw new Error(`XML 파일 처리 실패 (${file.name}): ${error.message}`);
      }
      throw new Error(`XML 파일을 읽는 중 알 수 없는 오류가 발생했습니다 (${file.name})`);
    }
  }

  /**
   * XML 문자열을 MusicScore 객체로 변환
   */
  public async parseXMLString(xmlContent: string): Promise<MusicScore> {
    console.log('Starting XML string parsing with DOMParser...');
    
    try {
      // 브라우저 네이티브 DOMParser 사용
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
      
      // 파싱 오류 확인
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        console.error('XML parsing error:', parserError.textContent);
        throw new Error(`XML 파싱 오류: ${parserError.textContent}`);
      }

      console.log('XML parsing successful, converting to MusicScore...');
      
      const musicScore = this.convertDOMToMusicScore(xmlDoc);
      console.log('MusicScore conversion successful:', {
        title: musicScore.title,
        tempo: musicScore.tempo,
        measureCount: musicScore.measures.length,
        instruments: musicScore.instruments
      });
      
      return musicScore;
    } catch (error) {
      console.error('Music score conversion error details:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        xmlPreview: xmlContent.substring(0, 500)
      });
      
      if (error instanceof Error) {
        throw new Error(`악보 데이터 변환 오류: ${error.message}`);
      } else {
        throw new Error('악보 데이터 변환 중 알 수 없는 오류가 발생했습니다.');
      }
    }
  }

  /**
   * 파일을 텍스트로 읽기
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('Reading file as text:', file.name);
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('FileReader onload event triggered');
        if (e.target?.result) {
          const content = e.target.result as string;
          console.log('File read successfully, content length:', content.length);
          resolve(content);
        } else {
          console.error('FileReader result is empty or null');
          reject(new Error('파일 내용을 읽을 수 없습니다. 파일이 비어있거나 손상되었을 수 있습니다.'));
        }
      };
      
      reader.onerror = (e) => {
        console.error('FileReader error event:', e, reader.error);
        reject(new Error(`파일 읽기 중 오류가 발생했습니다: ${reader.error?.message || 'Unknown error'}`));
      };
      
      reader.onabort = () => {
        console.error('FileReader abort event');
        reject(new Error('파일 읽기가 중단되었습니다.'));
      };
      
      try {
        reader.readAsText(file, 'UTF-8');
        console.log('FileReader.readAsText() called');
      } catch (error) {
        console.error('Error calling FileReader.readAsText():', error);
        reject(new Error(`파일 읽기 시작 실패: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * DOM Document를 MusicScore 형식으로 변환
   */
  private convertDOMToMusicScore(xmlDoc: Document): MusicScore {
    console.log('Converting DOM to MusicScore...');
    
    const scorePartwise = xmlDoc.querySelector('score-partwise');
    if (!scorePartwise) {
      console.error('No score-partwise element found in XML');
      throw new Error('올바른 MusicXML 형식이 아닙니다. score-partwise 요소를 찾을 수 없습니다.');
    }

    console.log('Found score-partwise element');

    // 기본 정보 추출
    console.log('Extracting basic info...');
    const workElement = scorePartwise.querySelector('work work-title');
    const title = workElement?.textContent?.trim() || 'Untitled';
    console.log('Extracted title:', title);
    
    const partElements = scorePartwise.querySelectorAll('part');
    console.log('Found parts:', partElements.length);
    
    if (partElements.length === 0) {
      throw new Error('MusicXML 파일에 악기 파트가 없습니다.');
    }

    // 템포 정보 (기본값 120 BPM)
    let tempo = 120;
    
    // 첫 번째 파트에서 템포 정보 찾기
    const firstPart = partElements[0];
    const metronomeElement = firstPart.querySelector('measure direction direction-type metronome per-minute');
    if (metronomeElement?.textContent) {
      tempo = parseInt(metronomeElement.textContent.trim(), 10) || 120;
    }
    console.log('Extracted tempo:', tempo);

    const measures: Measure[] = [];
    const instruments: InstrumentType[] = [InstrumentType.PIANO]; // 기본 악기

    // 단일 공통 파트(P1) 처리 - 첫 번째 파트만 사용
    console.log('Processing single common part (P1)...');
    const commonPart = partElements[0]; // 항상 첫 번째 파트만 사용
    console.log('Processing P1 (common part)');
    
    const measureElements = commonPart.querySelectorAll('measure');
    console.log(`P1 has ${measureElements.length} measures`);
    
    // 전역 divisions 값 찾기 (첫 번째 마디에서)
    let globalDivisions = 4;
    const firstMeasure = measureElements[0];
    if (firstMeasure) {
      const divisionsElement = firstMeasure.querySelector('attributes divisions');
      if (divisionsElement?.textContent) {
        globalDivisions = parseInt(divisionsElement.textContent.trim(), 10) || 4;
      }
    }
    console.log(`Global divisions for P1: ${globalDivisions}`);
    
    // 전역 시간 추적 변수
    let globalTime = 0;
    
    measureElements.forEach((measureElement, measureIndex) => {
      console.log(`Processing measure ${measureIndex + 1}, globalTime: ${globalTime}`);
      
      let measureNumber;
      try {
        measureNumber = parseInt(measureElement.getAttribute('number') || (measureIndex + 1).toString(), 10);
        console.log(`Measure number: ${measureNumber}`);
      } catch (error) {
        console.error(`Error parsing measure number for measure ${measureIndex + 1}:`, error);
        measureNumber = measureIndex + 1;
      }

      // 박자표 정보 추출
      let timeSignature = '4/4'; // 기본값
      let beatsPerMeasure = 4; // 한 마디당 박자 수
      
      try {
        const timeElement = measureElement.querySelector('attributes time');
        if (timeElement) {
          const beatsElement = timeElement.querySelector('beats');
          const beatTypeElement = timeElement.querySelector('beat-type');
          const beats = beatsElement?.textContent?.trim() || '4';
          const beatType = beatTypeElement?.textContent?.trim() || '4';
          timeSignature = `${beats}/${beatType}`;
          beatsPerMeasure = parseInt(beats, 10);
          console.log(`Set time signature: ${timeSignature}, beats per measure: ${beatsPerMeasure}`);
        }
      } catch (error) {
        console.error(`Error extracting time signature for measure ${measureNumber}:`, error);
      }

      // 새 마디 생성 (단일 파트이므로 병합 불필요)
      const measure: Measure = {
        number: measureNumber,
        timeSignature: timeSignature,
        notes: []
      };

      // 음표 정보 추출 (전역 시간 전달)
      try {
        const notes = this.extractNotesFromDOMMeasure(measureElement, measureNumber, globalDivisions, globalTime);
        measure.notes = notes;
        
        // 마디 길이를 박자표 기준으로 계산 (정확한 박자 유지)
        globalTime += beatsPerMeasure;
        console.log(`Measure ${measureNumber} completed, added ${beatsPerMeasure} beats, new globalTime: ${globalTime}`);
        
        measures.push(measure);
        console.log(`Added ${notes.length} notes to measure ${measureNumber}`);
      } catch (error) {
        console.error(`Error extracting notes for measure ${measureNumber}:`, error);
        throw new Error(`마디 ${measureNumber}의 음표 처리 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // 마디를 번호순으로 정렬
    measures.sort((a, b) => a.number - b.number);

    return {
      title,
      tempo,
      measures,
      instruments
    };
  }

  /**
   * 파싱된 XML 데이터를 MusicScore 형식으로 변환 (레거시)
   */
  private convertToMusicScore(xmlData: any): MusicScore {
    console.log('Converting XML data to MusicScore...');
    console.log('XML data keys:', Object.keys(xmlData));
    console.log('Full parsed XML data:', JSON.stringify(xmlData, null, 2));
    
    const scorePartwise = xmlData['score-partwise'] || xmlData.scorePartwise;
    if (!scorePartwise) {
      console.error('No score-partwise found. Available keys:', Object.keys(xmlData));
      console.error('Full xmlData:', xmlData);
      throw new Error(`올바른 MusicXML 형식이 아닙니다. score-partwise 요소를 찾을 수 없습니다. 사용 가능한 키: ${Object.keys(xmlData).join(', ')}`);
    }

    console.log('Found score-partwise:', scorePartwise);
    console.log('score-partwise keys:', Object.keys(scorePartwise));

    // 기본 정보 추출
    console.log('Extracting basic info...');
    console.log('work data:', scorePartwise.work);
    
    const title = scorePartwise.work?.['work-title'] || scorePartwise.work?.workTitle || 'Untitled';
    console.log('Extracted title:', title);
    
    const parts = scorePartwise.part ? (Array.isArray(scorePartwise.part) ? scorePartwise.part : [scorePartwise.part]) : [];
    console.log('Found parts:', parts.length);
    
    if (parts.length === 0) {
      throw new Error('MusicXML 파일에 악기 파트가 없습니다.');
    }
    
    // 템포 정보 (기본값 120 BPM)
    let tempo = 120;
    
    // 첫 번째 파트에서 템포 정보 찾기
    if (parts[0]?.measure) {
      const firstMeasure = Array.isArray(parts[0].measure) ? parts[0].measure[0] : parts[0].measure;
      if (firstMeasure?.direction?.['direction-type']?.metronome) {
        const metronome = firstMeasure.direction['direction-type'].metronome;
        if (metronome['per-minute']) {
          tempo = parseInt(metronome['per-minute'], 10) || 120;
        }
      }
    }

    const measures: Measure[] = [];
    const instruments: InstrumentType[] = [InstrumentType.PIANO]; // 기본 악기

    // 각 파트 처리
    console.log('Processing parts...');
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      console.log(`Processing part ${partIndex + 1}:`, part);
      
      if (!part.measure) {
        console.warn(`Part ${partIndex + 1} has no measures, skipping`);
        continue;
      }

      const partMeasures = Array.isArray(part.measure) ? part.measure : [part.measure];
      console.log(`Part ${partIndex + 1} has ${partMeasures.length} measures`);
      
      for (let i = 0; i < partMeasures.length; i++) {
        const xmlMeasure = partMeasures[i];
        console.log(`Processing measure ${i + 1}:`, xmlMeasure);
        
        let measureNumber;
        try {
          measureNumber = parseInt(xmlMeasure.number || xmlMeasure.$.number || (i + 1).toString(), 10);
          console.log(`Measure number: ${measureNumber}`);
        } catch (error) {
          console.error(`Error parsing measure number for measure ${i + 1}:`, error);
          measureNumber = i + 1;
        }

        // 기존 마디가 있으면 병합, 없으면 새로 생성
        let measure = measures.find(m => m.number === measureNumber);
        if (!measure) {
          measure = {
            number: measureNumber,
            timeSignature: '4/4', // 기본값
            notes: []
          };
          measures.push(measure);
          console.log(`Created new measure ${measureNumber}`);
        }

        // 박자표 정보 추출
        try {
          if (xmlMeasure.attributes?.time) {
            const time = xmlMeasure.attributes.time;
            const beats = time.beats || '4';
            const beatType = time['beat-type'] || '4';
            measure.timeSignature = `${beats}/${beatType}`;
            console.log(`Set time signature: ${measure.timeSignature}`);
          }
        } catch (error) {
          console.error(`Error extracting time signature for measure ${measureNumber}:`, error);
        }

        // 음표 정보 추출
        try {
          const notes = this.extractNotesFromMeasure(xmlMeasure, measureNumber);
          measure.notes.push(...notes);
          console.log(`Added ${notes.length} notes to measure ${measureNumber}`);
        } catch (error) {
          console.error(`Error extracting notes for measure ${measureNumber}:`, error);
          throw new Error(`마디 ${measureNumber}의 음표 처리 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // 마디를 번호순으로 정렬
    measures.sort((a, b) => a.number - b.number);

    return {
      title,
      tempo,
      measures,
      instruments
    };
  }

  /**
   * DOM 마디에서 음표 정보 추출
   */
  private extractNotesFromDOMMeasure(measureElement: Element, measureNumber: number, globalDivisions: number = 4, globalStartTime: number = 0): MusicNote[] {
    const notes: MusicNote[] = [];
    
    const noteElements = measureElement.querySelectorAll('note');
    if (noteElements.length === 0) {
      console.log(`Measure ${measureNumber} has no notes`);
      return notes;
    }

    console.log(`Extracting ${noteElements.length} notes from measure ${measureNumber}, globalStartTime: ${globalStartTime}`);

    // 마디 내에서의 상대적 시간 (0부터 시작)
    let measureTime = 0;

    // divisions 값 (한 박자를 나누는 단위) - 현재 마디에서 찾거나 전역값 사용
    const divisionsElement = measureElement.querySelector('attributes divisions');
    const divisions = divisionsElement ? parseInt(divisionsElement.textContent?.trim() || '4', 10) : globalDivisions;
    
    console.log(`Using divisions: ${divisions} for measure ${measureNumber}`);

    noteElements.forEach((noteElement, noteIndex) => {
      console.log(`Processing note ${noteIndex + 1} in measure ${measureNumber}`);
      
      // 쉼표 처리
      if (noteElement.querySelector('rest')) {
        const durationElement = noteElement.querySelector('duration');
        if (durationElement?.textContent) {
          const restDuration = parseFloat(durationElement.textContent) / divisions;
          measureTime += restDuration;
          console.log(`Skipped rest with duration ${restDuration}, measureTime: ${measureTime}`);
        }
        return;
      }

      // 음 높이 정보
      const pitchElement = noteElement.querySelector('pitch');
      if (!pitchElement) {
        console.log(`Note ${noteIndex + 1} has no pitch element`);
        return;
      }

      const pitch = this.extractPitchFromDOM(pitchElement);
      
      const durationElement = noteElement.querySelector('duration');
      const durationValue = durationElement?.textContent ? parseFloat(durationElement.textContent) : 4;
      const duration = durationValue / divisions; // 박자 단위로 변환
      const velocity = 64; // 기본 음량

      // 전역 시간 = 마디 시작 시간 + 마디 내 상대 시간
      const absoluteStartTime = globalStartTime + measureTime;

      const note: MusicNote = {
        pitch,
        duration,
        startTime: absoluteStartTime,
        velocity,
        instrument: InstrumentType.PIANO // 기본 악기
      };

      console.log(`Created note: ${pitch}, duration: ${duration}, startTime: ${absoluteStartTime} (global: ${globalStartTime} + measure: ${measureTime})`);
      notes.push(note);
      
      // 다음 음표를 위해 마디 내 시간 업데이트
      measureTime += duration;
    });

    return notes;
  }

  /**
   * 마디에서 음표 정보 추출 (레거시)
   */
  private extractNotesFromMeasure(xmlMeasure: any, _measureNumber: number): MusicNote[] {
    const notes: MusicNote[] = [];
    
    if (!xmlMeasure.note) return notes;

    const xmlNotes = Array.isArray(xmlMeasure.note) ? xmlMeasure.note : [xmlMeasure.note];
    let currentTime = 0;

    // divisions 값 (한 박자를 나누는 단위)
    const divisions = xmlMeasure.attributes?.divisions || 4;

    for (const xmlNote of xmlNotes) {
      // 쉼표는 건너뛰기
      if (xmlNote.rest) {
        if (xmlNote.duration) {
          currentTime += parseFloat(xmlNote.duration) / divisions;
        }
        continue;
      }

      // 음 높이 정보
      if (!xmlNote.pitch) continue;

      const pitch = this.extractPitch(xmlNote.pitch);
      const duration = xmlNote.duration ? parseFloat(xmlNote.duration) / divisions : 0.25;
      const velocity = 64; // 기본 음량

      const note: MusicNote = {
        pitch,
        duration,
        startTime: currentTime,
        velocity,
        instrument: InstrumentType.PIANO // 기본 악기
      };

      notes.push(note);
      currentTime += duration;
    }

    return notes;
  }

  /**
   * DOM pitch 요소를 문자열로 변환
   */
  private extractPitchFromDOM(pitchElement: Element): string {
    const stepElement = pitchElement.querySelector('step');
    const octaveElement = pitchElement.querySelector('octave');
    const alterElement = pitchElement.querySelector('alter');

    const step = stepElement?.textContent?.trim() || 'C';
    const octave = octaveElement?.textContent?.trim() || '4';
    const alter = alterElement?.textContent ? parseInt(alterElement.textContent.trim(), 10) : 0;

    let pitchString = step + octave;

    // 임시표 처리
    if (alter > 0) {
      pitchString = step + '#' + octave;
    } else if (alter < 0) {
      pitchString = step + 'b' + octave;
    }

    return pitchString;
  }

  /**
   * XML pitch 정보를 문자열로 변환 (레거시)
   */
  private extractPitch(pitchData: unknown): string {
    const pitch = pitchData as any;
    const step = pitch.step || 'C';
    const octave = pitch.octave || '4';
    const alter = pitch.alter ? parseInt(pitch.alter, 10) : 0;

    let pitchString = step + octave;

    // 임시표 처리
    if (alter > 0) {
      pitchString = step + '#' + octave;
    } else if (alter < 0) {
      pitchString = step + 'b' + octave;
    }

    return pitchString;
  }

  /**
   * MusicXML 파일인지 확인
   */
  public static isXMLFile(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.xml') || fileName.endsWith('.musicxml');
  }

  /**
   * 파일 내용이 MusicXML인지 확인
   */
  public static async isMusicXMLContent(file: File): Promise<boolean> {
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
        reader.readAsText(file, 'UTF-8');
      });

      // MusicXML의 특징적인 요소들 확인
      return content.includes('score-partwise') || 
             content.includes('score-timewise') ||
             content.includes('musicxml') ||
             content.includes('<!DOCTYPE score-partwise');
    } catch {
      return false;
    }
  }
}