// ============================================
// 배차 요청 자동화 시스템 - 구글 폼 응답 처리
// ============================================

// 구글 시트 ID (실제 시트 ID로 변경 필요)
const SPREADSHEET_ID = "1_kxIY0brwvuoOUNSaWsSLJDQnT-XLdut46I8E5e9wEU"; 
// 특정 스프레드시트 사용
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// 트리거 설정 함수 - 설문지 응답 시트 변경 감지
function setupFormResponseTrigger() {
  try {
    Logger.log("=== 구글 폼 응답 트리거 설정 시작 ===");

    const spreadsheet = getSpreadsheet();

    // 기존 트리거 삭제
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("기존 트리거 삭제됨");
    });

    // 스프레드시트 편집 트리거 생성 (설문지 응답 시트 변경 감지)
    ScriptApp.newTrigger("onFormResponseEdit")
      .forSpreadsheet(spreadsheet)
      .onEdit()
      .create();

    // 구글 폼 제출 트리거도 추가 (더 안정적인 감지를 위해)
    ScriptApp.newTrigger("onFormSubmit")
      .forSpreadsheet(spreadsheet)
      .onFormSubmit()
      .create();

    Logger.log("새 구글 폼 응답 트리거 설정 완료!");
    Logger.log("대상 스프레드시트:", spreadsheet.getName());
  } catch (error) {
    Logger.log("트리거 설정 오류:", error);
  }
}

// 구글 폼 제출 이벤트 처리 함수
function onFormSubmit(e) {
  try {
    Logger.log("=== 구글 폼 제출 이벤트 감지 ===");

    if (!e || !e.range) {
      Logger.log("이벤트 정보 없음");
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();

    Logger.log("폼 제출된 시트:", sheetName);
    Logger.log("제출된 행:", row);

    // "설문지 응답" 시트의 새 응답 처리
    if (sheetName === "설문지 응답") {
      Logger.log("설문지 응답 감지, 처리 시작");
      processFormResponse(sheet, row);
    }
  } catch (error) {
    Logger.log("폼 제출 이벤트 처리 오류:", error);
  }
}

// 편집 이벤트 처리 함수 (백업용)
function onFormResponseEdit(e) {
  try {
    Logger.log("=== 편집 이벤트 감지 ===");

    if (!e || !e.range) {
      Logger.log("이벤트 정보 없음");
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    Logger.log("편집된 시트:", sheetName);
    Logger.log("편집된 범위:", e.range.getA1Notation());

    // "설문지 응답" 시트의 배차 요청 내용 편집만 처리
    if (sheetName === "설문지 응답") {
      const row = e.range.getRow();

      // 헤더 행은 제외
      if (row === 1) {
        Logger.log("헤더 행 편집, 무시");
        return;
      }

      Logger.log("배차 요청 내용 편집 감지, 행:", row);
      processFormResponse(sheet, row);
    }
  } catch (error) {
    Logger.log("편집 이벤트 처리 오류:", error);
  }
}

// 구글 폼 응답 처리 함수
function processFormResponse(sheet, row) {
  try {
    Logger.log("=== 구글 폼 응답 처리 시작 ===");
    const headerRow = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    Logger.log("헤더:", headerRow);
    const getColIndex = (name) =>
      headerRow.findIndex((h) => h && h.toString().trim() === name.trim());

    // 필요한 열 이름 지정
    const timestampIdx = getColIndex("타임스탬프");
    const contractNoIdx = getColIndex("운송계약번호");
    const contentIdx = getColIndex("배차 요청 내용");
    const statusIdx = getColIndex("처리상태");

    // 응답 데이터 가져오기 (전체 행)
    const lastColumn = sheet.getLastColumn();
    const rowData = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];

    Logger.log("응답 데이터:", rowData);

    // 각 열 데이터 추출
    const timestamp = timestampIdx > -1 ? rowData[timestampIdx] : "";
    const contractNo = contractNoIdx > -1 ? rowData[contractNoIdx] : "";
    const content = contentIdx > -1 ? rowData[contentIdx] : "";
    const status = statusIdx > -1 ? rowData[statusIdx] : "";

    Logger.log("계약번호:", contractNo);
    Logger.log("배차 요청 내용:", content);

    // 배차 요청 내용이 있는 경우만 처리
    if (!content || content.toString().trim() === "") {
      Logger.log("배차 요청 내용이 없어서 처리 중단");
      return;
    }

    // 처리상태 컬럼이 있으면 "처리중"으로 업데이트, 없으면 자동 추가
    if (statusIdx > -1) {
      sheet.getRange(row, statusIdx + 1).setValue("처리중");
    } else {
      // 처리상태 컬럼이 없으면 updateFormResponseStatus 함수가 자동으로 추가
      updateFormResponseStatus(sheet, row, "처리중");
    }

    // 파싱 및 처리
    processRawData(content.toString(), contractNo.toString(), timestamp, row, sheet);
  } catch (error) {
    Logger.log("구글 폼 응답 처리 오류:", error);

    // 오류 발생 시 처리상태 업데이트
    try {
      const headerRow = sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0];
      const getColIndex = (name) =>
        headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
      const statusIdx = getColIndex("처리상태");

      if (statusIdx > -1) {
        sheet.getRange(row, statusIdx + 1).setValue("처리오류");
      }
    } catch (updateError) {
      Logger.log("처리상태 업데이트 오류:", updateError);
    }
  }
}

// 키워드 기반 값 추출 함수 (개선: 다양한 형식 지원)
function extractValue(text, keywords) {
  if (!text) return "";

  const lines = text.split("\n");
  
  // 키워드를 길이순으로 정렬 (긴 키워드 우선)
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    for (let keyword of sortedKeywords) {
      // 키워드가 포함된 줄 찾기 (대소문자 구분 없이)
      const keywordLower = keyword.toLowerCase();
      const lineLower = line.toLowerCase();
      
      if (!lineLower.includes(keywordLower)) continue;
      
      // 키워드가 줄의 시작 부분에 있는지 또는 콜론(:) 앞에 있는지 확인
      // 더 정확한 매칭을 위해 키워드 앞뒤로 공백이나 콜론이 있는지 확인
      const keywordPattern = new RegExp("(^|\\s)" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]", "i");
      if (!keywordPattern.test(line)) {
        // 키워드가 줄 시작이나 콜론 앞에 없으면, 정확히 키워드가 포함되어 있는지 확인
        const exactMatch = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
        if (!exactMatch.test(line)) continue;
      }

      // 패턴 1: "키워드 : 값" 또는 "키워드: 값" 형식
      const colonPatterns = [
        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]\\s*(.+)", "i"),
        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]\\s*", "i"),
      ];

      for (let pattern of colonPatterns) {
        const match = line.match(pattern);
        if (match) {
          let value = match[1] || "";
          value = value.trim();
          
          // 값이 비어있으면 다음 줄 확인
          if (value === "") {
            if (i < lines.length - 1) {
              const nextLine = lines[i + 1].trim();
              // 다음 줄이 키워드가 아니고 콜론이 없으면 값으로 간주
              if (nextLine && !nextLine.match(/^[가-힣\s]*[:：]/) && !keywords.some(k => nextLine.toLowerCase().includes(k.toLowerCase()))) {
                value = nextLine;
              }
            }
          }
          
          if (value) return value;
        }
      }

      // 패턴 2: "출 :", "착 :" 같은 간단한 형식
      if (keyword.length <= 3 && line.match(new RegExp("^" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]\\s*(.+)", "i"))) {
        const match = line.match(new RegExp("^" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]\\s*(.+)", "i"));
        if (match && match[1]) {
          let value = match[1].trim();
          // 다음 줄도 확인
          if (!value && i < lines.length - 1) {
            value = lines[i + 1].trim();
          }
          if (value) return value;
        }
      }

      // 패턴 3: 콜론 없이 키워드 뒤에 값이 있는 경우
      const keywordIndex = lineLower.indexOf(keywordLower);
      if (keywordIndex > -1) {
        const afterKeyword = line.substring(keywordIndex + keyword.length).trim();
        // 콜론이 없고 값이 있으면 반환
        if (afterKeyword && !afterKeyword.startsWith(":")) {
          // 다음 키워드가 나오기 전까지가 값
          let value = afterKeyword;
          for (let otherKeyword of keywords) {
            if (otherKeyword !== keyword) {
              const otherIndex = value.toLowerCase().indexOf(otherKeyword.toLowerCase());
              if (otherIndex > -1) {
                value = value.substring(0, otherIndex).trim();
                break;
              }
            }
          }
          if (value) return value;
        }
      }
    }
  }

  return "";
}

