// ============================================
// 배차 요청 자동화 시스템 - 멀티 필드 파싱 버전
// ============================================

// 구글 시트 ID (실제 시트 ID로 변경 필요)
const SPREADSHEET_ID = "1BBO3LI1gL5S9oM754Nbnc6RuRmR0h5VWm0C-WEgR1JA";
// const SPREADSHEET_ID = "1A5GeS6NFPRjbQD_-jDOBjqb9spohEPG3DVoOuQGwrAg"; 

// 특정 스프레드시트 사용
function getSpreadsheet() { 
  Logger.log("getSpreadsheet:",SpreadsheetApp.openById(SPREADSHEET_ID).getName())
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

    // "설문지 응답" 시트의 편집만 처리
    if (sheetName === "설문지 응답") {
      const row = e.range.getRow();

      // 헤더 행은 제외
      if (row === 1) {
        Logger.log("헤더 행 편집, 무시");
        return;
      }

      Logger.log("설문지 응답 편집 감지, 행:", row);
      processFormResponse(sheet, row);
    }
  } catch (error) {
    Logger.log("편집 이벤트 처리 오류:", error);
  }
}

// 날짜/시간 문자열 파싱 함수 (예: "2025. 11. 14 오전 9:00:00")
function parseDateTimeString(dateTimeStr) {
  try {
    if (!dateTimeStr || dateTimeStr.trim() === "") {
      return null;
    }

    // "2025. 11. 14 오전 9:00:00" 형식 파싱
    // 패턴: 년. 월 일 오전/오후 시:분:초
    const pattern = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+(오전|오후)\s+(\d{1,2}):(\d{2}):(\d{2})/;
    const match = dateTimeStr.match(pattern);

    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, "0");
      const day = match[3].padStart(2, "0");
      const ampm = match[4]; // "오전" 또는 "오후"
      let hour = parseInt(match[5], 10);
      const minute = match[6].padStart(2, "0");

      // 오전/오후 처리
      if (ampm === "오후" && hour !== 12) {
        hour += 12;
      } else if (ampm === "오전" && hour === 12) {
        hour = 0;
      }

      return {
        year: year,
        month: month,
        day: day,
        hour: hour.toString().padStart(2, "0"),
        minute: minute
      };
    }

    // 다른 형식 시도 (Date 객체로 변환 가능한 경우)
    const dateObj = new Date(dateTimeStr);
    if (!isNaN(dateObj.getTime())) {
      return {
        year: dateObj.getFullYear().toString(),
        month: (dateObj.getMonth() + 1).toString().padStart(2, "0"),
        day: dateObj.getDate().toString().padStart(2, "0"),
        hour: dateObj.getHours().toString().padStart(2, "0"),
        minute: dateObj.getMinutes().toString().padStart(2, "0")
      };
    }

    Logger.log("날짜/시간 문자열 파싱 실패:", dateTimeStr);
    return null;
  } catch (error) {
    Logger.log("날짜/시간 문자열 파싱 오류:", error);
    return null;
  }
}

