// ============================================
// 배차 요청 자동화 시스템 - 구글 폼 응답 처리 (LLM 파싱 모드 지원)
// ============================================

// 구글 시트 ID (실제 시트 ID로 변경 필요)
const SPREADSHEET_ID = "1A5GeS6NFPRjbQD_-jDOBjqb9spohEPG3DVoOuQGwrAg";

// ============================================
// 파싱 모드 설정
// ============================================
// "KEYWORD": 키워드 기반 파싱 (기본값, 빠르고 무료)
// "LLM": LLM 기반 파싱 (OpenAI 또는 Google Gemini, 더 정확하지만 API 비용 발생)
const PARSING_MODE = "KEYWORD"; // "KEYWORD" 또는 "LLM"

// ============================================
// LLM 설정
// ============================================
// OpenAI API 사용 시
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"; // OpenAI API 키 입력
const OPENAI_MODEL = "gpt-4o-mini"; // 또는 "gpt-3.5-turbo", "gpt-4" 등

// Google Gemini API 사용 시 (선택사항)
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Gemini API 키 입력
const USE_GEMINI = false; // true로 설정하면 Gemini 사용, false면 OpenAI 사용 
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
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    for (let keyword of keywords) {
      // 키워드가 포함된 줄 찾기 (대소문자 구분 없이)
      const keywordLower = keyword.toLowerCase();
      const lineLower = line.toLowerCase();
      
      if (!lineLower.includes(keywordLower)) continue;

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

// 날짜 파싱 함수 (다양한 형식 지원)
function parseDate(text, keywords) {
  const dateStr = extractValue(text, keywords);
  if (!dateStr) return "";

  // 날짜 형식 정규화
  // 25.05.27, 2025.05.26, 5/27, 5월 27일 등 다양한 형식 처리
  const patterns = [
    /(\d{2})\.(\d{2})\.(\d{2})/, // 25.05.27
    /(\d{4})\.(\d{2})\.(\d{2})/, // 2025.05.26
    /(\d{1,2})\/(\d{1,2})/, // 5/27
    /(\d{1,2})월\s*(\d{1,2})일/, // 5월 27일
    /(\d{4})-(\d{2})-(\d{2})/, // 2025-05-26
  ];

  for (let pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      let year, month, day;

      if (match.length === 3) {
        // 5/27 형식
        const currentYear = new Date().getFullYear();
        year = currentYear;
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

      return `${year}-${month}-${day}`;
    }
  }

  // 시간 정보만 있는 경우 (오늘, 내일 등)
  if (dateStr.includes("금일") || dateStr.includes("오늘")) {
    const today = new Date();
    return Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  if (dateStr.includes("익일") || dateStr.includes("내일")) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return dateStr;
}

// 주소 추출 함수 (상차지/하차지) - 개선: 다양한 형식 지원
function extractAddress(text, keywords) {
  if (!text) return "";

  // 여러 줄에 걸친 주소 처리
  const lines = text.split("\n");
  let addressLines = [];
  let foundKeyword = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // 키워드가 있는 줄 찾기
    if (!foundKeyword) {
      for (let keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        const lineLower = line.toLowerCase();
        
        if (lineLower.includes(keywordLower)) {
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
    const fullAddress = addressLines.join(" ").trim();
    // 주소와 업체명이 함께 있는 경우 분리
    const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)\s*(.+)?/;
    const match = fullAddress.match(addressPattern);
    
    if (match) {
      return match[1].trim();
    }
    
    return fullAddress;
  }

  // extractValue로 한 번 더 시도
  const addressStr = extractValue(text, keywords);
  if (!addressStr) return "";

  // 기존 로직 (단일 줄 처리)
  const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)\s*(.+)?/;
  const match = addressStr.match(addressPattern);
  
  if (match) {
    return match[1].trim();
  }

  return addressStr.trim();
}

// 업체명 추출 함수
function extractCompanyName(text, keywords) {
  const fullStr = extractValue(text, keywords);
  if (!fullStr) return "";

  // 주소와 업체명이 함께 있는 경우
  // 주소 부분을 제거하고 업체명만 추출
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

// 연락처 추출 함수 (전화번호)
function extractPhone(text, keywords) {
  const phoneStr = extractValue(text, keywords);
  if (!phoneStr) return "";

  // 전화번호 패턴 추출
  const phonePattern = /(\d{2,3}-\d{3,4}-\d{4}|\d{10,11})/;
  const match = phoneStr.match(phonePattern);
  
  if (match) {
    return match[1];
  }

  // 이름과 함께 있는 경우
  const namePhonePattern = /([가-힣\s]+)[:：]?\s*(\d{2,3}-\d{3,4}-\d{4}|\d{10,11})/;
  const nameMatch = phoneStr.match(namePhonePattern);
  
  if (nameMatch) {
    return nameMatch[2];
  }

  return phoneStr.trim();
}

// 담당자명 추출 함수
function extractContactName(text, keywords) {
  const contactStr = extractValue(text, keywords);
  if (!contactStr) return "";

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

  return contactStr.trim();
}

// 톤수 추출 함수
function extractTonnage(text, keywords) {
  const tonnageStr = extractValue(text, keywords);
  if (!tonnageStr) return "";

  // 톤수 패턴 추출
  const patterns = [
    /(\d+(?:\.\d+)?)\s*[톤tT]/,
    /(\d+(?:\.\d+)?)\s*톤/,
    /(\d+)\s*파[렛레]트/,
    /(\d+(?:\.\d+)?)\s*[톤tT]\s*[이상이하]/,
  ];

  for (let pattern of patterns) {
    const match = tonnageStr.match(pattern);
    if (match) {
      return match[1] + (tonnageStr.includes("톤") ? "톤" : "");
    }
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

  // 상차지 주소 추출 (다양한 키워드 지원: 상차지 = 출발지 = 상차지명)
  result.상차지주소 = extractAddress(text, [
    "상차지주소 및 업체명",
    "상차지 주소",
    "상차지주소",
    "상차지",
    "출발지",    // 추가
    "출",        // 추가
    "상차지 주소 :",
    "상차지명",  // 추가 (상차지명에서 주소 추출)
  ]);

  // 상차지명 추출 (다양한 키워드 지원)
  result.상차지명 = extractCompanyName(text, [
    "상차지주소 및 업체명",
    "상차지 업체명",
    "상차지명",
    "상차지",    // 추가
    "출발지",    // 추가
    "출",        // 추가
  ]);

  // 하차지 주소 추출 (다양한 키워드 지원: 하차지 = 도착지 = 착지 = 하차지명)
  result.하차지주소 = extractAddress(text, [
    "하차지 업체명 / 주소",
    "하차지 주소",
    "하차지주소",
    "하차지",
    "도착지",    // 추가
    "착",        // 추가
    "착지",      // 추가
    "하차지 주소:",
    "하차지명",  // 추가 (하차지명에서 주소 추출)
  ]);

  // 하차지명 추출 (다양한 키워드 지원)
  result.하차지명 = extractCompanyName(text, [
    "하차지 업체명 / 주소",
    "하차지 업체명",
    "하차지명",
    "하차지",    // 추가
    "도착지",    // 추가
    "착",        // 추가
    "착지",      // 추가
  ]);

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

  // 담당자명 추출 (상차지 또는 하차지)
  const 상차담당자 = extractContactName(text, [
    "상차 담당자 / 연락처",
    "상차지 담당자",
    "상차 담당자",
    "담당자",
    "상차지 담당자 / 연락처",
  ]);

  const 하차담당자 = extractContactName(text, [
    "하차지 담당자 / 연락처",
    "하차지 담당자",
    "하차 담당자",
    "담당cl",
    "하차지 담당자 연락처",
  ]);

  result.담당자명 = 하차담당자 || 상차담당자 || "";

  // 담당자 연락처 추출
  const 상차연락처 = extractPhone(text, [
    "상차 담당자 / 연락처",
    "상차지 담당자 / 연락처",
    "상차 담당자",
  ]);

  const 하차연락처 = extractPhone(text, [
    "하차지 담당자 / 연락처",
    "하차지 담당자",
    "하차 담당자",
    "담당cl",
    "하차지 담당자 연락처",
  ]);

  result.담당자연락처 = 하차연락처 || 상차연락처 || "";

  // 비고 추출 (특이사항, 비고 등)
  const 비고키워드 = [
    "비고",
    "특이사항",
    "기타",
    "요청사항",
    "수작업유무",
    "※",
  ];
  
  // 여러 줄에 걸친 비고 추출
  const lines = text.split("\n");
  let 비고모음 = [];
  let 비고시작 = false;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // 비고 키워드가 있는 줄부터 시작
    if (비고키워드.some(kw => line.includes(kw))) {
      비고시작 = true;
      const extracted = extractValue(line, 비고키워드);
      if (extracted) 비고모음.push(extracted);
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

  // 고객사명 추출 (업체명, 고객사명 등)
  result.고객사명 = extractValue(text, [
    "업체명",
    "고객사명",
    "고객사",
  ]);

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

// 원본 데이터 처리 함수 (파싱 모드에 따라 분기)
function processRawData(content, contractNo, timestamp, sourceRow, sourceSheet) {
  try {
    Logger.log("=== 배차 요청 데이터 처리 시작 ===");
    Logger.log("원본 텍스트:", content);
    Logger.log("계약번호:", contractNo);
    Logger.log("파싱 모드:", PARSING_MODE);

    if (!content || content.trim() === "") {
      Logger.log("배차 요청 내용이 없어서 처리 중단");
      if (sourceRow && sourceSheet) {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리오류");
      }
      return;
    }

    // 파싱 모드에 따라 분기
    let parsedData;
    if (PARSING_MODE === "LLM") {
      Logger.log("LLM 파싱 모드 사용");
      parsedData = parseTransportRequestWithLLM(content, contractNo);
    } else {
      Logger.log("키워드 기반 파싱 모드 사용");
      parsedData = parseTransportRequest(content, contractNo);
    }
    
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

// ============================================
// LLM 기반 파싱 함수
// ============================================

// LLM을 사용하여 배차 요청 텍스트 파싱
function parseTransportRequestWithLLM(text, contractNo) {
  try {
    Logger.log("=== LLM 기반 배차 요청 텍스트 파싱 시작 ===");
    Logger.log("원본 텍스트:", text);

    // LLM 프롬프트 생성
    const prompt = createParsingPrompt(text, contractNo);
    
    // LLM 호출
    let llmResponse;
    if (USE_GEMINI) {
      llmResponse = callGeminiAPI(prompt);
    } else {
      llmResponse = callOpenAIAPI(prompt);
    }

    if (!llmResponse) {
      Logger.log("LLM 응답이 없어서 키워드 기반 파싱으로 폴백");
      return parseTransportRequest(text, contractNo);
    }

    // LLM 응답 파싱
    const parsedData = parseLLMResponse(llmResponse, contractNo);
    Logger.log("LLM 파싱 결과:", parsedData);
    
    return parsedData;
  } catch (error) {
    Logger.log("LLM 파싱 오류:", error);
    Logger.log("키워드 기반 파싱으로 폴백");
    // 오류 발생 시 키워드 기반 파싱으로 폴백
    return parseTransportRequest(text, contractNo);
  }
}

// LLM 파싱용 프롬프트 생성
function createParsingPrompt(text, contractNo) {
  return `다음 배차 요청 텍스트를 분석하여 JSON 형식으로 구조화된 데이터를 추출해주세요.

배차 요청 텍스트:
"""
${text}
"""

다음 필드들을 추출하여 JSON 형식으로 반환해주세요:
- 운송계약번호: ${contractNo || ""}
- 고객사명: 업체명, 고객사명 등
- 상차일자: 상차일, 상차일자, 배차일자, 배차일 등 (YYYY-MM-DD 형식으로 변환)
- 하차일자: 하차일, 하차일자, 하차일 등 (YYYY-MM-DD 형식으로 변환)
- 상차지명: 상차지명, 상차지 업체명, 출발지 업체명 등
- 상차지주소: 상차지 주소, 출발지 주소, 상차지, 출 등
- 하차지명: 하차지명, 하차지 업체명, 도착지 업체명, 착지 업체명 등
- 하차지주소: 하차지 주소, 도착지 주소, 하차지, 도착지, 착, 착지 등
- 요청톤수: 요청톤수, 차량톤수, 톤수, 차량 톤수 등
- 담당자명: 담당자 이름 (하차지 담당자 우선, 없으면 상차지 담당자)
- 담당자연락처: 담당자 전화번호 (하차지 담당자 연락처 우선, 없으면 상차지 담당자 연락처)
- 비고: 비고, 특이사항, 기타, 요청사항, 수작업유무 등

주의사항:
1. 날짜는 반드시 YYYY-MM-DD 형식으로 변환 (예: 25.05.27 → 2025-05-27, 5/27 → 2025-05-27)
2. 주소와 업체명이 함께 있는 경우 분리
3. 전화번호는 숫자와 하이픈만 포함
4. 값이 없으면 빈 문자열("")로 반환
5. 반드시 유효한 JSON 형식으로만 응답 (설명 없이 JSON만)

JSON 형식:
{
  "운송계약번호": "",
  "고객사명": "",
  "상차일자": "",
  "하차일자": "",
  "상차지명": "",
  "상차지주소": "",
  "하차지명": "",
  "하차지주소": "",
  "요청톤수": "",
  "담당자명": "",
  "담당자연락처": "",
  "비고": ""
}`;
}

// OpenAI API 호출
function callOpenAIAPI(prompt) {
  try {
    Logger.log("OpenAI API 호출 시작");
    
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_OPENAI_API_KEY") {
      throw new Error("OpenAI API 키가 설정되지 않았습니다.");
    }

    const url = "https://api.openai.com/v1/chat/completions";
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 배차 요청 텍스트를 구조화된 JSON 데이터로 변환하는 전문가입니다. 항상 유효한 JSON 형식만 반환합니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    };

    const options = {
      method: "post",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log("OpenAI API 응답 코드:", responseCode);
    Logger.log("OpenAI API 응답:", responseText);

    if (responseCode !== 200) {
      throw new Error("OpenAI API 오류: " + responseText);
    }

    const responseData = JSON.parse(responseText);
    const content = responseData.choices[0].message.content;
    
    Logger.log("OpenAI 파싱된 응답:", content);
    return content;
  } catch (error) {
    Logger.log("OpenAI API 호출 오류:", error);
    return null;
  }
}

// Google Gemini API 호출
function callGeminiAPI(prompt) {
  try {
    Logger.log("Gemini API 호출 시작");
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
      throw new Error("Gemini API 키가 설정되지 않았습니다.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    };

    const options = {
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log("Gemini API 응답 코드:", responseCode);
    Logger.log("Gemini API 응답:", responseText);

    if (responseCode !== 200) {
      throw new Error("Gemini API 오류: " + responseText);
    }

    const responseData = JSON.parse(responseText);
    const content = responseData.candidates[0].content.parts[0].text;
    
    Logger.log("Gemini 파싱된 응답:", content);
    return content;
  } catch (error) {
    Logger.log("Gemini API 호출 오류:", error);
    return null;
  }
}

// LLM 응답 파싱 (JSON 추출)
function parseLLMResponse(llmResponse, contractNo) {
  try {
    Logger.log("LLM 응답 파싱 시작");
    
    // JSON 추출 (마크다운 코드 블록 제거)
    let jsonText = llmResponse.trim();
    
    // ```json 또는 ```로 감싸진 경우 제거
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, "");
    jsonText = jsonText.replace(/\s*```$/i, "");
    
    // JSON 파싱
    const parsed = JSON.parse(jsonText);
    
    // 결과 객체 생성
    const result = {
      운송계약번호: parsed.운송계약번호 || contractNo || "",
      고객사명: parsed.고객사명 || "",
      상차일자: parsed.상차일자 || "",
      하차일자: parsed.하차일자 || "",
      상차지명: parsed.상차지명 || "",
      상차지주소: parsed.상차지주소 || "",
      하차지명: parsed.하차지명 || "",
      하차지주소: parsed.하차지주소 || "",
      요청톤수: parsed.요청톤수 || "",
      담당자명: parsed.담당자명 || "",
      담당자연락처: parsed.담당자연락처 || "",
      비고: parsed.비고 || "",
    };
    
    Logger.log("LLM 응답 파싱 완료:", result);
    return result;
  } catch (error) {
    Logger.log("LLM 응답 파싱 오류:", error);
    Logger.log("원본 응답:", llmResponse);
    throw error;
  }
}

// 전체 설정 함수
function initialize() {
  try {
    Logger.log("=== 시스템 초기화 시작 ===");
    Logger.log("파싱 모드:", PARSING_MODE);
    setupFormResponseTrigger();
    initializeFormResponseSheet();
    Logger.log("=== 시스템 초기화 완료 ===");
  } catch (error) {
    Logger.log("초기화 오류:", error);
  }
}