// 날짜/시간 파싱 함수 (다양한 형식 지원, 시간 정보 포함)
function parseDate(text, keywords) {
  const dateTimeStr = extractValue(text, keywords);
  if (!dateTimeStr) return "";

  // 날짜 형식 정규화
  // 25.05.27, 2025.05.26, 5/27, 5월 27일, 20251121 등 다양한 형식 처리
  const patterns = [
    /(\d{8})/, // 20251121 (YYYYMMDD)
    /(\d{2})\.(\d{2})\.(\d{2})/, // 25.05.27
    /(\d{4})\.(\d{2})\.(\d{2})/, // 2025.05.26
    /(\d{1,2})\/(\d{1,2})/, // 5/27
    /(\d{1,2})월\s*(\d{1,2})일/, // 5월 27일
    /(\d{4})-(\d{2})-(\d{2})/, // 2025-05-26
  ];

  let year = "";
  let month = "";
  let day = "";
  let hour = "09"; // 기본값
  let minute = "00"; // 기본값

  for (let pattern of patterns) {
    const match = dateTimeStr.match(pattern);
    if (match) {
      if (pattern === patterns[0] && match[0].length === 8) {
        // 20251121 형식 (YYYYMMDD)
        year = match[0].substring(0, 4);
        month = match[0].substring(4, 6);
        day = match[0].substring(6, 8);
      } else if (match.length === 3) {
        // 5/27 형식
        const currentYear = new Date().getFullYear();
        year = currentYear.toString();
        month = match[1].padStart(2, "0");
        day = match[2].padStart(2, "0");
      } else if (match.length === 4) {
        // 25.05.27 형식 (2자리 연도)
        year = "20" + match[1];
        month = match[2];
        day = match[3];
      } else {
        // 2025.05.26 형식
        year = match[1];
        month = match[2];
        day = match[3];
      }
      break;
    }
  }

  // 시간 정보 추출 (예: "25.05.27 (화요일) 09:00" 또는 "09:00", "오전 9시" 등)
  const timePatterns = [
    /(\d{1,2}):(\d{2})/, // 09:00, 14:30
    /(\d{1,2})시\s*(\d{1,2})?분?/, // 9시, 14시 30분
    /오전\s*(\d{1,2})시?/, // 오전 9시
    /오후\s*(\d{1,2})시?/, // 오후 2시
  ];

  for (let pattern of timePatterns) {
    const timeMatch = dateTimeStr.match(pattern);
    if (timeMatch) {
      if (pattern === timePatterns[0]) {
        // HH:mm 형식
        hour = timeMatch[1].padStart(2, "0");
        minute = (timeMatch[2] || "00").padStart(2, "0");
      } else if (pattern === timePatterns[1]) {
        // N시 M분 형식
        hour = timeMatch[1].padStart(2, "0");
        minute = (timeMatch[2] || "00").padStart(2, "0");
      } else if (pattern === timePatterns[2]) {
        // 오전 N시
        let h = parseInt(timeMatch[1]);
        if (h === 12) h = 0;
        hour = h.toString().padStart(2, "0");
      } else if (pattern === timePatterns[3]) {
        // 오후 N시
        let h = parseInt(timeMatch[1]);
        if (h !== 12) h += 12;
        hour = h.toString().padStart(2, "0");
      }
      break;
    }
  }

  // 날짜가 없으면 오늘/내일 처리
  if (!year) {
    if (dateTimeStr.includes("금일") || dateTimeStr.includes("오늘")) {
      const today = new Date();
      year = today.getFullYear().toString();
      month = String(today.getMonth() + 1).padStart(2, "0");
      day = String(today.getDate()).padStart(2, "0");
    } else if (dateTimeStr.includes("익일") || dateTimeStr.includes("내일")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      year = tomorrow.getFullYear().toString();
      month = String(tomorrow.getMonth() + 1).padStart(2, "0");
      day = String(tomorrow.getDate()).padStart(2, "0");
    } else {
      return dateTimeStr; // 파싱 실패 시 원본 반환
    }
  }

  // "미정"이 포함된 경우 처리
  const hasUndecided = dateTimeStr.includes("미정");
  
  // YYYY-MM-DD HH:mm 형식으로 반환
  if (year && month && day) {
    if (hasUndecided) {
      // 시간이 미정인 경우
      return `${year}-${month}-${day} 미정`;
    } else {
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
  }

  return dateTimeStr;
}

// 주소 추출 함수 (상차지/하차지) - 개선: 다양한 형식 지원, 주소와 업체명 분리
function extractAddress(text, keywords) {
  if (!text) return "";

  // 여러 줄에 걸친 주소 처리
  const lines = text.split("\n");
  let addressLines = [];
  let foundKeyword = false;
  
  // 키워드를 길이순으로 정렬 (긴 키워드 우선)
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 키워드가 있는 줄 찾기
    if (!foundKeyword) {
      for (let keyword of sortedKeywords) {
        const keywordLower = keyword.toLowerCase();
        const lineLower = line.toLowerCase();
        
        // 키워드가 줄의 시작 부분에 있거나 콜론(:) 앞에 있는지 확인
        const keywordPattern = new RegExp("(^|\\s)" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]", "i");
        
        if (!keywordPattern.test(line) && !lineLower.includes(keywordLower)) continue;
        
        foundKeyword = true;
          
          // 콜론(: 또는 ：) 뒤의 내용 추출
          const colonIndex = line.search(/[:：]/);
          if (colonIndex > -1) {
            const afterColon = line.substring(colonIndex + 1).trim();
            if (afterColon) {
              addressLines.push(afterColon);
            }
          } else {
            // 콜론이 없으면 키워드 뒤의 내용
            const keywordIndex = lineLower.indexOf(keywordLower);
            if (keywordIndex > -1) {
              const afterKeyword = line.substring(keywordIndex + keyword.length).trim();
              if (afterKeyword) {
                addressLines.push(afterKeyword);
              }
            }
          }
          
          // 다음 줄도 확인 (주소가 여러 줄에 걸쳐 있을 수 있음)
          if (i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            // 다음 줄이 키워드가 아니고 주소 패턴이면 포함
            if (nextLine && !nextLine.match(/^[가-힣\s]*[:：]/)) {
              const isAddress = nextLine.match(/[가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/);
              const isKeyword = keywords.some(k => nextLine.toLowerCase().includes(k.toLowerCase()));
              if (isAddress && !isKeyword) {
                addressLines.push(nextLine);
                i++; // 다음 줄을 이미 처리했으므로 인덱스 증가
              }
            }
          }
          break;
      }
    } else {
      // 키워드 이후 연속된 주소 줄들
      const isAddress = line.match(/[가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/);
      const isKeyword = keywords.some(k => line.toLowerCase().includes(k.toLowerCase()));
      
      if (isAddress && !isKeyword) {
        addressLines.push(line);
      } else if (line.match(/^[가-힣\s]+$/) && !isKeyword) {
        // 한글로만 이루어진 줄도 주소로 간주 (업체명일 수 있음)
        addressLines.push(line);
      } else {
        // 새로운 키워드가 나오면 중단
        break;
      }
    }
  }
  
  if (addressLines.length > 0) {
    const fullText = addressLines.join(" ").trim();
    // 주소와 업체명 분리 (주소 패턴이 먼저 나오는 경우)
    const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)\s*(.+)?/;
    const match = fullText.match(addressPattern);
    
    if (match) {
      return match[1].trim();
    }
    
    // 주소 패턴이 없으면 전체를 주소로 (업체명이 앞에 있을 수도 있음)
    return fullText;
  }

  // extractValue로 한 번 더 시도
  const addressStr = extractValue(text, keywords);
  if (!addressStr) return "";

  // 주소 패턴 추출
  const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)\s*(.+)?/;
  const match = addressStr.match(addressPattern);
  
  if (match) {
    return match[1].trim();
  }

  return addressStr.trim();
}