// 구글 폼 응답 처리 함수 (멀티 필드 버전)
function processFormResponse(sheet, row) {
  try {
    writeDebugLog("processFormResponse 시작", "행:" + row);
    Logger.log("=== 구글 폼 응답 처리 시작 (멀티 필드) ===");

    // 처리상태 컬럼이 없으면 먼저 추가
    const headerRow = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const getColIndex = (name) =>
      headerRow.findIndex((h) => h && h.toString().trim() === name.trim());
    const statusIdx = getColIndex("처리상태");

    if (statusIdx === -1) {
      // 처리상태 컬럼이 없으면 추가
      const lastColumn = sheet.getLastColumn();
      sheet.getRange(1, lastColumn + 1).setValue("처리상태");
      writeDebugLog("처리상태 컬럼 추가", "컬럼:" + (lastColumn + 1));
      Logger.log("처리상태 컬럼 자동 추가 완료");

      // 기존 데이터가 있으면 처리상태를 "대기"로 설정
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        for (let i = 2; i <= lastRow; i++) {
          const existingStatus = sheet.getRange(i, lastColumn + 1).getValue();
          if (!existingStatus || existingStatus === "") {
            sheet.getRange(i, lastColumn + 1).setValue("대기");
          }
        }
        Logger.log(`기존 ${lastRow - 1}개 행에 처리상태 설정 완료`);
      }
    }

    // 헤더 다시 가져오기 (처리상태 컬럼이 추가되었을 수 있음)
    const updatedHeaderRow = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    Logger.log("헤더:", updatedHeaderRow);
    const getColIndexUpdated = (name) =>
      updatedHeaderRow.findIndex((h) => h && h.toString().trim() === name.trim());

    // 필요한 열 이름 지정 (멀티 필드 버전)
    // 구글 폼의 날짜/시간 필드는 하나의 컬럼으로 저장되거나 분리되어 저장될 수 있음
    const timestampIdx = getColIndexUpdated("타임스탬프");
    const contractNoIdx = getColIndexUpdated("운송계약번호");

    // 날짜/시간 필드 - 분리된 컬럼 시도
    const pickupYearIdx = getColIndexUpdated("상차일 및 상차 시간 (년)");
    const pickupMonthIdx = getColIndexUpdated("상차일 및 상차 시간 (월)");
    const pickupDayIdx = getColIndexUpdated("상차일 및 상차 시간 (일)");
    const pickupHourIdx = getColIndexUpdated("상차일 및 상차 시간 (시)");
    const pickupMinuteIdx = getColIndexUpdated("상차일 및 상차 시간 (분)");

    // 날짜/시간 필드 - 단일 컬럼 시도 (구글 폼 기본 형식)
    const pickupDateTimeIdx = getColIndexUpdated("상차일 및 상차 시간");

    const pickupContactIdx = getColIndexUpdated("상차지 담당자 / 연락처");
    const pickupAddressIdx = getColIndexUpdated("상차지 주소");
    const pickupCompanyIdx = getColIndexUpdated("상차지 업체명");

    // 하차일/시간 필드 - 분리된 컬럼 시도
    const deliveryYearIdx = getColIndexUpdated("하차일 및 하차 시간 (년)");
    const deliveryMonthIdx = getColIndexUpdated("하차일 및 하차 시간 (월)");
    const deliveryDayIdx = getColIndexUpdated("하차일 및 하차 시간 (일)");
    const deliveryHourIdx = getColIndexUpdated("하차일 및 하차 시간 (시)");
    const deliveryMinuteIdx = getColIndexUpdated("하차일 및 하차 시간 (분)");

    // 하차일/시간 필드 - 단일 컬럼 시도 (구글 폼 기본 형식)
    const deliveryDateTimeIdx = getColIndexUpdated("하차일 및 하차 시간");

    const deliveryAddressIdx = getColIndexUpdated("하차지 주소");
    const deliveryCompanyIdx = getColIndexUpdated("하차지 업체명");
    const deliveryContactIdx = getColIndexUpdated("하차지 담당자 / 연락처");
    const tonnageIdx = getColIndexUpdated("요청 톤수 (차량 길이 및 총 중량)");
    const noteIdx = getColIndexUpdated("비고");
    const manualWorkIdx = getColIndexUpdated("수작업 유무");
    const statusIdxUpdated = getColIndexUpdated("처리상태");

    // 응답 데이터 가져오기 (전체 행)
    const lastColumn = sheet.getLastColumn();
    const rowData = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];

    Logger.log("응답 데이터:", rowData);

    // 각 열 데이터 추출
    const timestamp = timestampIdx > -1 ? rowData[timestampIdx] : "";
    const num = contractNoIdx > -1 ? rowData[contractNoIdx] : "";

    // 상차일 및 상차 시간 추출 (분리된 컬럼 또는 단일 컬럼)
    let pickupYear = "";
    let pickupMonth = "";
    let pickupDay = "";
    let pickupHour = "";
    let pickupMinute = "";

    if (pickupYearIdx > -1 && pickupMonthIdx > -1 && pickupDayIdx > -1) {
      // 분리된 컬럼 형식
      pickupYear = rowData[pickupYearIdx] || "";
      pickupMonth = rowData[pickupMonthIdx] || "";
      pickupDay = rowData[pickupDayIdx] || "";
      pickupHour = pickupHourIdx > -1 ? (rowData[pickupHourIdx] || "") : "";
      pickupMinute = pickupMinuteIdx > -1 ? (rowData[pickupMinuteIdx] || "") : "";
    } else if (pickupDateTimeIdx > -1) {
      // 단일 컬럼 형식 (날짜/시간 객체 또는 문자열 파싱)
      const pickupDateTime = rowData[pickupDateTimeIdx];
      if (pickupDateTime instanceof Date) {
        // Date 객체인 경우
        pickupYear = pickupDateTime.getFullYear().toString();
        pickupMonth = (pickupDateTime.getMonth() + 1).toString();
        pickupDay = pickupDateTime.getDate().toString();
        pickupHour = pickupDateTime.getHours().toString();
        pickupMinute = pickupDateTime.getMinutes().toString();
      } else if (pickupDateTime && pickupDateTime.toString) {
        // 문자열 형식인 경우 (예: "2025. 11. 14 오전 9:00:00")
        const parsed = parseDateTimeString(pickupDateTime.toString());
        if (parsed) {
          pickupYear = parsed.year;
          pickupMonth = parsed.month;
          pickupDay = parsed.day;
          pickupHour = parsed.hour;
          pickupMinute = parsed.minute;
        }
      }
    }

    // 하차일 및 하차 시간 추출 (분리된 컬럼 또는 단일 컬럼)
    let deliveryYear = "";
    let deliveryMonth = "";
    let deliveryDay = "";
    let deliveryHour = "";
    let deliveryMinute = "";

    if (deliveryYearIdx > -1 && deliveryMonthIdx > -1 && deliveryDayIdx > -1) {
      // 분리된 컬럼 형식
      deliveryYear = rowData[deliveryYearIdx] || "";
      deliveryMonth = rowData[deliveryMonthIdx] || "";
      deliveryDay = rowData[deliveryDayIdx] || "";
      deliveryHour = deliveryHourIdx > -1 ? (rowData[deliveryHourIdx] || "") : "";
      deliveryMinute = deliveryMinuteIdx > -1 ? (rowData[deliveryMinuteIdx] || "") : "";
    } else if (deliveryDateTimeIdx > -1) {
      // 단일 컬럼 형식 (날짜/시간 객체 또는 문자열 파싱)
      const deliveryDateTime = rowData[deliveryDateTimeIdx];
      if (deliveryDateTime instanceof Date) {
        // Date 객체인 경우
        deliveryYear = deliveryDateTime.getFullYear().toString();
        deliveryMonth = (deliveryDateTime.getMonth() + 1).toString();
        deliveryDay = deliveryDateTime.getDate().toString();
        deliveryHour = deliveryDateTime.getHours().toString();
        deliveryMinute = deliveryDateTime.getMinutes().toString();
      } else if (deliveryDateTime && deliveryDateTime.toString) {
        // 문자열 형식인 경우 (예: "2025. 11. 14 오전 9:00:00")
        const parsed = parseDateTimeString(deliveryDateTime.toString());
        if (parsed) {
          deliveryYear = parsed.year;
          deliveryMonth = parsed.month;
          deliveryDay = parsed.day;
          deliveryHour = parsed.hour;
          deliveryMinute = parsed.minute;
        }
      }
    }

    // 기타 필드
    const pickupContact = pickupContactIdx > -1 ? rowData[pickupContactIdx] : "";
    const pickupAddress = pickupAddressIdx > -1 ? rowData[pickupAddressIdx] : "";
    const pickupCompany = pickupCompanyIdx > -1 ? rowData[pickupCompanyIdx] : "";
    const deliveryAddress = deliveryAddressIdx > -1 ? rowData[deliveryAddressIdx] : "";
    const deliveryCompany = deliveryCompanyIdx > -1 ? rowData[deliveryCompanyIdx] : "";
    const deliveryContact = deliveryContactIdx > -1 ? rowData[deliveryContactIdx] : "";
    const tonnage = tonnageIdx > -1 ? rowData[tonnageIdx] : "";
    const note = noteIdx > -1 ? rowData[noteIdx] : "";
    const manualWork = manualWorkIdx > -1 ? rowData[manualWorkIdx] : "";

    Logger.log("계약번호:", num);
    Logger.log("상차일:", pickupYear, pickupMonth, pickupDay, pickupHour, pickupMinute);
    Logger.log("하차일:", deliveryYear, deliveryMonth, deliveryDay, deliveryHour, deliveryMinute);

    // 필수 필드 확인 (상차일, 하차일, 하차지 주소)
    if (!pickupYear || !pickupMonth || !pickupDay) {
      Logger.log("상차일 정보가 없어서 처리 중단");
      if (statusIdxUpdated > -1) {
        sheet.getRange(row, statusIdxUpdated + 1).setValue("처리오류");
      } else {
        updateFormResponseStatus(sheet, row, "처리오류");
      }
      return;
    }

    if (!deliveryYear || !deliveryMonth || !deliveryDay) {
      Logger.log("하차일 정보가 없어서 처리 중단");
      if (statusIdxUpdated > -1) {
        sheet.getRange(row, statusIdxUpdated + 1).setValue("처리오류");
      } else {
        updateFormResponseStatus(sheet, row, "처리오류");
      }
      return;
    }

    if (!deliveryAddress || deliveryAddress.toString().trim() === "") {
      Logger.log("하차지 주소가 없어서 처리 중단");
      if (statusIdxUpdated > -1) {
        sheet.getRange(row, statusIdxUpdated + 1).setValue("처리오류");
      } else {
        updateFormResponseStatus(sheet, row, "처리오류");
      }
      return;
    }

    if (!deliveryCompany || deliveryCompany.toString().trim() === "") {
      Logger.log("하차지 업체명이 없어서 처리 중단");
      if (statusIdxUpdated > -1) {
        sheet.getRange(row, statusIdxUpdated + 1).setValue("처리오류");
      } else {
        updateFormResponseStatus(sheet, row, "처리오류");
      }
      return;
    }

    // 처리상태 컬럼이 있으면 "처리중"으로 업데이트 (이미 추가되었으므로 항상 존재)
    if (statusIdxUpdated > -1) {
      sheet.getRange(row, statusIdxUpdated + 1).setValue("처리중");
    } else {
      updateFormResponseStatus(sheet, row, "처리중");
    }

    // 멀티 필드 데이터 파싱 및 처리
    writeDebugLog("processMultiFieldData 호출 전", "계약번호:" + num);
    processMultiFieldData(
      {
        num: num ? num.toString() : "",
        pickupYear: pickupYear ? pickupYear.toString() : "",
        pickupMonth: pickupMonth ? pickupMonth.toString() : "",
        pickupDay: pickupDay ? pickupDay.toString() : "",
        pickupHour: pickupHour ? pickupHour.toString() : "",
        pickupMinute: pickupMinute ? pickupMinute.toString() : "",
        pickupContact: pickupContact ? pickupContact.toString() : "",
        pickupAddress: pickupAddress ? pickupAddress.toString() : "",
        pickupCompany: pickupCompany ? pickupCompany.toString() : "",
        deliveryYear: deliveryYear ? deliveryYear.toString() : "",
        deliveryMonth: deliveryMonth ? deliveryMonth.toString() : "",
        deliveryDay: deliveryDay ? deliveryDay.toString() : "",
        deliveryHour: deliveryHour ? deliveryHour.toString() : "",
        deliveryMinute: deliveryMinute ? deliveryMinute.toString() : "",
        deliveryAddress: deliveryAddress ? deliveryAddress.toString() : "",
        deliveryCompany: deliveryCompany ? deliveryCompany.toString() : "",
        deliveryContact: deliveryContact ? deliveryContact.toString() : "",
        tonnage: tonnage ? tonnage.toString() : "",
        note: note ? note.toString() : "",
        manualWork: manualWork ? manualWork.toString() : "",
      },
      timestamp,
      row,
      sheet
    );
    writeDebugLog("processMultiFieldData 호출 완료", "");
  } catch (error) {
    Logger.log("구글 폼 응답 처리 오류:", error);
    Logger.log("오류 스택:", error.stack);

    // 오류 발생 시 처리상태 업데이트
    try {
      updateFormResponseStatus(sheet, row, "처리오류");
    } catch (updateError) {
      Logger.log("처리상태 업데이트 오류:", updateError);
    }
  }
}

