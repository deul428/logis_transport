import { Routes, Route, Navigate } from "react-router-dom";
import User01 from "./views/User01";
import User02 from "./views/User02";
import User01Calc from "./views/Calc/User01Calc";

function App() {
  return (
    <Routes>
      <Route path="/user" element={<User01 />} />
      <Route path="/multi" element={<User02 />} />
      <Route path="/calc" element={<User01Calc />} />
      <Route path="/" element={<User01 />} />
      <Route path="*" element={<Navigate to="/user" replace />} />
    </Routes>
  );
}

export default App;