// 업체명 추출 함수 (개선: 주소와 업체명 분리, 여러 줄 처리)
function extractCompanyName(text, keywords) {
  if (!text) return "";

  // 여러 줄에 걸친 처리
  const lines = text.split("\n");
  let foundKeyword = false;
  let companyLines = [];
  
  // 키워드를 길이순으로 정렬 (긴 키워드 우선)
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 키워드가 있는 줄 찾기
    if (!foundKeyword) {
      for (let keyword of sortedKeywords) {
        const keywordLower = keyword.toLowerCase();
        const lineLower = line.toLowerCase();
        
        // 키워드가 줄의 시작 부분에 있거나 콜론(:) 앞에 있는지 확인
        const keywordPattern = new RegExp("(^|\\s)" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]", "i");
        
        if (!keywordPattern.test(line) && !lineLower.includes(keywordLower)) continue;
        
        foundKeyword = true;
          
          // 콜론(: 또는 ：) 뒤의 내용 추출
          const colonIndex = line.search(/[:：]/);
          if (colonIndex > -1) {
            const afterColon = line.substring(colonIndex + 1).trim();
            if (afterColon) {
              companyLines.push(afterColon);
            }
          } else {
            // 콜론이 없으면 키워드 뒤의 내용
            const keywordIndex = lineLower.indexOf(keywordLower);
            if (keywordIndex > -1) {
              const afterKeyword = line.substring(keywordIndex + keyword.length).trim();
              if (afterKeyword) {
                companyLines.push(afterKeyword);
              }
            }
          }
          
          // 다음 줄도 확인 (업체명이 다음 줄에 있을 수 있음)
          if (i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.match(/^[가-힣\s]*[:：]/)) {
              // 다음 줄이 키워드가 아니면 포함
              const isKeyword = keywords.some(k => nextLine.toLowerCase().includes(k.toLowerCase()));
              if (!isKeyword) {
                companyLines.push(nextLine);
                i++; // 다음 줄을 이미 처리했으므로 인덱스 증가
              }
            }
          }
          break;
      }
    } else {
      // 키워드 이후 연속된 줄들
      const isKeyword = keywords.some(k => line.toLowerCase().includes(k.toLowerCase()));
      if (!isKeyword && line) {
        companyLines.push(line);
      } else {
        break;
      }
    }
  }
  
  if (companyLines.length > 0) {
    const fullText = companyLines.join(" ").trim();
    
    // "하차지 업체명 / 주소" 형식 처리 (업체명이 앞에 올 수도, 주소가 앞에 올 수도)
    // 슬래시(/)로 분리된 경우
    if (fullText.includes("/")) {
      const parts = fullText.split("/").map(p => p.trim());
      for (let part of parts) {
        // 주소 패턴이 없으면 업체명으로 간주
        if (!part.match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/)) {
          return part;
        }
      }
      // 모두 주소 패턴이면 마지막 부분을 업체명으로
      return parts[parts.length - 1] || "";
    }
    
    // 주소와 업체명이 함께 있는 경우
    const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)\s*(.+)/;
    const match = fullText.match(addressPattern);
    
    if (match && match[2]) {
      return match[2].trim();
    }
    
    // 주소 패턴이 없으면 전체를 업체명으로
    if (!fullText.match(/(?:시|도|군|구|읍|면|동|리|로|길)/)) {
      return fullText.trim();
    }
    
    // 주소 패턴이 있으면 업체명 추출 시도 (주소 뒤에 업체명이 있을 수 있음)
    const reverseMatch = fullText.match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*\s*(.+)/);
    if (reverseMatch && reverseMatch[1]) {
      return reverseMatch[1].trim();
    }
  }

  // extractValue로 한 번 더 시도
  const fullStr = extractValue(text, keywords);
  if (!fullStr) return "";

  // 슬래시(/)로 분리된 경우
  if (fullStr.includes("/")) {
    const parts = fullStr.split("/").map(p => p.trim());
    for (let part of parts) {
      if (!part.match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/)) {
        return part;
      }
    }
    return parts[parts.length - 1] || "";
  }

  // 주소와 업체명이 함께 있는 경우
  const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)\s*(.+)/;
  const match = fullStr.match(addressPattern);
  
  if (match && match[2]) {
    return match[2].trim();
  }

  // 주소 패턴이 없으면 전체를 업체명으로
  if (!fullStr.match(/(?:시|도|군|구|읍|면|동|리|로|길)/)) {
    return fullStr.trim();
  }

  return "";
}

// 연락처 추출 함수 (전화번호) - 개선: 여러 줄 처리, 다양한 형식 지원
function extractPhone(text, keywords) {
  if (!text) return "";

  // 여러 줄에 걸친 처리
  const lines = text.split("\n");
  let foundKeyword = false;
  let phoneLines = [];
  
  // 키워드를 길이순으로 정렬 (긴 키워드 우선)
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 키워드가 있는 줄 찾기
    if (!foundKeyword) {
      for (let keyword of sortedKeywords) {
        const keywordLower = keyword.toLowerCase();
        const lineLower = line.toLowerCase();
        
        // 키워드가 줄의 시작 부분에 있거나 콜론(:) 앞에 있는지 확인
        const keywordPattern = new RegExp("(^|\\s)" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]", "i");
        
        if (!keywordPattern.test(line) && !lineLower.includes(keywordLower)) continue;
        
        foundKeyword = true;
          
          // 콜론(: 또는 ：) 뒤의 내용 추출
          const colonIndex = line.search(/[:：]/);
          if (colonIndex > -1) {
            const afterColon = line.substring(colonIndex + 1).trim();
            if (afterColon) {
              phoneLines.push(afterColon);
            }
          } else {
            const keywordIndex = lineLower.indexOf(keywordLower);
            if (keywordIndex > -1) {
              const afterKeyword = line.substring(keywordIndex + keyword.length).trim();
              if (afterKeyword) {
                phoneLines.push(afterKeyword);
              }
            }
          }
          
          // 다음 줄도 확인 (연락처가 다음 줄에 있을 수 있음)
          if (i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.match(/^[가-힣\s]*[:：]/)) {
              const isKeyword = keywords.some(k => nextLine.toLowerCase().includes(k.toLowerCase()));
              if (!isKeyword) {
                phoneLines.push(nextLine);
                i++;
              }
            }
          }
          break;
      }
    } else {
      const isKeyword = keywords.some(k => line.toLowerCase().includes(k.toLowerCase()));
      if (!isKeyword && line) {
        phoneLines.push(line);
      } else {
        break;
      }
    }
  }
  
  const phoneStr = phoneLines.join(" ").trim() || extractValue(text, keywords);
  if (!phoneStr) return "";

  // 전화번호 패턴 추출
  const phonePattern = /(\d{2,3}-\d{3,4}-\d{4}|\d{10,11})/;
  const match = phoneStr.match(phonePattern);
  
  if (match) {
    return match[1];
  }

  // 이름과 함께 있는 경우 (예: "윤태우 사원: 010-4645-9823")
  const namePhonePattern = /([가-힣\s]+)[:：]\s*(\d{2,3}-\d{3,4}-\d{4}|\d{10,11})/;
  const nameMatch = phoneStr.match(namePhonePattern);
  
  if (nameMatch) {
    return nameMatch[2];
  }

  // 슬래시(/)로 분리된 경우 (예: "김아주 / 010-1111-1111")
  if (phoneStr.includes("/")) {
    const parts = phoneStr.split("/").map(p => p.trim());
    for (let part of parts) {
      const phoneMatch = part.match(phonePattern);
      if (phoneMatch) {
        return phoneMatch[1];
      }
    }
  }

  return phoneStr.trim();
}