// 멀티 필드 데이터 파싱 함수
function parseMultiFieldData(fieldData) {
  Logger.log("=== 멀티 필드 데이터 파싱 시작 ===");
  Logger.log("필드 데이터:", fieldData);

  // 날짜 형식 변환 (YYYY-MM-DD HH:mm)
  const formatDateTime = (year, month, day, hour, minute) => {
    if (!year || !month || !day) return "";
    const yearStr = year.toString().padStart(4, "0");
    const monthStr = month.toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const hourStr = hour ? hour.toString().padStart(2, "0") : "00";
    const minuteStr = minute ? minute.toString().padStart(2, "0") : "00";
    return `${yearStr}-${monthStr}-${dayStr} ${hourStr}:${minuteStr}`;
  };

  // 상차일자 (시간 포함)
  const pickupDate = formatDateTime(
    fieldData.pickupYear,
    fieldData.pickupMonth,
    fieldData.pickupDay,
    fieldData.pickupHour || "",
    fieldData.pickupMinute || ""
  );

  // 하차일자 (시간 포함)
  const deliveryDate = formatDateTime(
    fieldData.deliveryYear,
    fieldData.deliveryMonth,
    fieldData.deliveryDay,
    fieldData.deliveryHour || "",
    fieldData.deliveryMinute || ""
  );

  // 상차지 주소 및 업체명 (이미 분리된 필드에서 직접 가져오기)
  const pickupAddress = fieldData.pickupAddress || "";
  const pickupCompany = fieldData.pickupCompany || "";

  // 하차지 주소 및 업체명 (이미 분리된 필드에서 직접 가져오기)
  const deliveryAddress = fieldData.deliveryAddress || "";
  const deliveryCompany = fieldData.deliveryCompany || "";

  // 담당자명 및 연락처 분리
  const pickupContactParts = extractContactAndPhone(fieldData.pickupContact || "");
  const deliveryContactParts = extractContactAndPhone(fieldData.deliveryContact || "");

  // 담당자명 (하차지 우선, 없으면 상차지)
  const 담당자명 = deliveryContactParts.name || pickupContactParts.name || "";

  // 담당자 연락처 (하차지 우선, 없으면 상차지)
  const 담당자연락처 = deliveryContactParts.phone || pickupContactParts.phone || "";

  const result = {
    운송계약번호: fieldData.num || "",
    고객사명: "",
    상차일자: pickupDate,
    하차일자: deliveryDate,
    상차지명: pickupCompany || "",
    상차지주소: pickupAddress || "",
    하차지명: deliveryCompany || "",
    하차지주소: deliveryAddress || "",
    요청톤수: fieldData.tonnage || "",
    담당자명: 담당자명,
    담당자연락처: 담당자연락처,
    비고: fieldData.note || "",
    수작업유무: fieldData.manualWork || "",
  };

  Logger.log("파싱 결과:", result);
  return result;
}

