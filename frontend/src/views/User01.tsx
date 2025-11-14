import React, { useState, useEffect } from "react";
import "../App.scss";
// @ts-ignore
import ci from "../assets/img/logo.svg";
import "../assets/styles/user.scss";
const User01 = () => {
  const [contractNo, setContractNo] = useState("");
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

  useEffect(() => {
    // URL에서 계약 번호 파라미터 읽기
    const params = new URLSearchParams(window.location.search);
    const contractNoParam =
      params.get("contractNo") || params.get("contract") || "";

    if (contractNoParam) {
      setContractNo(contractNoParam);
    }
  }, []);

  // 구글 폼 제출
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!contractNo.trim()) {
      alert(
        "계약 번호가 없습니다. URL에 계약 번호를 포함해주세요. (예: ?contractNo=12345)"
      );
      return;
    }

    if (!content.trim()) {
      alert("배차 요청 내용을 입력해 주세요.");
      return;
    }

    try {
      const formData = new FormData();
      // 계약 번호 필드 (구글 폼의 entry ID로 변경 필요)
      formData.append("entry.1271596132", contractNo);
      // 배차 요청 내용 필드 (구글 폼의 entry ID로 변경 필요)
      formData.append("entry.1285765036", content);

      // 구글 폼 URL (실제 구글 폼 URL로 변경 필요)
      const googleFormUrl =
        "https://docs.google.com/forms/d/e/1FAIpQLSepUaIyU7xQX5y7V2-OXf7BZamqW1xnarS4jM8SswiHX2m2rA/formResponse";

      await fetch(googleFormUrl, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });

      setIsSubmitted(true);
    } catch (err) {
      alert("오류가 발생했습니다. 관리자에게 문의해 주세요.");
      console.error(err);
    }
  };

  const resetForm = () => {
    setContent("");
    setIsSubmitted(false);
  };

  return (
    <div className="wrap">
      <div id="user" className="user_01">
        <div className="cntnt_box">
          <div className="user_header">
            <h2>AJ네트웍스 배차 요청</h2>
            <img className="ci" src={ci} alt="AJ 로고" />
          </div>

          {/* 입력 폼 */}
          {!isSubmitted && (
            <div id="input_area">
              <form id="customForm" onSubmit={handleSubmit}>
                <div className="input_field">
                  <label>운송 계약 번호</label>
                  <input
                    type="text"
                    value={contractNo}
                    disabled
                    placeholder="자동 기입"
                  />
                </div>

                <div className="input_field">
                  <label>배차 요청 내용</label>
                  <textarea
                    name="content"
                    rows={12}
                    placeholder={`배차 요청 내용 기재`}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <button type="submit">제출하기</button>
              </form>
            </div>
          )}

          {/* 결과 표시 영역 */}
          {isSubmitted && (
            <div id="result_area">
              <h2>접수가 완료되었습니다.</h2>
              <div id="submittedData" className="card">
                <div className="rows row_01">
                  <h3>운송계약번호</h3>
                  <p>{contractNo || "미입력"}</p>
                </div>
                <div className="rows row_02">
                  <h3>배차 요청 내용</h3>
                  <p
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {content}
                  </p>
                </div>
              </div>
              <button id="newResponseLink" onClick={resetForm}>
                신규 접수하기
              </button>
            </div>
          )}

          {/* 안내 영역 */}
          {!isSubmitted && (
            <div id="desc_area" className="card">
              <div className="info_box">
                <h3>요청 예시</h3>
                <p>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default User01;