// 담당자명 추출 함수 (개선: 여러 줄 처리, 다양한 형식 지원)
function extractContactName(text, keywords) {
  if (!text) return "";

  // 여러 줄에 걸친 처리
  const lines = text.split("\n");
  let foundKeyword = false;
  let contactLines = [];
  
  // 키워드를 길이순으로 정렬 (긴 키워드 우선)
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 키워드가 있는 줄 찾기
    if (!foundKeyword) {
      for (let keyword of sortedKeywords) {
        const keywordLower = keyword.toLowerCase();
        const lineLower = line.toLowerCase();
        
        // 키워드가 줄의 시작 부분에 있거나 콜론(:) 앞에 있는지 확인
        const keywordPattern = new RegExp("(^|\\s)" + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[:：]", "i");
        
        if (!keywordPattern.test(line) && !lineLower.includes(keywordLower)) continue;
        
        foundKeyword = true;
          
          // 콜론(: 또는 ：) 뒤의 내용 추출
          const colonIndex = line.search(/[:：]/);
          if (colonIndex > -1) {
            const afterColon = line.substring(colonIndex + 1).trim();
            if (afterColon) {
              contactLines.push(afterColon);
            }
          } else {
            const keywordIndex = lineLower.indexOf(keywordLower);
            if (keywordIndex > -1) {
              const afterKeyword = line.substring(keywordIndex + keyword.length).trim();
              if (afterKeyword) {
                contactLines.push(afterKeyword);
              }
            }
          }
          
          // 다음 줄도 확인 (담당자 정보가 다음 줄에 있을 수 있음)
          if (i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.match(/^[가-힣\s]*[:：]/)) {
              const isKeyword = keywords.some(k => nextLine.toLowerCase().includes(k.toLowerCase()));
              if (!isKeyword) {
                contactLines.push(nextLine);
                i++;
              }
            }
          }
          break;
      }
    } else {
      const isKeyword = keywords.some(k => line.toLowerCase().includes(k.toLowerCase()));
      if (!isKeyword && line) {
        contactLines.push(line);
      } else {
        break;
      }
    }
  }
  
  const contactStr = contactLines.join(" ").trim() || extractValue(text, keywords);
  if (!contactStr) return "";

  // "윤태우 사원: 010-4645-9823" 형식 처리
  const nameColonPattern = /([가-힣]{2,4})\s*(?:사원|과장|대리|차장|부장|대표|님)?\s*[:：]\s*\d/;
  const nameColonMatch = contactStr.match(nameColonPattern);
  if (nameColonMatch) {
    return nameColonMatch[1].trim();
  }

  // 이름 패턴 추출 (한글 이름)
  const namePattern = /([가-힣]{2,4})\s*(?:사원|과장|대리|차장|부장|대표|님)?/;
  const match = contactStr.match(namePattern);
  
  if (match) {
    return match[1];
  }

  // 전화번호 앞의 이름
  const namePhonePattern = /([가-힣\s]+)[:：]?\s*\d/;
  const nameMatch = contactStr.match(namePhonePattern);
  
  if (nameMatch) {
    return nameMatch[1].trim().replace(/\s*(사원|과장|대리|차장|부장|대표|님)\s*/, "");
  }

  // 슬래시(/)로 분리된 경우 (예: "김아주 / 010-1111-1111")
  if (contactStr.includes("/")) {
    const parts = contactStr.split("/").map(p => p.trim());
    for (let part of parts) {
      // 전화번호가 없으면 이름으로 간주
      if (!part.match(/\d{2,3}-\d{3,4}-\d{4}|\d{10,11}/)) {
        const nameMatch = part.match(/([가-힣]{2,4})/);
        if (nameMatch) {
          return nameMatch[1];
        }
      }
    }
  }

  return contactStr.trim();
}

// 톤수 추출 함수 (개선: 복잡한 형식 지원)
function extractTonnage(text, keywords) {
  const tonnageStr = extractValue(text, keywords);
  if (!tonnageStr) return "";

  // 복잡한 형식 처리 (예: "11t(9.6m 이상 6대) / 중량 3.5t")
  // 먼저 톤수 부분만 추출
  const tonnagePatterns = [
    /(\d+(?:\.\d+)?)\s*[톤tT](?:\([^)]*\))?/, // 11t(9.6m 이상 6대)
    /(\d+(?:\.\d+)?)\s*톤/, // 2.5톤
    /(\d+)\s*파[렛레]트/, // 6파레트
    /(\d+(?:\.\d+)?)\s*[톤tT]\s*[이상이하]/, // 11톤 이상
    /중량\s*(\d+(?:\.\d+)?)\s*[톤tT]?/, // 중량 3.5t
  ];

  for (let pattern of tonnagePatterns) {
    const match = tonnageStr.match(pattern);
    if (match) {
      let result = match[1];
      // 톤 단위가 있으면 추가
      if (tonnageStr.includes("톤") || tonnageStr.toLowerCase().includes("t")) {
        result += "톤";
      }
      return result;
    }
  }

  // 차량 길이 정보도 포함 (예: "9.6m 이상 6대")
  const vehiclePattern = /(\d+(?:\.\d+)?)\s*[mM미터]\s*(?:이상|이하)?\s*(\d+)\s*대/;
  const vehicleMatch = tonnageStr.match(vehiclePattern);
  if (vehicleMatch) {
    return `${vehicleMatch[1]}m ${vehicleMatch[2]}대`;
  }

  return tonnageStr.trim();
}

