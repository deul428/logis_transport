import React, { useState } from "react";
import "../../App.scss";
// @ts-ignore
import ci from "../../assets/img/logo.svg";
import "../../assets/styles/user.scss";

// 프록시 API URL (실제 배포된 Cloudflare Workers URL로 변경 필요)
const API_URL = "https://bold-bush-a524.kkhhsq.workers.dev";

// 구글 폼 URL (실제 구글 폼 URL로 변경 필요)
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScA2dkb98csveUfwS4c0mHAII8CeAJNKZTR14T-PHto3oV7iw/formResponse";

// 구글 폼 entry ID (실제 구글 폼의 entry ID로 변경 필요)
const FORM_ENTRY_CONTRACT_NO = "entry.1733144004"; // 운송계약번호
const FORM_ENTRY_CONTENT = "entry.157193723"; // 배차 요청 내용

interface ParsedData {
  headers: string[];
  row: string[];
  parsedData?: any;
}

const User01Calc = () => {
  const [loading, setLoading] = useState(false);
  const [num, setNum] = useState("");
  const [content, setContent] = useState(`상차일 및 상차시간 : 
상차지 담당자 / 연락처 : 
상차지 주소 / 업체명 :  

하차일 및 하차시간 : 
하차지 담당자 / 연락처 : 
하차지 주소 / 업체명 :   

요청톤수(차량길이 및 총 중량) :  
요청차량대수 :  
수작업유무 Y/N : `);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [editableRow, setEditableRow] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shouldShowResultArea = !isSubmitted && Boolean(parsedData);
  const isResultPanelVisible = loading || shouldShowResultArea;
  const isSubmissionResultVisible = isSubmitted;

  // 구글 폼 제출 후 파싱 요청
  const handleParse = async () => {
    if (!num.trim()) {
      alert("운송 계약 번호를 입력해주세요.");
      return;
    }

    if (!content.trim()) {
      alert("배차 요청 내용을 입력해 주세요.");
      return;
    }

    try {
      setIsParsing(true);
      setLoading(true);

      // 1단계: 구글 폼에 제출 (트리거 활성화를 위해)
      const formData = new FormData();
      formData.append(FORM_ENTRY_CONTRACT_NO, num);
      formData.append(FORM_ENTRY_CONTENT, content);

      // 구글 폼 제출 (no-cors 모드로 응답은 받지 않음)
      // 트리거가 나중에 실행될 수 있으므로 제출만 하고 넘어감
      await fetch(GOOGLE_FORM_URL, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });

      // 1-1단계: 구글 폼 제출 후 처리상태를 "파싱 처리 전"으로 설정
      // 약간의 지연을 두어 구글 폼 응답이 시트에 저장될 시간을 줌
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const statusPayload = {
          mode: "transport",
          action: "setStatus",
          contractNo: num,
          content: content,
          status: "파싱 처리 전",
        };

        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(statusPayload),
        });
      } catch (statusErr) {
        // 상태 설정 실패해도 파싱은 계속 진행
        console.error("처리상태 설정 오류:", statusErr);
      }

      // 2단계: 프록시를 통해 파싱 요청

      const payload = {
        mode: "transport",
        action: "parse",
        contractNo: num,
        content: content,
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.status === "success" && result.data) {
        setParsedData(result.data);
        setEditableRow([...result.data.row]); // 수정 가능한 복사본 생성
      } else {
        alert("파싱 실패: " + (result.message || "알 수 없는 오류"));
      }
    } catch (err) {
      alert("파싱 중 오류가 발생했습니다. 관리자에게 문의해 주세요.");
      console.error(err);
    } finally {
      setIsParsing(false);
      setLoading(false);
    }
  };

  // 필드 값 변경 핸들러
  const handleFieldChange = (index: number, value: string) => {
    const newRow = [...editableRow];
    newRow[index] = value;
    setEditableRow(newRow);
  };

  // 최종 접수 제출
  const handleSubmit = async () => {
    if (!parsedData) {
      alert("파싱된 데이터가 없습니다. 먼저 파싱을 진행해주세요.");
      return;
    }

    if (!window.confirm("접수를 완료하시겠습니까?")) {
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        mode: "transport",
        action: "submit",
        rowData: editableRow,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.status === "success") {
        alert("접수가 완료되었습니다. (No: " + result.no + ")");
        setIsSubmitted(true);
      } else {
        alert("접수 실패: " + (result.message || "알 수 없는 오류"));
      }
    } catch (err) {
      alert("접수 중 오류가 발생했습니다. 관리자에게 문의해 주세요.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setContent(`상차일 및 상차시간 : 
상차지 담당자 / 연락처 : 
상차지 주소 / 업체명 :  

하차일 및 하차시간 : 
하차지 담당자 / 연락처 : 
하차지 주소 / 업체명 :   

요청톤수(차량길이 및 총 중량) :  
요청차량대수 :  
수작업유무 Y/N : `);
    setIsSubmitted(false);
    setParsedData(null);
    setEditableRow([]);
  };

  return (
    <div className="wrap">
      <div id="user" className="user_03">
        <div
          className={`cntnt_box ${isResultPanelVisible ? "show_parsed" : ""} ${
            isSubmissionResultVisible ? "show_resulted" : ""
          }`}
        >
          <div id="submit_area">
            <div className="user_header">
              <div className="ci_box">
                <img className="ci" src={ci} alt="AJ 로고" />
              </div>
              <h2>AJ네트웍스 운송 계산기</h2>
            </div>
            {/* 입력 폼 */}
            {!isSubmitted && (
              <div id="input_area">
                <form
                  id="customForm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleParse();
                  }}
                >
                  <div className="input_field">
                    <label>운송 계약 번호</label>
                    <input
                      type="text"
                      value={num}
                      onChange={(e) => setNum(e.target.value)}
                      placeholder="운송 계약 번호 입력"
                    />
                  </div>

                  <div className="input_field">
                    <label>배차 요청 내용</label>
                    <textarea
                      name="content"
                      rows={10}
                      placeholder={`배차 요청 내용 기재`}
                      // value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>

                  <button type="submit" disabled={isParsing}>
                    {isParsing ? "자동 인식 중..." : "자동 인식 하기"}
                  </button>
                </form>
              </div>
            )}
          </div>
          {/* 파싱 결과 표시 및 수정 영역 */}
          <div
            id="parsed_area"
            className="card"
            style={{ display: isResultPanelVisible ? "block" : "none" }}
          >
            {loading && (
              <div className="loader_area">
                <span className="spinner" />
                <p>자동 인식 결과를 불러오는 중입니다...</p>
              </div>
            )}
            {!loading && shouldShowResultArea && parsedData && (
              <div className="parsed_box">
                <div className="user_header">
                  <h2>자동 인식 결과</h2>
                  <h4>필요 시 수정 가능</h4>
                </div>
                <div className="field_box">
                  {parsedData.headers.map((header, index) => {
                    /* // No. 필드는 수정 불가
                  if (index === 0) {
                    return (
                      <div key={index} className="rows">
                        <h3>{header}</h3>
                        <p>{editableRow[index] || ""}</p>
                      </div>
                    );
                  } */
                    return (
                      <div key={index} className="rows">
                        <label>{header}</label>
                        <input
                          type="text"
                          value={editableRow[index] || ""}
                          onChange={(e) =>
                            handleFieldChange(index, e.target.value)
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="btn_set">
                  <button
                    className="danger"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {isSubmitting ? "접수 중..." : "최종 접수하기"}
                  </button>
                  {/*  <button
                    onClick={() => {
                      setParsedData(null);
                      setEditableRow([]);
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button> */}
                </div>
              </div>
            )}
          </div>

          {/* 결과 표시 영역 */}
          <div
            id="result_area"
            style={{ display: isSubmissionResultVisible ? "block" : "none" }}
          >
            <h2>접수가 완료되었습니다.</h2>
            <div id="submittedData" className="card">
              <div className="rows row_01">
                <h3>운송계약번호</h3>
                <p>{num || "미입력"}</p>
              </div>
              <div className="rows row_02">
                <h3>배차 요청 내용</h3>
                <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {content}
                </p>
              </div>
            </div>
            <button id="newResponseLink" onClick={resetForm}>
              신규 접수하기
            </button>
          </div>

          {/* 안내 영역 */}
          {/* {!isSubmitted && !parsedData && (
            <div id="desc_area" className="card">
              <div className="info_box">
                <h3>요청 예시</h3>
                <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {`상차일 및 상차시간 : 25.05.27 (화요일) 
상차지 담당자 / 연락처 : 김아주 / 010-1111-1111
상차지 주소 / 업체명: 경기도 화성시 우정읍 버들로899-87 대림플라텍 
 
하차일 및 하차시간 : 25.05.27 (화요일)
하차지 담당자 / 연락처 : 김아주 / 010-1111-1111
하차지 주소 / 업체명 : 현대케미칼 / 충남 서산시 대산읍 대죽리 642-22

요청톤수(차량길이 및 총 중량) : 2.5톤 6파레트 
요청차량대수 : 8 
수작업유무 Y/N : N`}
                </p>
              </div>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
};

export default User01Calc;
