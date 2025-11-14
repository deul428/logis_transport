import React, { useState, useEffect } from "react";
import "../App.scss";
import "../assets/styles/user.scss";
// @ts-ignore
import ci from "../assets/img/logo.svg";
const User02 = () => {
  const [contractNo, setContractNo] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 구글 폼 필드들
  const [pickupDateTime, setPickupDateTime] = useState(""); // 상차일 및 상차 시간
  const [pickupContact, setPickupContact] = useState(""); // 상차지 담당자 / 연락처
  const [pickupAddress, setPickupAddress] = useState(""); // 상차지 주소 및 업체명
  const [pickupCompany, setPickupCompany] = useState(""); // 상차지 주소 및 업체명
  const [deliveryDateTime, setDeliveryDateTime] = useState(""); // 하차일 및 하차 시간
  const [deliveryAddress, setDeliveryAddress] = useState(""); // 하차지 주소 및 업체명
  const [deliveryCompany, setDeliveryCompany] = useState(""); // 하차지 주소 및 업체명
  const [deliveryContact, setDeliveryContact] = useState(""); // 하차지 담당자 / 연락처
  const [tonnage, setTonnage] = useState(""); // 요청 톤수 (차량 길이 및 총 중량)
  const [note, setNote] = useState(""); // 비고
  const [manualWork, setManualWork] = useState(""); // 수작업 유무

  useEffect(() => {
    // URL에서 계약 번호 파라미터 읽기
    const params = new URLSearchParams(window.location.search);
    const contractNoParam =
      params.get("contractNo") || params.get("contract") || "";

    if (contractNoParam) {
      setContractNo(contractNoParam);
    }

    // 현재 날짜/시간을 기본값으로 설정
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const defaultDateTime = `${year}-${month}-${day} 09:00`;

    setPickupDateTime(defaultDateTime);
    setDeliveryDateTime(defaultDateTime);
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

    if (!pickupDateTime.trim()) {
      alert("상차일 및 상차 시간을 입력해 주세요.");
      return;
    }

    if (!pickupContact.trim()) {
      alert("상차지 담당자 / 연락처를 입력해 주세요.");
      return;
    }

    if (!pickupAddress.trim()) {
      alert("상차지 주소 및 업체명을 입력해 주세요.");
      return;
    }

    if (!deliveryDateTime.trim()) {
      alert("하차일 및 하차 시간을 입력해 주세요.");
      return;
    }

    if (!deliveryAddress.trim()) {
      alert("하차지 주소 및 업체명을 입력해 주세요.");
      return;
    }

    if (!deliveryContact.trim()) {
      alert("하차지 담당자 / 연락처를 입력해 주세요.");
      return;
    }

    if (!tonnage.trim()) {
      alert("요청 톤수를 입력해 주세요.");
      return;
    }

    try {
      const formData = new FormData();

      // 날짜/시간 파싱 (형식: YYYY-MM-DD HH:mm)
      const [pickupDatePart, pickupTimePart] = pickupDateTime.split(" ");
      const [deliveryDatePart, deliveryTimePart] = deliveryDateTime.split(" ");

      if (!pickupDatePart || !pickupTimePart) {
        alert(
          "상차일 및 상차 시간 형식이 올바르지 않습니다. (예: 2025-01-15 09:00)"
        );
        return;
      }

      if (!deliveryDatePart || !deliveryTimePart) {
        alert(
          "하차일 및 하차 시간 형식이 올바르지 않습니다. (예: 2025-01-15 14:00)"
        );
        return;
      }

      const [pickupYear, pickupMonth, pickupDay] = pickupDatePart.split("-");
      const [pickupHour, pickupMin] = pickupTimePart.split(":");
      const [deliveryYear, deliveryMonth, deliveryDay] =
        deliveryDatePart.split("-");
      const [deliveryHour, deliveryMin] = deliveryTimePart.split(":");

      // 운송 계약 번호
      if (contractNo.trim()) {
        formData.append("entry.1027562716", contractNo);
        console.log("계약번호 전송:", contractNo);
      }

      // 상차일 및 상차 시간
      formData.append("entry.1271596132_year", pickupYear);
      formData.append("entry.1271596132_month", pickupMonth);
      formData.append("entry.1271596132_day", pickupDay);
      formData.append("entry.1271596132_hour", pickupHour);
      formData.append("entry.1271596132_minute", pickupMin);

      // 하차일 및 하차 시간
      formData.append("entry.1763213133_year", deliveryYear);
      formData.append("entry.1763213133_month", deliveryMonth);
      formData.append("entry.1763213133_day", deliveryDay);
      formData.append("entry.1763213133_hour", deliveryHour);
      formData.append("entry.1763213133_minute", deliveryMin);

      // 상차지 담당자 / 연락처
      formData.append("entry.1728022117", pickupContact);

      // 상차지 주소
      formData.append("entry.1261066465", pickupAddress);

      // 상차지 업체명
      formData.append("entry.1389425912", pickupCompany);

      // 하차지 주소
      formData.append("entry.2062495282", deliveryAddress);

      // 하차지 업체명
      formData.append("entry.1658634082", deliveryCompany);

      // 하차지 담당자 / 연락처
      formData.append("entry.1497959581", deliveryContact);

      // 요청 톤수 (차량 길이 및 총 중량)
      formData.append("entry.917263861", tonnage);

      // 비고
      formData.append("entry.1332211183", note);

      // 수작업 유무 (구글 폼은 전체 텍스트를 기대함)
      const manualWorkText =
        manualWork === "Y"
          ? "Y (수작업 필요)"
          : manualWork === "N"
          ? "N (수작업 불필요)"
          : "";
      formData.append("entry.331186972", manualWorkText);

      // 구글 폼 URL
      const googleFormUrl =
        "https://docs.google.com/forms/d/e/1FAIpQLSd8LYmQqVd_b7MkyihoIb4eKYlPFBctZeAAVxpgsRsk7KQxuQ/formResponse";

      console.log("제출 URL:", googleFormUrl);

      // FormData 내용 확인
      console.log("=== FormData 내용 ===");
      for (const [key, value] of formData.entries()) {
        console.log(key, ":", value);
      }

      await fetch(googleFormUrl, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });

      console.log("제출 완료 (no-cors 모드로 인해 응답 확인 불가)");

      // no-cors 모드에서는 응답을 확인할 수 없지만,
      // 구글 폼은 일반적으로 성공적으로 제출됨
      setIsSubmitted(true);
    } catch (err) {
      console.error("제출 오류:", err);
      alert("오류가 발생했습니다. 관리자에게 문의해 주세요.");
    }
  };

  const resetForm = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const defaultDateTime = `${year}-${month}-${day} 09:00`;

    setPickupDateTime(defaultDateTime);
    setPickupContact("");
    setPickupAddress("");
    setPickupCompany("");
    setDeliveryDateTime(defaultDateTime);
    setDeliveryAddress("");
    setDeliveryCompany("");
    setDeliveryContact("");
    setTonnage("");
    setNote("");
    setManualWork("");
    setIsSubmitted(false);
  };

  return (
    <div className="wrap">
      <div id="user" className="user_02">
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
                  <label>
                    운송 계약 번호 <span>*</span>
                  </label>
                  <input
                    type="text"
                    value={contractNo}
                    disabled
                    placeholder="자동 기입"
                    style={{
                      backgroundColor: "#f5f5f5",
                      cursor: "not-allowed",
                      color: "#666",
                    }}
                  />
                </div>

                <div className="input_field">
                  <label>
                    상차일 및 상차 시간 <span>*</span>
                  </label>
                  <input
                    type="text"
                    value={pickupDateTime}
                    onChange={(e) => setPickupDateTime(e.target.value)}
                    placeholder="예: 2025-01-15 09:00"
                    required
                  />
                </div>

                <div className="input_field">
                  <label>
                    상차지 담당자 / 연락처 <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ex) 김아주 010-1111-2222"
                    value={pickupContact}
                    onChange={(e) => setPickupContact(e.target.value)}
                    required
                  />
                </div>

                <div className="input_field grid_02">
                  <div>
                    <label>
                      상차지 주소 <span>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ex) 서울시 송파구 정의로8길 9"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>
                      상차지 업체명 <span>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ex) AJ네트웍스"
                      value={pickupCompany}
                      onChange={(e) => setPickupCompany(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input_field">
                  <label>
                    하차일 및 하차 시간 <span>*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryDateTime}
                    onChange={(e) => setDeliveryDateTime(e.target.value)}
                    placeholder="예: 2025-01-15 14:00"
                    required
                  />
                </div>

                <div className="input_field">
                  <label>
                    하차지 담당자 / 연락처 <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ex) 김아주 010-1111-2222"
                    value={deliveryContact}
                    onChange={(e) => setDeliveryContact(e.target.value)}
                    required
                  />
                </div>

                <div className="input_field grid_02">
                  <div>
                    <label>
                      하차지 주소 <span>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ex) 서울시 송파구 정의로8길 9"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>
                      하차지 업체명 <span>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ex) AJ네트웍스"
                      value={deliveryCompany}
                      onChange={(e) => setDeliveryCompany(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input_field">
                  <label>
                    요청 톤수 (차량 길이 및 총 중량) <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ex) 11t(9.6m 이상 6대) / 중량 3.5t"
                    value={tonnage}
                    onChange={(e) => setTonnage(e.target.value)}
                    required
                  />
                </div>

                <div className="input_field">
                  <label>비고</label>
                  <textarea
                    rows={3}
                    placeholder="ex) 특이사항, 요청사항 등"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <div className="input_field">
                  <label>수작업 유무</label>
                  <div className="radio_field">
                    <label>
                      <input
                        type="radio"
                        name="manualWork"
                        value="Y"
                        checked={manualWork === "Y"}
                        onChange={(e) => setManualWork(e.target.value)}
                      />
                      <span>Y (수작업 필요)</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="manualWork"
                        value="N"
                        checked={manualWork === "N"}
                        onChange={(e) => setManualWork(e.target.value)}
                      />
                      <span>N (수작업 불필요)</span>
                    </label>
                  </div>
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
                  <h3>운송 계약 번호</h3>
                  <p>{contractNo || "미입력"}</p>
                </div>
                <div className="rows">
                  <h3>상차일 및 상차 시간</h3>
                  <p>{pickupDateTime || "미입력"}</p>
                </div>
                <div className="rows">
                  <h3>하차일 및 하차 시간</h3>
                  <p>{deliveryDateTime || "미입력"}</p>
                </div>
                {pickupContact && (
                  <div className="rows">
                    <h3>상차지 담당자 / 연락처</h3>
                    <p>{pickupContact}</p>
                  </div>
                )}
                {pickupAddress && (
                  <div className="rows">
                    <h3>상차지 주소 및 업체명</h3>
                    <p>
                      {pickupAddress} {pickupCompany}
                    </p>
                  </div>
                )}
                <div className="rows">
                  <h3>하차지 주소 및 업체명</h3>
                  <p>
                    {deliveryAddress} {deliveryCompany}
                  </p>
                </div>
                {deliveryContact && (
                  <div className="rows">
                    <h3>하차지 담당자 / 연락처</h3>
                    <p>{deliveryContact}</p>
                  </div>
                )}
                {tonnage && (
                  <div className="rows">
                    <h3>요청 톤수</h3>
                    <p>{tonnage}</p>
                  </div>
                )}
                {note && (
                  <div className="rows">
                    <h3>비고</h3>
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {note}
                    </p>
                  </div>
                )}
                {manualWork && (
                  <div className="rows">
                    <h3>수작업 유무</h3>
                    <p>
                      {manualWork === "Y"
                        ? "Y (수작업 필요)"
                        : "N (수작업 불필요)"}
                    </p>
                  </div>
                )}
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
                <h3>사용 안내</h3>
                <p>
                  1. 카카오톡 게시판의 URL로 접속하세요.
                  <br />
                  2. 배차 요청 내용을 입력한 후 제출 버튼을 클릭하세요.
                  <br />
                  <br />
                  문의사항은 담당자에게 연락해 주시기 바랍니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default User02;
