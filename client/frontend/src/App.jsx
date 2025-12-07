import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import HomePage from "./pages/HomePage"
import SearchPage from "./pages/SearchPage"
import BookingPage from "./pages/BookingPage"
import HistoryPage from "./pages/HistoryPage"

function App() {
  return (
    <BrowserRouter>
      <nav className="fixed top-0 left-0 right-0 bg-background border-b p-4 flex gap-4">
        <Link to="/" className="hover:underline">Trang chủ</Link>
        <Link to="/search" className="hover:underline">Tìm kiếm</Link>
        <Link to="/booking" className="hover:underline">Đặt vé</Link>
        <Link to="/history" className="hover:underline">Lịch sử</Link>
      </nav>
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
