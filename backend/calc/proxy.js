export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ✅ Preflight (OPTIONS) 요청이면 즉시 허용 응답 반환
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // ✅ Google Apps Script Web App URL (실제 배포된 스크립트 URL로 변경 필요)
    const targetKey = "YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID";
    const targetUrl = "https://script.google.com/macros/s/" + targetKey + "/exec";
    const method = request.method;
    const headers = { "Content-Type": "application/json" };
    const body = ["POST", "PUT"].includes(method)
      ? await request.text()
      : undefined;

    // ✅ 실제 Apps Script 호출
    const res = await fetch(targetUrl + url.search, { method, headers, body });
    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
      },
    });
  },
};

