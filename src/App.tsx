import { Navigate, Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import EmbedChatPage from "./pages/EmbedChatPage";
import WidgetPage from "./pages/WidgetPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/embed" element={<EmbedChatPage />} />
      <Route path="/widget" element={<WidgetPage />} />
    </Routes>
  );
}

export default App;