// 주소와 업체명 분리 함수
function extractAddressAndCompany(fullText) {
  if (!fullText || fullText.trim() === "") {
    return { address: "", company: "" };
  }

  const text = fullText.toString().trim();

  // 주소 패턴 (시/도, 군/구, 읍/면, 동/리, 로/길, 번지 등)
  const addressPattern = /([가-힣\s\d\-\.]+(?:시|도|군|구|읍|면|동|리|로|길|번지|번길)[가-힣\s\d\-\.]*)/;
  const match = text.match(addressPattern);

  if (match) {
    const address = match[1].trim();
    const afterAddress = text.substring(match.index + match[0].length).trim();
    const company = afterAddress || "";

    return { address: address, company: company };
  }

  // 주소 패턴이 없으면 전체를 주소로, 업체명은 빈 값
  return { address: text, company: "" };
}

// 담당자명과 연락처 분리 함수
function extractContactAndPhone(fullText) {
  if (!fullText || fullText.trim() === "") {
    return { name: "", phone: "" };
  }

  const text = fullText.toString().trim();

  // 전화번호 패턴
  const phonePattern = /(\d{2,3}-\d{3,4}-\d{4}|\d{10,11})/;
  const phoneMatch = text.match(phonePattern);

  let phone = "";
  let name = "";

  if (phoneMatch) {
    phone = phoneMatch[1];
    // 전화번호 앞부분이 이름
    const namePart = text.substring(0, phoneMatch.index).trim();
    // 이름 패턴 추출 (한글 이름)
    const namePattern = /([가-힣]{2,4})\s*(?:사원|과장|대리|차장|부장|대표|님)?/;
    const nameMatch = namePart.match(namePattern);

    if (nameMatch) {
      name = nameMatch[1];
    } else {
      // 패턴이 없으면 공백으로 분리된 첫 번째 부분
      const parts = namePart.split(/\s+/);
      if (parts.length > 0) {
        name = parts[0];
      }
    }
  } else {
    // 전화번호가 없으면 전체를 이름으로
    name = text;
  }

  return { name: name.trim(), phone: phone };
}