// 배차 요청 텍스트 파싱 함수
function parseTransportRequest(text, contractNo) {
  Logger.log("=== 배차 요청 텍스트 파싱 시작 ===");
  Logger.log("원본 텍스트:", text);

  const result = {
    운송계약번호: contractNo || "",
    고객사명: "",
    상차일자: "",
    하차일자: "",
    상차지명: "",
    상차지주소: "",
    하차지명: "",
    하차지주소: "",
    요청톤수: "",
    담당자명: "",
    담당자연락처: "",
    비고: "",
  };

  // 상차일자 추출 (다양한 키워드 지원)
  result.상차일자 = parseDate(text, [
    "상차일 및 상차시간",
    "상차일",
    "상차일자",
    "상차 시간",
    "상차일 및 하차시간",
    "배차일자",  // 추가
    "배차일",    // 추가
  ]);

  // 하차일자 추출 (다양한 키워드 지원)
  result.하차일자 = parseDate(text, [
    "하차일 및 하차시간",
    "하차일",
    "하차일자",
    "하차 시간",
    "하차일",    // 추가
    "도착",
    "착",
    "착지",      // 추가
  ]);

  // 상차지 주소 및 업체명 추출 (통합 처리 후 분리)
  const 상차지전체 = extractValue(text, [
    "상차지 주소 / 업체명",
    "상차지주소 및 업체명",
    "상차지 주소",
    "상차지주소",
  ]);
  
  if (상차지전체) {
    // 슬래시(/)로 분리된 경우
    if (상차지전체.includes("/")) {
      const parts = 상차지전체.split("/").map(p => p.trim());
      // 일반적으로 "주소 / 업체명" 순서이므로 첫 번째가 주소, 두 번째가 업체명일 가능성이 높음
      if (parts.length >= 2) {
        // 첫 번째 부분이 주소 패턴을 포함하면 주소로, 아니면 업체명으로
        if (parts[0].match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길|\d+길|\d+번지)/)) {
          result.상차지주소 = parts[0];
          result.상차지명 = parts[1];
        } else {
          // 첫 번째가 주소 패턴이 아니면 두 번째가 주소일 수도 있음
          if (parts[1].match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길|\d+길|\d+번지)/)) {
            result.상차지주소 = parts[1];
            result.상차지명 = parts[0];
          } else {
            // 둘 다 주소 패턴이 아니면 첫 번째를 주소, 두 번째를 업체명으로
            result.상차지주소 = parts[0];
            result.상차지명 = parts[1];
          }
        }
      } else if (parts.length === 1) {
        // 슬래시가 있지만 분리 결과가 하나만 있는 경우
        result.상차지주소 = parts[0];
      }
    } else {
      // 슬래시가 없으면 주소와 업체명이 함께 있는 경우
      const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길|\d+길|\d+번지)[가-힣\s\d\-\.]*)\s*(.+)?/;
      const match = 상차지전체.match(addressPattern);
      if (match && match[1] && match[2]) {
        result.상차지주소 = match[1].trim();
        result.상차지명 = match[2].trim();
      } else if (match && match[1]) {
        result.상차지주소 = match[1].trim();
      } else {
        // 주소 패턴이 없으면 업체명으로
        if (!상차지전체.match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/)) {
          result.상차지명 = 상차지전체;
        } else {
          result.상차지주소 = 상차지전체;
        }
      }
    }
  }
  
  // 기존 방식으로도 시도 (위에서 추출되지 않은 경우)
  if (!result.상차지주소) {
    result.상차지주소 = extractAddress(text, [
      "상차지 주소",
      "상차지주소",
      "상차지",
      "출발지",
      "출",
    ]);
  }
  
  if (!result.상차지명) {
    result.상차지명 = extractCompanyName(text, [
      "상차지 업체명",
      "상차지명",
      "상차지",
      "출발지",
      "출",
    ]);
  }

  // 하차지 주소 및 업체명 추출 (통합 처리 후 분리)
  const 하차지전체 = extractValue(text, [
    "하차지 주소 / 업체명",
    "하차지 업체명 / 주소",
    "하차지주소 및 업체명",
    "하차지 주소",
    "하차지주소",
  ]);
  
  if (하차지전체) {
    // 슬래시(/)로 분리된 경우
    if (하차지전체.includes("/")) {
      const parts = 하차지전체.split("/").map(p => p.trim());
      // 일반적으로 "주소 / 업체명" 순서이므로 첫 번째가 주소, 두 번째가 업체명일 가능성이 높음
      if (parts.length >= 2) {
        // 첫 번째 부분이 주소 패턴을 포함하면 주소로, 아니면 업체명으로
        if (parts[0].match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길|\d+길|\d+번지)/)) {
          result.하차지주소 = parts[0];
          result.하차지명 = parts[1];
        } else {
          // 첫 번째가 주소 패턴이 아니면 두 번째가 주소일 수도 있음
          if (parts[1].match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길|\d+길|\d+번지)/)) {
            result.하차지주소 = parts[1];
            result.하차지명 = parts[0];
          } else {
            // 둘 다 주소 패턴이 아니면 첫 번째를 주소, 두 번째를 업체명으로
            result.하차지주소 = parts[0];
            result.하차지명 = parts[1];
          }
        }
      } else if (parts.length === 1) {
        // 슬래시가 있지만 분리 결과가 하나만 있는 경우
        result.하차지주소 = parts[0];
      }
    } else {
      // 슬래시가 없으면 주소와 업체명이 함께 있는 경우
      const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길|\d+길|\d+번지)[가-힣\s\d\-\.]*)\s*(.+)?/;
      const match = 하차지전체.match(addressPattern);
      if (match && match[1] && match[2]) {
        result.하차지주소 = match[1].trim();
        result.하차지명 = match[2].trim();
      } else if (match && match[1]) {
        result.하차지주소 = match[1].trim();
      } else {
        // 주소 패턴이 없으면 업체명으로
        if (!하차지전체.match(/(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/)) {
          result.하차지명 = 하차지전체;
        } else {
          result.하차지주소 = 하차지전체;
        }
      }
    }
  }
  
  // 기존 방식으로도 시도 (위에서 추출되지 않은 경우)
  if (!result.하차지주소) {
    result.하차지주소 = extractAddress(text, [
      "하차지 주소",
      "하차지주소",
      "하차지",
      "도착지",
      "착",
      "착지",
    ]);
  }
  
  if (!result.하차지명) {
    result.하차지명 = extractCompanyName(text, [
      "하차지 업체명",
      "하차지명",
      "하차지",
      "도착지",
      "착",
      "착지",
    ]);
  }

  // 요청톤수 추출 (다양한 형식 지원: 차량톤수 = 톤수 = 요청톤수)
  result.요청톤수 = extractTonnage(text, [
    "요청톤수(차량길이 및 총 중량)",
    "요청톤수",
    "요청대수",
    "차량",
    "차량톤수",  // 추가
    "톤수",      // 추가 (우선순위 높임)
    "요청차량대수",
    "요청톤수(차량길이)",
    "차량 톤수", // 추가
    "차량톤",    // 추가
  ]);

  // 담당자명 및 연락처 추출 (상차지 또는 하차지) - 슬래시로 분리된 형식 처리
  // "상차지 담당자 / 연락처 : 김희수 / 01083271361" 형식 처리
  const 상차담당자전체 = extractValue(text, [
    "상차지 담당자 / 연락처",
    "상차 담당자 / 연락처",
  ]);
  
  let 상차담당자명 = "";
  let 상차담당자연락처 = "";
  
  if (상차담당자전체 && 상차담당자전체.includes("/")) {
    const parts = 상차담당자전체.split("/").map(p => p.trim());
    if (parts.length >= 2) {
      // 첫 번째가 이름, 두 번째가 전화번호일 가능성이 높음
      상차담당자명 = parts[0];
      상차담당자연락처 = parts[1];
    } else if (parts.length === 1) {
      // 전화번호 패턴 확인
      if (parts[0].match(/\d{10,11}/)) {
        상차담당자연락처 = parts[0];
      } else {
        상차담당자명 = parts[0];
      }
    }
  } else if (상차담당자전체) {
    // 슬래시가 없으면 기존 방식 사용
    상차담당자명 = extractContactName(text, [
      "상차지 담당자",
      "상차 담당자",
    ]);
    상차담당자연락처 = extractPhone(text, [
      "상차지 담당자",
      "상차 담당자",
    ]);
  }
  
  // 하차지 담당자 / 연락처 추출
  const 하차담당자전체 = extractValue(text, [
    "하차지 담당자 / 연락처",
    "하차 담당자 / 연락처",
  ]);
  
  let 하차담당자명 = "";
  let 하차담당자연락처 = "";
  
  if (하차담당자전체 && 하차담당자전체.includes("/")) {
    const parts = 하차담당자전체.split("/").map(p => p.trim());
    if (parts.length >= 2) {
      // 첫 번째가 이름, 두 번째가 전화번호일 가능성이 높음
      하차담당자명 = parts[0];
      하차담당자연락처 = parts[1];
    } else if (parts.length === 1) {
      // 전화번호 패턴 확인
      if (parts[0].match(/\d{10,11}/)) {
        하차담당자연락처 = parts[0];
      } else {
        하차담당자명 = parts[0];
      }
    }
  } else if (하차담당자전체) {
    // 슬래시가 없으면 기존 방식 사용
    하차담당자명 = extractContactName(text, [
      "하차지 담당자",
      "하차 담당자",
    ]);
    하차담당자연락처 = extractPhone(text, [
      "하차지 담당자",
      "하차 담당자",
    ]);
  }
  
  // 하차지 우선, 없으면 상차지
  result.담당자명 = 하차담당자명 || 상차담당자명 || "";
  result.담당자연락처 = 하차담당자연락처 || 상차담당자연락처 || "";

  // 비고 추출 (특이사항, 비고 등) - 개선: 여러 줄 처리, 다양한 형식 지원
  const 비고키워드 = [
    "비고",
    "특이사항",
    "기타",
    "요청사항",
    "수작업유무",
    "※",
    "요청차량대수",  // 추가
  ];
  
  // 여러 줄에 걸친 비고 추출
  const lines = text.split("\n");
  let 비고모음 = [];
  let 비고시작 = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 비고 키워드가 있는 줄부터 시작
    if (비고키워드.some(kw => line.toLowerCase().includes(kw.toLowerCase()))) {
      비고시작 = true;
      // 콜론(: 또는 ：) 뒤의 내용 추출
      const colonIndex = line.search(/[:：]/);
      if (colonIndex > -1) {
        const afterColon = line.substring(colonIndex + 1).trim();
        if (afterColon) {
          비고모음.push(afterColon);
        }
      } else {
        // 키워드 뒤의 내용
        for (let kw of 비고키워드) {
          const kwIndex = line.toLowerCase().indexOf(kw.toLowerCase());
          if (kwIndex > -1) {
            const afterKw = line.substring(kwIndex + kw.length).trim();
            if (afterKw) {
              비고모음.push(afterKw);
            }
            break;
          }
        }
      }
      
      // 다음 줄도 확인 (비고 내용이 다음 줄에 있을 수 있음)
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.match(/^[가-힣\s]*[:：]/)) {
          const isKeyword = 비고키워드.some(k => nextLine.toLowerCase().includes(k.toLowerCase()));
          if (!isKeyword && !nextLine.match(/^\[|^상차|^하차|^요청/)) {
            비고모음.push(nextLine);
            i++;
          }
        }
      }
      continue;
    }
    
    // 비고 시작 후 다음 줄들도 포함 (특정 키워드가 나올 때까지)
    if (비고시작) {
      // 새로운 섹션이 시작되면 중단
      if (line.match(/^\[|^상차|^하차|^요청/)) {
        break;
      }
      비고모음.push(line);
    }
  }
  
  result.비고 = 비고모음.join(" ").trim() || extractValue(text, 비고키워드);
  
  // 요청차량대수도 비고에 포함 (별도 추출)
  const 요청차량대수 = extractValue(text, ["요청차량대수", "요청 차량 대수", "차량대수"]);
  if (요청차량대수) {
    if (result.비고) {
      result.비고 += " / 요청차량대수: " + 요청차량대수;
    } else {
      result.비고 = "요청차량대수: " + 요청차량대수;
    }
  }

  // 고객사명 추출 (업체명, 고객사명 등) - 명확한 키워드만 사용
  // 주의: 상차지/하차지 업체명과 혼동하지 않도록 명확한 키워드만 사용
  result.고객사명 = extractValue(text, [
    "고객사명",
    "고객사",
  ]);
  
  // "업체명" 키워드는 상차지/하차지 업체명과 혼동될 수 있으므로 제외

  Logger.log("파싱 결과:", result);
  return result;
}

