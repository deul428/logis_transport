// ============================================
// 배차 요청 자동화 시스템 - 구글 폼 응답 처리
// ============================================

// 구글 시트 ID (실제 시트 ID로 변경 필요)
const SPREADSHEET_ID = "1A5GeS6NFPRjbQD_-jDOBjqb9spohEPG3DVoOuQGwrAg"; 
// 특정 스프레드시트 사용
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// 트리거 설정 함수 - 설문지 응답 시트 변경 감지
function setupFormResponseTrigger() {
  try {
    console.log("=== 구글 폼 응답 트리거 설정 시작 ===");

    const spreadsheet = getSpreadsheet();

    // 기존 트리거 삭제
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      ScriptApp.deleteTrigger(trigger);
      console.log("기존 트리거 삭제됨");
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

    console.log("새 구글 폼 응답 트리거 설정 완료!");
    console.log("대상 스프레드시트:", spreadsheet.getName());
  } catch (error) {
    console.error("트리거 설정 오류:", error);
  }
}

// 구글 폼 제출 이벤트 처리 함수
function onFormSubmit(e) {
  try {
    console.log("=== 구글 폼 제출 이벤트 감지 ===");

    if (!e || !e.range) {
      console.log("이벤트 정보 없음");
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();

    console.log("폼 제출된 시트:", sheetName);
    console.log("제출된 행:", row);

    // "설문지 응답" 시트의 새 응답 처리
    if (sheetName === "설문지 응답") {
      console.log("설문지 응답 감지, 처리 시작");
      processFormResponse(sheet, row);
    }
  } catch (error) {
    console.error("폼 제출 이벤트 처리 오류:", error);
  }
}

// 편집 이벤트 처리 함수 (백업용)
function onFormResponseEdit(e) {
  try {
    console.log("=== 편집 이벤트 감지 ===");

    if (!e || !e.range) {
      console.log("이벤트 정보 없음");
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    console.log("편집된 시트:", sheetName);
    console.log("편집된 범위:", e.range.getA1Notation());

    // "설문지 응답" 시트의 배차 요청 내용 편집만 처리
    if (sheetName === "설문지 응답") {
      const row = e.range.getRow();

      // 헤더 행은 제외
      if (row === 1) {
        console.log("헤더 행 편집, 무시");
        return;
      }

      console.log("배차 요청 내용 편집 감지, 행:", row);
      processFormResponse(sheet, row);
    }
  } catch (error) {
    console.error("편집 이벤트 처리 오류:", error);
  }
}

// 구글 폼 응답 처리 함수
function processFormResponse(sheet, row) {
  try {
    console.log("=== 구글 폼 응답 처리 시작 ===");
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

    console.log("응답 데이터:", rowData);

    // 각 열 데이터 추출
    const timestamp = timestampIdx > -1 ? rowData[timestampIdx] : "";
    const contractNo = contractNoIdx > -1 ? rowData[contractNoIdx] : "";
    const content = contentIdx > -1 ? rowData[contentIdx] : "";
    const status = statusIdx > -1 ? rowData[statusIdx] : "";

    console.log("계약번호:", contractNo);
    console.log("배차 요청 내용:", content);

    // 배차 요청 내용이 있는 경우만 처리
    if (!content || content.toString().trim() === "") {
      console.log("배차 요청 내용이 없어서 처리 중단");
      return;
    }

    // 처리상태 컬럼이 있다면 업데이트
    if (statusIdx > -1) {
      sheet.getRange(row, statusIdx + 1).setValue("처리중");
    }

    // 파싱 및 처리
    processRawData(content.toString(), contractNo.toString(), timestamp, row, sheet);
  } catch (error) {
    console.error("구글 폼 응답 처리 오류:", error);

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
      console.error("처리상태 업데이트 오류:", updateError);
    }
  }
}

// 키워드 기반 값 추출 함수
function extractValue(text, keywords) {
  if (!text) return "";

  const lines = text.split("\n");
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    for (let keyword of keywords) {
      // 다양한 패턴 시도
      const patterns = [
        new RegExp(keyword + "\\s*[:：]\\s*(.+)", "i"),
        new RegExp(keyword + "\\s*[:：]\\s*", "i"),
        new RegExp("\\*" + keyword + "\\s*[:：]\\s*(.+)", "i"),
        new RegExp(keyword + "\\s+(.+)", "i"),
      ];

      for (let pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let value = match[1] || "";
          value = value.trim();
          
          // 다음 줄까지 포함하는 경우 처리
          if (value === "" && line.includes(keyword)) {
            // 현재 줄 다음 줄 확인
            const currentIndex = lines.indexOf(line);
            if (currentIndex < lines.length - 1) {
              const nextLine = lines[currentIndex + 1].trim();
              if (nextLine && !nextLine.includes(":")) {
                value = nextLine;
              }
            }
          }
          
          return value;
        }
      }

      // 콜론 없이 키워드만 있는 경우
      if (line.includes(keyword) && !line.includes(":")) {
        const parts = line.split(keyword);
        if (parts.length > 1) {
          const value = parts[1].trim();
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

// 주소 추출 함수 (상차지/하차지)
function extractAddress(text, keywords) {
  const addressStr = extractValue(text, keywords);
  if (!addressStr) return "";

  // 여러 줄에 걸친 주소 처리
  const lines = text.split("\n");
  let addressLines = [];
  let foundKeyword = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 키워드가 있는 줄 찾기
    if (!foundKeyword) {
      for (let keyword of keywords) {
        if (line.includes(keyword)) {
          foundKeyword = true;
          // 콜론 뒤의 내용 추출
          const colonIndex = line.indexOf(":");
          if (colonIndex > -1) {
            const afterColon = line.substring(colonIndex + 1).trim();
            if (afterColon) addressLines.push(afterColon);
          }
          // 다음 줄도 확인
          if (i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.includes(":")) {
              addressLines.push(nextLine);
            }
          }
          break;
        }
      }
    } else {
      // 키워드 이후 연속된 주소 줄들
      if (line.match(/[가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)/)) {
        addressLines.push(line);
      } else if (line.match(/^[가-힣\s]+$/)) {
        // 한글로만 이루어진 줄도 주소로 간주 (업체명일 수 있음)
        addressLines.push(line);
      } else {
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
  console.log("=== 배차 요청 텍스트 파싱 시작 ===");
  console.log("원본 텍스트:", text);

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

  // 상차일자 추출
  result.상차일자 = parseDate(text, [
    "상차일 및 상차시간",
    "상차일",
    "상차일자",
    "상차 시간",
    "상차일 및 하차시간",
  ]);

  // 하차일자 추출
  result.하차일자 = parseDate(text, [
    "하차일 및 하차시간",
    "하차일",
    "하차일자",
    "하차 시간",
    "도착",
    "착",
  ]);

  // 상차지 주소 추출 (다양한 키워드 지원)
  result.상차지주소 = extractAddress(text, [
    "상차지주소 및 업체명",
    "상차지 주소",
    "상차지주소",
    "상차지",
    "출발지",
    "출",
    "상차지 주소 :",
  ]);

  // 상차지명 추출
  result.상차지명 = extractCompanyName(text, [
    "상차지주소 및 업체명",
    "상차지 업체명",
    "상차지명",
  ]);

  // 하차지 주소 추출
  result.하차지주소 = extractAddress(text, [
    "하차지 업체명 / 주소",
    "하차지 주소",
    "하차지주소",
    "하차지",
    "도착지",
    "착",
    "하차지 주소:",
  ]);

  // 하차지명 추출
  result.하차지명 = extractCompanyName(text, [
    "하차지 업체명 / 주소",
    "하차지 업체명",
    "하차지명",
  ]);

  // 요청톤수 추출 (다양한 형식 지원)
  result.요청톤수 = extractTonnage(text, [
    "요청톤수(차량길이 및 총 중량)",
    "요청톤수",
    "요청대수",
    "차량",
    "톤수",
    "요청차량대수",
    "요청톤수(차량길이)",
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

  console.log("파싱 결과:", result);
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
    console.log("파싱 결과 저장 완료:", nextNo);

    return true;
  } catch (error) {
    console.error("파싱 결과 저장 오류:", error);
    return false;
  }
}

// 원본 데이터 처리 함수
function processRawData(content, contractNo, timestamp, sourceRow, sourceSheet) {
  try {
    console.log("=== 배차 요청 데이터 처리 시작 ===");
    console.log("원본 텍스트:", content);
    console.log("계약번호:", contractNo);

    if (!content || content.trim() === "") {
      console.log("배차 요청 내용이 없어서 처리 중단");
      if (sourceRow && sourceSheet) {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리오류");
      }
      return;
    }

    // 텍스트 파싱
    const parsedData = parseTransportRequest(content, contractNo);
    console.log("파싱 결과:", parsedData);

    // 파싱 결과 시트에 저장
    const insertResult = insertToParsedSheet(parsedData, timestamp);
    
    if (insertResult) {
      console.log("파싱 결과 저장 완료");
      
      // 처리상태 업데이트
      if (sourceRow && sourceSheet) {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리완료");
        console.log("처리상태 업데이트: 처리완료");
      }
    } else {
      throw new Error("파싱 결과 저장 실패");
    }

    console.log("=== 모든 처리 완료 ===");
  } catch (error) {
    console.error("처리 오류:", error);
    console.error("오류 스택:", error.stack);

    // 오류 발생 시 처리상태 업데이트
    if (sourceRow && sourceSheet) {
      try {
        updateFormResponseStatus(sourceSheet, sourceRow, "처리오류");
        console.log("처리상태 업데이트: 처리오류");
      } catch (updateError) {
        console.error("처리상태 업데이트 실패:", updateError);
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
      console.log("처리상태 컬럼 추가 및 상태 업데이트:", status);
    } else {
      sheet.getRange(row, statusIdx + 1).setValue(status);
      console.log("처리상태 업데이트:", status);
    }
  } catch (error) {
    console.error("처리상태 업데이트 오류:", error);
  }
}

// 수동 처리 함수 - 설문지 응답 시트 대상
function processAllFormResponses() {
  try {
    console.log("=== 모든 설문지 응답 처리 시작 ===");

    const spreadsheet = getSpreadsheet();
    const responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      console.error("설문지 응답 시트를 찾을 수 없습니다!");
      return;
    }

    const data = responseSheet.getDataRange().getValues();
    console.log("총 응답 행 수:", data.length);

    let processedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const rowData = data[i];
      const timestamp = rowData[0]; // 타임스탬프
      const contractNo = rowData[1] || ""; // 운송계약번호
      const content = rowData[2] || ""; // 배차 요청 내용
      const processStatus = rowData[3] || ""; // 처리상태

      if (content && content.toString().trim() && processStatus !== "처리완료") {
        console.log(`행 ${i + 1} 처리 중...`);
        processFormResponse(responseSheet, i + 1);
        processedCount++;
      }
    }

    console.log(`=== 처리 완료: ${processedCount}건 ===`);
  } catch (error) {
    console.error("일괄 처리 오류:", error);
  }
}

// 테스트 함수 - 특정 행 처리
function testSpecificFormResponse(rowNumber) {
  try {
    console.log("=== 특정 설문지 응답 테스트 ===");

    const spreadsheet = getSpreadsheet();
    const responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      console.error("설문지 응답 시트를 찾을 수 없습니다!");
      return;
    }

    const lastColumn = responseSheet.getLastColumn();
    const rowData = responseSheet
      .getRange(rowNumber, 1, 1, lastColumn)
      .getValues()[0];

    console.log("테스트 데이터:", rowData);

    if (rowData[2] && rowData[2].toString().trim()) {
      processFormResponse(responseSheet, rowNumber);
    } else {
      console.log("배차 요청 내용이 없습니다.");
    }
  } catch (error) {
    console.error("특정 행 테스트 오류:", error);
  }
}

// 설문지 응답 시트 초기화 함수 (처리상태 컬럼 추가)
function initializeFormResponseSheet() {
  try {
    const spreadsheet = getSpreadsheet();
    let responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      console.log(
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
      console.log("처리상태 컬럼 추가 완료");
      
      // 기존 데이터가 있으면 처리상태를 "대기"로 설정
      const lastRow = responseSheet.getLastRow();
      if (lastRow > 1) {
        for (let i = 2; i <= lastRow; i++) {
          const existingStatus = responseSheet.getRange(i, lastColumn + 1).getValue();
          if (!existingStatus || existingStatus === "") {
            responseSheet.getRange(i, lastColumn + 1).setValue("대기");
          }
        }
        console.log(`기존 ${lastRow - 1}개 행에 처리상태 설정 완료`);
      }
    } else {
      console.log("처리상태 컬럼이 이미 존재합니다.");
    }
  } catch (error) {
    console.error("설문지 응답 시트 초기화 오류:", error);
  }
}

// 전체 설정 함수
function initialize() {
  try {
    console.log("=== 시스템 초기화 시작 ===");
    setupFormResponseTrigger();
    initializeFormResponseSheet();
    console.log("=== 시스템 초기화 완료 ===");
  } catch (error) {
    console.error("초기화 오류:", error);
  }
}