// 멀티 필드 데이터 처리 함수
function processMultiFieldData(fieldData, timestamp, sourceRow, sourceSheet) {
  try {
    writeDebugLog("processMultiFieldData 시작", "sourceRow:" + sourceRow);
    Logger.log("=== 멀티 필드 데이터 처리 시작 ===");
    Logger.log("필드 데이터:", fieldData);

    // 멀티 필드 파싱
    const parsedData = parseMultiFieldData(fieldData);
    writeDebugLog("파싱 완료", "운송계약번호:" + (parsedData.운송계약번호 || "없음"));
    Logger.log("파싱 결과:", parsedData);

    // 파싱 결과 시트에 저장
    writeDebugLog("insertToParsedSheet 호출", "");

 

    const insertResult = insertToParsedSheet(parsedData, timestamp);
    writeDebugLog("insertToParsedSheet 결과", insertResult ? "성공" : "실패");

    if (insertResult) {
      Logger.log("파싱 결과 저장 완료");

      // 처리상태 업데이트
      if (sourceRow && sourceSheet) {
        writeDebugLog("처리상태 업데이트", "처리완료");
        updateFormResponseStatus(sourceSheet, sourceRow, "처리완료");
        Logger.log("처리상태 업데이트: 처리완료");
      }
    } else {
      writeDebugLog("파싱 결과 저장 실패", "insertResult가 false");

      throw new Error("파싱 결과 저장 실패");
    }

    writeDebugLog("processMultiFieldData 완료", "성공");
    Logger.log("=== 모든 처리 완료 ===");
  } catch (error) {
    const errorMsg = "오류:" + error.message;
    writeDebugLog("processMultiFieldData 오류", errorMsg);
    Logger.log("처리 오류:", error);
    Logger.log("오류 스택:", error.stack);

    // 오류 발생 시 처리상태 업데이트
    if (sourceRow && sourceSheet) {
      try {
        writeDebugLog("처리상태 업데이트", "처리오류");
        updateFormResponseStatus(sourceSheet, sourceRow, "처리오류");
        Logger.log("처리상태 업데이트: 처리오류");
      } catch (updateError) {
        writeDebugLog("처리상태 업데이트 실패", updateError.message);
        Logger.log("처리상태 업데이트 실패:", updateError);
      }
    }
  }
}

