import { Routes, Route, Navigate } from "react-router-dom";
import User01 from "./views/User01";
import User02 from "./views/User02";

function App() {
  return (
    <Routes>
      <Route path="/user" element={<User01 />} />
      <Route path="/multi" element={<User02 />} />
      <Route path="/" element={<User01 />} />
      <Route path="*" element={<Navigate to="/user" replace />} />
    </Routes>
  );
}

export default App;