// 파싱 결과를 시트에 저장
function insertToParsedSheet(parsedData, timestamp) {
  try {
    const spreadsheet = getSpreadsheet();
    let parsedSheet = spreadsheet.getSheetByName("파싱결과");

    // 파싱결과 시트가 없으면 생성
    if (!parsedSheet) {
      parsedSheet = spreadsheet.insertSheet("파싱결과");
      
      // 헤더 설정
      const headers = [
        "No.",
        "운송계약번호*",
        "고객사명",
        "운송단가번호",
        "상차일자*",
        "하차일자*",
        "상차지명*",
        "상차지주소*",
        "하차지명*",
        "하차지주소*",
        "운송사명",
        "운송사코드*",
        "온도구분",
        "운송조건*",
        "톤수",
        "요청톤수*",
        "차량번호",
        "기사명",
        "기사님연락처",
        "운송매출*",
        "기타매출",
        "운송비용*",
        "기타비용",
        "담당자명",
        "담당자연락처",
        "비고",
      ];
      
      parsedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      parsedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }

    // 기존 데이터 확인하여 No. 생성
    const lastRow = parsedSheet.getLastRow();
    const nextNo = lastRow > 0 ? lastRow : 1;

    // 데이터 행 생성
    const rowData = [
      nextNo, // No.
      parsedData.운송계약번호 || "", // 운송계약번호*
      parsedData.고객사명 || "", // 고객사명
      "", // 운송단가번호
      parsedData.상차일자 || "", // 상차일자*
      parsedData.하차일자 || "", // 하차일자*
      parsedData.상차지명 || "", // 상차지명*
      parsedData.상차지주소 || "", // 상차지주소*
      parsedData.하차지명 || "", // 하차지명*
      parsedData.하차지주소 || "", // 하차지주소*
      "", // 운송사명
      "", // 운송사코드*
      "", // 온도구분
      "", // 운송조건*
      "", // 톤수
      parsedData.요청톤수 || "", // 요청톤수*
      "", // 차량번호
      "", // 기사명
      "", // 기사님연락처
      "", // 운송매출*
      "", // 기타매출
      "", // 운송비용*
      "", // 기타비용
      parsedData.담당자명 || "", // 담당자명
      parsedData.담당자연락처 || "", // 담당자연락처
      parsedData.비고 || "", // 비고
    ];

    // 새 행 추가
    parsedSheet.appendRow(rowData);
    Logger.log("파싱 결과 저장 완료:", nextNo);

    return true;
  } catch (error) {
    Logger.log("파싱 결과 저장 오류:", error);
    return false;
  }
}

// 원본 데이터 처리 함수
function processRawData(content, contractNo, timestamp, sourceRow, sourceSheet) {
  try {
    Logger.log("=== 배차 요청 데이터 처리 시작 ===");
    Logger.log("원본 텍스트:", content);
    Logger.log("계약번호:", contractNo);

    if (!content || content.trim() === "") {
      Logger.log("배차 요청 내용이 없어서 처리 중단");
      if (sourceRow && sourceSheet) {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리오류");
      }
      return;
    }

    // 텍스트 파싱
    const parsedData = parseTransportRequest(content, contractNo);
    Logger.log("파싱 결과:", parsedData);

    // 파싱 결과 시트에 저장
    const insertResult = insertToParsedSheet(parsedData, timestamp);
    
    if (insertResult) {
      Logger.log("파싱 결과 저장 완료");
      
      // 처리상태 업데이트
      if (sourceRow && sourceSheet) {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리완료");
        Logger.log("처리상태 업데이트: 처리완료");
      }
    } else {
      throw new Error("파싱 결과 저장 실패");
    }

    Logger.log("=== 모든 처리 완료 ===");
  } catch (error) {
    Logger.log("처리 오류:", error);
    Logger.log("오류 스택:", error.stack);

    // 오류 발생 시 처리상태 업데이트
    if (sourceRow && sourceSheet) {
      try {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리오류");
        Logger.log("처리상태 업데이트: 처리오류");
      } catch (updateError) {
        Logger.log("처리상태 업데이트 실패:", updateError);
      }
    }
  }
}

// 처리상태 업데이트 함수 (참고 프로젝트 로직 적용)
function updateFormResponseStatus(sheet, row, status) {
  try {
    const headerRow = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const getColIndex = (name) =>
      headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
    const statusIdx = getColIndex("처리상태");

    // 처리상태 컬럼이 없으면 추가
    if (statusIdx === -1) {
      const lastColumn = sheet.getLastColumn();
      sheet.getRange(1, lastColumn + 1).setValue("처리상태");
      sheet.getRange(row, lastColumn + 1).setValue(status);
      Logger.log("처리상태 컬럼 추가 및 상태 업데이트:", status);
    } else {
      sheet.getRange(row, statusIdx + 1).setValue(status);
      Logger.log("처리상태 업데이트:", status);
    }
  } catch (error) {
    Logger.log("처리상태 업데이트 오류:", error);
  }
}