// 디버깅 정보를 시트에 기록하는 함수 (더 안전한 버전)
function writeDebugLog(message, data) {
  try {
    const spreadsheet = getSpreadsheet();
    if (!spreadsheet) {
      Logger.log("스프레드시트를 가져올 수 없음");
      return;
    }

    let debugSheet = spreadsheet.getSheetByName("디버깅");

    if (!debugSheet) {
      try {
        debugSheet = spreadsheet.insertSheet("디버깅");
        if (debugSheet) {
          debugSheet.getRange(1, 1, 1, 3).setValues([["시간", "메시지", "데이터"]]);
          debugSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
        }
      } catch (insertError) {
        Logger.log("디버깅 시트 생성 실패:", insertError);
        return;
      }
    }

    if (!debugSheet) {
      Logger.log("디버깅 시트를 가져올 수 없음");
      return;
    }

    const newRow = debugSheet.getLastRow() + 1;
    const now = new Date();

    // 각 셀에 개별적으로 값 설정 (더 안전)
    try {
      debugSheet.getRange(newRow, 1).setValue(now);
      debugSheet.getRange(newRow, 2).setValue(String(message || ""));
      debugSheet.getRange(newRow, 3).setValue(String(data || ""));
    } catch (setValueError) {
      Logger.log("디버깅 값 설정 실패:", setValueError);
    }

    // 최대 1000행까지만 유지
    if (newRow > 1000) {
      try {
        debugSheet.deleteRow(2);
      } catch (deleteError) {
        // 무시
      }
    }
  } catch (e) {
    // 디버깅 로그 기록 실패는 무시 (무한 루프 방지)
    Logger.log("디버깅 로그 기록 실패:", e);
  }
}

