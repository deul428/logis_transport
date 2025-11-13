import React, { useState, useEffect } from "react";
import "../App.scss";
import "../assets/styles/user.scss";
import ci from "../assets/img/logo.svg";
const User02 = () => {
  const [contractNo, setContractNo] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 상차일 및 상차 시간
  const [pickupYear, setPickupYear] = useState("");
  const [pickupMonth, setPickupMonth] = useState("");
  const [pickupDay, setPickupDay] = useState("");
  const [pickupHour, setPickupHour] = useState("");
  const [pickupMinute, setPickupMinute] = useState("");

  // 하차일 및 하차 시간
  const [deliveryYear, setDeliveryYear] = useState("");
  const [deliveryMonth, setDeliveryMonth] = useState("");
  const [deliveryDay, setDeliveryDay] = useState("");
  const [deliveryHour, setDeliveryHour] = useState("");
  const [deliveryMinute, setDeliveryMinute] = useState("");

  // 기타 필드
  const [pickupContact, setPickupContact] = useState(""); // 상차지 담당자 / 연락처
  const [pickupAddress, setPickupAddress] = useState(""); // 상차지 주소 및 업체명
  const [deliveryAddress, setDeliveryAddress] = useState(""); // 하차지 주소 및 업체명
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

    // 현재 날짜를 기본값으로 설정
    const now = new Date();
    setPickupYear(now.getFullYear().toString());
    setPickupMonth(String(now.getMonth() + 1).padStart(2, "0"));
    setPickupDay(String(now.getDate()).padStart(2, "0"));
    setPickupHour("09");
    setPickupMinute("00");

    setDeliveryYear(now.getFullYear().toString());
    setDeliveryMonth(String(now.getMonth() + 1).padStart(2, "0"));
    setDeliveryDay(String(now.getDate()).padStart(2, "0"));
    setDeliveryHour("09");
    setDeliveryMinute("00");
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

    try {
      const formData = new FormData();

      // 상차일 및 상차 시간
      formData.append("entry.1271596132_year", pickupYear);
      formData.append("entry.1271596132_month", pickupMonth);
      formData.append("entry.1271596132_day", pickupDay);
      formData.append("entry.1271596132_hour", pickupHour);
      formData.append("entry.1271596132_minute", pickupMinute);

      // 하차일 및 하차 시간
      formData.append("entry.1763213133_year", deliveryYear);
      formData.append("entry.1763213133_month", deliveryMonth);
      formData.append("entry.1763213133_day", deliveryDay);
      formData.append("entry.1763213133_hour", deliveryHour);
      formData.append("entry.1763213133_minute", deliveryMinute);

      // 기타 필드
      formData.append("entry.1728022117", pickupContact);
      formData.append("entry.1261066465", pickupAddress);
      formData.append("entry.2062495282", deliveryAddress);
      formData.append("entry.1497959581", deliveryContact);
      formData.append("entry.917263861", tonnage);
      formData.append("entry.1332211183", note);
      formData.append("entry.331186972", manualWork);

      // 구글 폼 URL
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
    setPickupContact("");
    setPickupAddress("");
    setDeliveryAddress("");
    setDeliveryContact("");
    setTonnage("");
    setNote("");
    setManualWork("");
    setIsSubmitted(false);
  };

  // 년도 옵션 생성 (현재 년도 기준 ±2년)
  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    yearOptions.push(i);
  }

  // 월 옵션 생성
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // 일 옵션 생성 (31일까지)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  // 시간 옵션 생성 (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );

  // 분 옵션 생성 (00-59, 5분 단위)
  const minuteOptions = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0")
  );

  return (
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
                <label>운송 계약 번호 <span>*</span></label>
                <input
                  type="text"
                  value={contractNo}
                  disabled
                  placeholder="URL 파라미터에서 자동으로 가져옵니다 (예: ?contractNo=12345)"
                  style={{
                    backgroundColor: "#f5f5f5",
                    cursor: "not-allowed",
                    color: "#666",
                  }}
                />
              </div>

              <div className="input_field">
                <label>상차일 및 상차 시간 <span>*</span></label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={pickupYear}
                    onChange={(e) => setPickupYear(e.target.value)}
                    style={{ padding: "8px", minWidth: "80px" }}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    ))}
                  </select>
                  <select
                    value={pickupMonth}
                    onChange={(e) => setPickupMonth(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {monthOptions.map((month) => (
                      <option key={month} value={String(month).padStart(2, "0")}>
                        {month}월
                      </option>
                    ))}
                  </select>
                  <select
                    value={pickupDay}
                    onChange={(e) => setPickupDay(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {dayOptions.map((day) => (
                      <option key={day} value={String(day).padStart(2, "0")}>
                        {day}일
                      </option>
                    ))}
                  </select>
                  <span style={{ margin: "0 5px" }}>|</span>
                  <select
                    value={pickupHour}
                    onChange={(e) => setPickupHour(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {hourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}시
                      </option>
                    ))}
                  </select>
                  <select
                    value={pickupMinute}
                    onChange={(e) => setPickupMinute(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input_field">
                <label>하차일 및 하차 시간 <span>*</span></label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={deliveryYear}
                    onChange={(e) => setDeliveryYear(e.target.value)}
                    style={{ padding: "8px", minWidth: "80px" }}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    ))}
                  </select>
                  <select
                    value={deliveryMonth}
                    onChange={(e) => setDeliveryMonth(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {monthOptions.map((month) => (
                      <option key={month} value={String(month).padStart(2, "0")}>
                        {month}월
                      </option>
                    ))}
                  </select>
                  <select
                    value={deliveryDay}
                    onChange={(e) => setDeliveryDay(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {dayOptions.map((day) => (
                      <option key={day} value={String(day).padStart(2, "0")}>
                        {day}일
                      </option>
                    ))}
                  </select>
                  <span style={{ margin: "0 5px" }}>|</span>
                  <select
                    value={deliveryHour}
                    onChange={(e) => setDeliveryHour(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {hourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}시
                      </option>
                    ))}
                  </select>
                  <select
                    value={deliveryMinute}
                    onChange={(e) => setDeliveryMinute(e.target.value)}
                    style={{ padding: "8px", minWidth: "70px" }}
                  >
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input_field">
                <label>상차지 담당자 / 연락처</label>
                <input
                  type="text"
                  placeholder="ex) 홍길동: 010-1234-5678"
                  value={pickupContact}
                  onChange={(e) => setPickupContact(e.target.value)}
                />
              </div>

              <div className="input_field">
                <label>상차지 주소 및 업체명</label>
                <textarea
                  rows={2}
                  placeholder="ex) 경기도 화성시 우정읍 버들로899-87 대림플라텍"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                />
              </div>

              <div className="input_field">
                <label>하차지 주소 및 업체명</label>
                <textarea
                  rows={2}
                  placeholder="ex) 충남 서산시 대산읍 대죽리 642-22 현대케미칼"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>

              <div className="input_field">
                <label>하차지 담당자 / 연락처</label>
                <input
                  type="text"
                  placeholder="ex) 윤태우 사원: 010-4645-9823"
                  value={deliveryContact}
                  onChange={(e) => setDeliveryContact(e.target.value)}
                />
              </div>

              <div className="input_field">
                <label>요청 톤수 (차량 길이 및 총 중량)</label>
                <input
                  type="text"
                  placeholder="ex) 11t(9.6m 이상 6대) / 중량 3.5t"
                  value={tonnage}
                  onChange={(e) => setTonnage(e.target.value)}
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
                <select
                  value={manualWork}
                  onChange={(e) => setManualWork(e.target.value)}
                  style={{ padding: "8px", minWidth: "150px" }}
                >
                  <option value="">선택하세요</option>
                  <option value="Y">Y (수작업 필요)</option>
                  <option value="N">N (수작업 불필요)</option>
                </select>
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
              <div className="rows">
                <h3>상차일 및 상차 시간</h3>
                <p>
                  {pickupYear}년 {pickupMonth}월 {pickupDay}일 {pickupHour}시{" "}
                  {pickupMinute}분
                </p>
              </div>
              <div className="rows">
                <h3>하차일 및 하차 시간</h3>
                <p>
                  {deliveryYear}년 {deliveryMonth}월 {deliveryDay}일{" "}
                  {deliveryHour}시 {deliveryMinute}분
                </p>
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
                  <p>{pickupAddress}</p>
                </div>
              )}
              {deliveryAddress && (
                <div className="rows">
                  <h3>하차지 주소 및 업체명</h3>
                  <p>{deliveryAddress}</p>
                </div>
              )}
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
                  <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {note}
                  </p>
                </div>
              )}
              {manualWork && (
                <div className="rows">
                  <h3>수작업 유무</h3>
                  <p>{manualWork === "Y" ? "Y (수작업 필요)" : "N (수작업 불필요)"}</p>
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
  );
};

export default User02;