// 수동 처리 함수 - 설문지 응답 시트 대상
function processAllFormResponses() {
  try {
    Logger.log("=== 모든 설문지 응답 처리 시작 ===");

    const spreadsheet = getSpreadsheet();
    const responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      Logger.log("설문지 응답 시트를 찾을 수 없습니다!");
      return;
    }

    // 헤더에서 컬럼 인덱스 찾기
    const headerRow = responseSheet
      .getRange(1, 1, 1, responseSheet.getLastColumn())
      .getValues()[0];
    const getColIndex = (name) =>
      headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
    
    const timestampIdx = getColIndex("타임스탬프");
    const contractNoIdx = getColIndex("운송계약번호");
    const contentIdx = getColIndex("배차 요청 내용");
    const statusIdx = getColIndex("처리상태");

    const data = responseSheet.getDataRange().getValues();
    Logger.log("총 응답 행 수:", data.length);

    let processedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const rowData = data[i];
      const timestamp = timestampIdx > -1 ? rowData[timestampIdx] : "";
      const contractNo = contractNoIdx > -1 ? (rowData[contractNoIdx] || "") : "";
      const content = contentIdx > -1 ? (rowData[contentIdx] || "") : "";
      const processStatus = statusIdx > -1 ? (rowData[statusIdx] || "") : "";

      if (content && content.toString().trim() && processStatus !== "처리완료") {
        Logger.log(`행 ${i + 1} 처리 중...`);
        processFormResponse(responseSheet, i + 1);
        processedCount++;
      }
    }

    Logger.log(`=== 처리 완료: ${processedCount}건 ===`);
  } catch (error) {
    Logger.log("일괄 처리 오류:", error);
  }
}

// 테스트 함수 - 특정 행 처리
function testSpecificFormResponse(rowNumber) {
  try {
    Logger.log("=== 특정 설문지 응답 테스트 ===");

    const spreadsheet = getSpreadsheet();
    const responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      Logger.log("설문지 응답 시트를 찾을 수 없습니다!");
      return;
    }

    const lastColumn = responseSheet.getLastColumn();
    const rowData = responseSheet
      .getRange(rowNumber, 1, 1, lastColumn)
      .getValues()[0];

    Logger.log("테스트 데이터:", rowData);

    if (rowData[2] && rowData[2].toString().trim()) {
      processFormResponse(responseSheet, rowNumber);
    } else {
      Logger.log("배차 요청 내용이 없습니다.");
    }
  } catch (error) {
    Logger.log("특정 행 테스트 오류:", error);
  }
}

// 설문지 응답 시트 초기화 함수 (처리상태 컬럼 추가)
function initializeFormResponseSheet() {
  try {
    const spreadsheet = getSpreadsheet();
    let responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      Logger.log(
        "설문지 응답 시트가 없습니다. 구글 폼과 연결되면 자동 생성됩니다."
      );
      return;
    }

    // 처리상태 컬럼이 없으면 추가
    const headerRow = responseSheet
      .getRange(1, 1, 1, responseSheet.getLastColumn())
      .getValues()[0];
    const getColIndex = (name) =>
      headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
    const statusIdx = getColIndex("처리상태");

    if (statusIdx === -1) {
      const lastColumn = responseSheet.getLastColumn();
      responseSheet.getRange(1, lastColumn + 1).setValue("처리상태");
      Logger.log("처리상태 컬럼 추가 완료");
      
      // 기존 데이터가 있으면 처리상태를 "대기"로 설정
      const lastRow = responseSheet.getLastRow();
      if (lastRow > 1) {
        for (let i = 2; i <= lastRow; i++) {
          const existingStatus = responseSheet.getRange(i, lastColumn + 1).getValue();
          if (!existingStatus || existingStatus === "") {
            responseSheet.getRange(i, lastColumn + 1).setValue("대기");
          }
        }
        Logger.log(`기존 ${lastRow - 1}개 행에 처리상태 설정 완료`);
      }
    } else {
      Logger.log("처리상태 컬럼이 이미 존재합니다.");
    }
  } catch (error) {
    Logger.log("설문지 응답 시트 초기화 오류:", error);
  }
}

// 전체 설정 함수
function initialize() {
  try {
    Logger.log("=== 시스템 초기화 시작 ===");
    setupFormResponseTrigger();
    initializeFormResponseSheet();
    Logger.log("=== 시스템 초기화 완료 ===");
  } catch (error) {
    Logger.log("초기화 오류:", error);
  }
}