// 파싱 결과를 시트에 저장
function insertToParsedSheet(parsedData, timestamp) {
  try {
    writeDebugLog("insertToParsedSheet 시작", JSON.stringify(parsedData));
    Logger.log("=== insertToParsedSheet 시작 ===");
    Logger.log("파싱된 데이터:", JSON.stringify(parsedData));

    const spreadsheet = getSpreadsheet();
    writeDebugLog("스프레드시트 가져오기 완료", "");
    Logger.log("스프레드시트 가져오기 완료");

    let parsedSheet = spreadsheet.getSheetByName("파싱결과");
    writeDebugLog("파싱결과 시트 확인", parsedSheet ? "존재함" : "없음");
    Logger.log("파싱결과 시트:", parsedSheet ? "존재함" : "없음");

    // 파싱결과 시트가 없으면 생성
    if (!parsedSheet) {
      writeDebugLog("파싱결과 시트 생성 중", "");
      Logger.log("파싱결과 시트 생성 중...");
      parsedSheet = spreadsheet.insertSheet("파싱결과");

      // 헤더 설정 (사용자 제공 컬럼명과 동일)
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
      Logger.log("헤더 설정 완료");

      // 담당자연락처 열(25번째 열, Y열)을 텍스트 형식으로 설정
      parsedSheet.getRange(2, 25, parsedSheet.getMaxRows() - 1, 1).setNumberFormat("@");
    }

    // 기존 데이터 확인하여 No. 생성
    const lastRow = parsedSheet.getLastRow();
    const nextNo = lastRow > 0 ? lastRow : 1;
    writeDebugLog("행 번호 계산", "마지막행:" + lastRow + ", 다음No:" + nextNo);
    Logger.log("마지막 행:", lastRow, "다음 No.:", nextNo);

    // 담당자연락처 값을 텍스트로 강제 (작은따옴표 추가)
    const contactPhoneValue = parsedData.담당자연락처 || "";
    const contactPhoneText = contactPhoneValue ? ("'" + contactPhoneValue) : "";

    // 데이터 행 생성 (사용자 제공 컬럼 순서와 동일)
    const rowData = [
      nextNo, // No.
      parsedData.운송계약번호 || "", // 운송계약번호*
      parsedData.고객사명 || "", // 고객사명
      "", // 운송단가번호
      parsedData.상차일자 || "", // 상차일자*
      parsedData.하차일자 || "", // 하차일자*
      parsedData.상차지명 || "", // 상차지명* (상차지 업체명)
      parsedData.상차지주소 || "", // 상차지주소*
      parsedData.하차지명 || "", // 하차지명* (하차지 업체명)
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
      contactPhoneText, // 담당자연락처 (텍스트 형식으로 강제)
      parsedData.비고 || "", // 비고
    ];

    writeDebugLog("저장할 데이터 준비", "배열길이:" + rowData.length + ", 첫번째값:" + rowData[0]);
    Logger.log("저장할 데이터:", JSON.stringify(rowData));
    Logger.log("데이터 배열 길이:", rowData.length);

    // 새 행 추가 (appendRow 대신 getRange와 setValues 사용 - 더 안정적)
    const newRow = lastRow + 1;
    writeDebugLog("새 행 번호 계산", "newRow:" + newRow);
    Logger.log("새 행 번호:", newRow);

    // 데이터 범위 설정 및 값 저장
    const targetRange = parsedSheet.getRange(newRow, 1, 1, rowData.length);
    writeDebugLog("데이터 저장 시도", "범위:" + targetRange.getA1Notation());

    targetRange.setValues([rowData]);
    writeDebugLog("데이터 저장 완료", "행:" + newRow);
    Logger.log("데이터 저장 완료 - 행:", newRow);

    // 저장 확인
    const savedValue = parsedSheet.getRange(newRow, 1).getValue();
    writeDebugLog("저장 확인", "저장된값:" + savedValue);

    // 담당자연락처 열(25번째 열, Y열)의 형식을 텍스트로 설정
    if (contactPhoneValue) {
      Logger.log("담당자연락처 셀 형식 설정 중...");
      const contactPhoneCell = parsedSheet.getRange(newRow, 25);
      contactPhoneCell.setNumberFormat("@");
      Logger.log("담당자연락처 셀 형식 설정 완료");
    }

    writeDebugLog("insertToParsedSheet 성공", "No:" + nextNo);
    Logger.log("파싱 결과 저장 완료 - No.:", nextNo);
    Logger.log("=== insertToParsedSheet 완료 ===");

    return true;
  } catch (error) {
    const errorMsg = "오류:" + error.message + " / 스택:" + error.stack;
    writeDebugLog("!!!!! insertToParsedSheet 오류 !!!!!", errorMsg);
    Logger.log("!!!!! 파싱 결과 저장 오류 !!!!!");
    Logger.log("오류 메시지:", error.message);
    Logger.log("오류 스택:", error.stack);
    return false;
  }
}

// 처리상태 업데이트 함수
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
    Logger.log("=== 모든 설문지 응답 처리 시작 (멀티 필드) ===");

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

    const statusIdx = getColIndex("처리상태");

    const data = responseSheet.getDataRange().getValues();
    Logger.log("총 응답 행 수:", data.length);

    let processedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const processStatus = statusIdx > -1 ? (data[i][statusIdx] || "") : "";

      // 처리완료가 아닌 경우만 처리
      if (processStatus !== "처리완료") {
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
    Logger.log("=== 특정 설문지 응답 테스트 (멀티 필드) ===");

    const spreadsheet = getSpreadsheet();
    const responseSheet = spreadsheet.getSheetByName("설문지 응답");

    if (!responseSheet) {
      Logger.log("설문지 응답 시트를 찾을 수 없습니다!");
      return;
    }

    processFormResponse(responseSheet, rowNumber);
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
    Logger.log("=== 시스템 초기화 시작 (멀티 필드) ===");
    setupFormResponseTrigger();
    initializeFormResponseSheet();
    Logger.log("=== 시스템 초기화 완료 ===");
  } catch (error) {
    Logger.log("초기화 오류:", error);
  }
}