// ============================================
// 프록시를 통한 요청 처리 (파싱 및 최종 접수)
// ============================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log("=== 요청 수신 ===");
    Logger.log("요청 데이터:", data);

    // mode 확인
    if (data.mode !== "transport") {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "잘못된 요청입니다. mode=transport가 필요합니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // action에 따라 분기
    if (data.action === "setStatus") {
      // 처리상태 설정 (구글 폼 제출 후)
      return handleSetStatus(data);
    } else if (data.action === "parse") {
      // 파싱 요청 처리
      return handleParseRequest(data);
    } else if (data.action === "submit") {
      // 최종 접수 처리
      return handleSubmitRequest(data);
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "잘못된 action입니다. action=setStatus, action=parse 또는 action=submit이 필요합니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log("요청 처리 오류:", error);
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "fail",
        message: "요청 처리 중 오류가 발생했습니다: " + error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// 처리상태 설정 함수 (구글 폼 제출 후 "파싱 처리 전" 상태로 설정)
function handleSetStatus(data) {
  try {
    Logger.log("=== 처리상태 설정 ===");
    const contractNo = data.contractNo || "";
    const content = data.content || "";
    const status = data.status || "파싱 처리 전";

    if (!contractNo || !content) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "계약번호와 배차 요청 내용이 필요합니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 설문지 응답 시트에서 해당 행 찾기 및 처리상태 업데이트
    const spreadsheet = getSpreadsheet();
    const responseSheet = spreadsheet.getSheetByName("설문지 응답");
    
    if (!responseSheet) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "설문지 응답 시트를 찾을 수 없습니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const headerRow = responseSheet
      .getRange(1, 1, 1, responseSheet.getLastColumn())
      .getValues()[0];
    const getColIndex = (name) =>
      headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
    
    const contractNoIdx = getColIndex("운송계약번호");
    const contentIdx = getColIndex("배차 요청 내용");
    
    // 최신 행부터 역순으로 검색하여 일치하는 행 찾기
    const lastRow = responseSheet.getLastRow();
    let foundRow = -1;
    
    for (let i = lastRow; i > 1; i--) {
      const rowData = responseSheet.getRange(i, 1, 1, responseSheet.getLastColumn()).getValues()[0];
      const rowContractNo = contractNoIdx > -1 ? (rowData[contractNoIdx] || "").toString().trim() : "";
      const rowContent = contentIdx > -1 ? (rowData[contentIdx] || "").toString().trim() : "";
      
      if (rowContractNo === contractNo.toString().trim() && 
          rowContent === content.toString().trim()) {
        foundRow = i;
        break;
      }
    }
    
    if (foundRow > 0) {
      updateFormResponseStatus(responseSheet, foundRow, status);
      Logger.log("설문지 응답 시트 처리상태 업데이트: " + status + " (행 " + foundRow + ")");
      
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          message: "처리상태가 업데이트되었습니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    } else {
      Logger.log("설문지 응답 시트에서 해당 행을 찾을 수 없습니다.");
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "설문지 응답 시트에서 해당 행을 찾을 수 없습니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log("처리상태 설정 오류:", error);
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "fail",
        message: "처리상태 설정 중 오류가 발생했습니다: " + error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// 파싱 요청 처리 함수 (시트 저장 없이 파싱만 수행)
function handleParseRequest(data) {
  try {
    Logger.log("=== 파싱 요청 처리 ===");
    const contractNo = data.contractNo || "";
    const content = data.content || "";

    if (!content || content.trim() === "") {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "배차 요청 내용이 없습니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 설문지 응답 시트에서 해당 행 찾기 및 처리상태 업데이트
    try {
      const spreadsheet = getSpreadsheet();
      const responseSheet = spreadsheet.getSheetByName("설문지 응답");
      
      if (responseSheet) {
        const headerRow = responseSheet
          .getRange(1, 1, 1, responseSheet.getLastColumn())
          .getValues()[0];
        const getColIndex = (name) =>
          headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
        
        const contractNoIdx = getColIndex("운송계약번호");
        const contentIdx = getColIndex("배차 요청 내용");
        
        // 최신 행부터 역순으로 검색하여 일치하는 행 찾기
        const lastRow = responseSheet.getLastRow();
        let foundRow = -1;
        
        for (let i = lastRow; i > 1; i--) {
          const rowData = responseSheet.getRange(i, 1, 1, responseSheet.getLastColumn()).getValues()[0];
          const rowContractNo = contractNoIdx > -1 ? (rowData[contractNoIdx] || "").toString().trim() : "";
          const rowContent = contentIdx > -1 ? (rowData[contentIdx] || "").toString().trim() : "";
          
          if (rowContractNo === contractNo.toString().trim() && 
              rowContent === content.toString().trim()) {
            foundRow = i;
            break;
          }
        }
        
        if (foundRow > 0) {
          updateFormResponseStatus(responseSheet, foundRow, "파싱 처리 완료, 검토 중");
          Logger.log("설문지 응답 시트 처리상태 업데이트: 파싱 처리 완료, 검토 중 (행 " + foundRow + ")");
        } else {
          Logger.log("설문지 응답 시트에서 해당 행을 찾을 수 없습니다.");
        }
      }
    } catch (statusError) {
      Logger.log("처리상태 업데이트 중 오류 (무시하고 계속):", statusError);
    }

    // 파싱 수행 (시트 저장 없이)
    const parsedData = parseTransportRequest(content, contractNo);
    Logger.log("파싱 결과:", parsedData);

    // 파싱 결과를 배열로 변환 (시트 헤더 순서에 맞춤)
    const headers = [
      "No.",
      "운송계약번호*",
      "고객사명",
      "운송단가번호",
      "상차일자*",
      "하차일자*",
      "상차지명*",
      "상차지주소*",
      "하차지명*",
      "하차지주소*",
      "운송사명",
      "운송사코드*",
      "온도구분",
      "운송조건*",
      "톤수",
      "요청톤수*",
      "차량번호",
      "기사명",
      "기사님연락처",
      "운송매출*",
      "기타매출",
      "운송비용*",
      "기타비용",
      "담당자명",
      "담당자연락처",
      "비고",
    ];

    // 파싱된 데이터를 헤더 순서에 맞춰 배열로 변환
    const parsedArray = [
      "", // No. (빈 값)
      parsedData.운송계약번호 || "",
      parsedData.고객사명 || "",
      "", // 운송단가번호
      parsedData.상차일자 || "",
      parsedData.하차일자 || "",
      parsedData.상차지명 || "",
      parsedData.상차지주소 || "",
      parsedData.하차지명 || "",
      parsedData.하차지주소 || "",
      "", // 운송사명
      "", // 운송사코드*
      "", // 온도구분
      "", // 운송조건*
      "", // 톤수
      parsedData.요청톤수 || "",
      "", // 차량번호
      "", // 기사명
      "", // 기사님연락처
      "", // 운송매출*
      "", // 기타매출
      "", // 운송비용*
      "", // 기타비용
      parsedData.담당자명 || "",
      parsedData.담당자연락처 || "",
      parsedData.비고 || "",
    ];

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        data: {
          headers: headers,
          row: parsedArray,
          parsedData: parsedData, // 원본 파싱 데이터도 함께 반환 (디버깅용)
        },
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("파싱 요청 처리 오류:", error);
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "fail",
        message: "파싱 중 오류가 발생했습니다: " + error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// 최종 접수 처리 함수 (파싱된 데이터를 시트에 저장)
function handleSubmitRequest(data) {
  try {
    Logger.log("=== 최종 접수 요청 처리 ===");
    // 파싱된 데이터 배열 받기
    const rowData = data.rowData || [];
    const timestamp = data.timestamp || new Date();

    if (!rowData || rowData.length === 0) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "fail",
          message: "저장할 데이터가 없습니다.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 시트에 저장
    const spreadsheet = getSpreadsheet();
    let parsedSheet = spreadsheet.getSheetByName("파싱결과");

    // 파싱결과 시트가 없으면 생성
    if (!parsedSheet) {
      parsedSheet = spreadsheet.insertSheet("파싱결과");

      // 헤더 설정
      const headers = [
        "No.",
        "운송계약번호*",
        "고객사명",
        "운송단가번호",
        "상차일자*",
        "하차일자*",
        "상차지명*",
        "상차지주소*",
        "하차지명*",
        "하차지주소*",
        "운송사명",
        "운송사코드*",
        "온도구분",
        "운송조건*",
        "톤수",
        "요청톤수*",
        "차량번호",
        "기사명",
        "기사님연락처",
        "운송매출*",
        "기타매출",
        "운송비용*",
        "기타비용",
        "담당자명",
        "담당자연락처",
        "비고",
      ];

      parsedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      parsedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }

    // No. 생성
    const lastRow = parsedSheet.getLastRow();
    const nextNo = lastRow > 0 ? lastRow : 1;

    // No.를 첫 번째 열에 추가
    const finalRowData = [nextNo, ...rowData.slice(1)];

    // 새 행 추가
    parsedSheet.appendRow(finalRowData);
    Logger.log("최종 접수 저장 완료:", nextNo);

    // 설문지 응답 시트에서 해당 행 찾기 및 처리상태 업데이트
    try {
      const responseSheet = spreadsheet.getSheetByName("설문지 응답");
      
      if (responseSheet) {
        const headerRow = responseSheet
          .getRange(1, 1, 1, responseSheet.getLastColumn())
          .getValues()[0];
        const getColIndex = (name) =>
          headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
        
        const contractNoIdx = getColIndex("운송계약번호");
        
        // rowData에서 운송계약번호 가져오기 (헤더 순서: No., 운송계약번호*, ...)
        const contractNo = rowData.length > 1 ? (rowData[1] || "").toString().trim() : "";
        
        if (contractNo && contractNoIdx > -1) {
          // 최신 행부터 역순으로 검색하여 일치하는 행 찾기
          const lastRow = responseSheet.getLastRow();
          let foundRow = -1;
          
          for (let i = lastRow; i > 1; i--) {
            const rowData = responseSheet.getRange(i, 1, 1, responseSheet.getLastColumn()).getValues()[0];
            const rowContractNo = (rowData[contractNoIdx] || "").toString().trim();
            
            if (rowContractNo === contractNo) {
              foundRow = i;
              break;
            }
          }
          
          if (foundRow > 0) {
            updateFormResponseStatus(responseSheet, foundRow, "검토 완료");
            Logger.log("설문지 응답 시트 처리상태 업데이트: 검토 완료 (행 " + foundRow + ")");
          } else {
            Logger.log("설문지 응답 시트에서 해당 행을 찾을 수 없습니다. (계약번호: " + contractNo + ")");
          }
        }
      }
    } catch (statusError) {
      Logger.log("처리상태 업데이트 중 오류 (무시하고 계속):", statusError);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        message: "접수가 완료되었습니다.",
        no: nextNo,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("최종 접수 처리 오류:", error);
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "fail",
        message: "접수 중 오류가 발생했습니다: " + error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

