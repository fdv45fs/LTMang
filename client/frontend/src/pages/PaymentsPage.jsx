import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { processPayment, sendTicketEmail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PaymentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking;
  const flight = location.state?.flight;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  const formatPrice = (price) => new Intl.NumberFormat('vi-VN').format(price) + ' đ';

  const handlePay = async () => {
    if (!booking?.id) {
      setError('Thiếu thông tin booking');
      return;
    }
    setLoading(true);
    setError('');
    const res = await processPayment(booking.id);
    setLoading(false);
    if (res?.success) {
      if (res.payment_url) {
        // Redirect to VNPay payment page
        window.location.href = res.payment_url;
        return;
      }
      // Fallback (simulated payment) → show email form to send e-ticket
      setShowEmailForm(true);
    } else {
      setError(res?.message || 'Thanh toán thất bại');
    }
  };

  const handleSendEmail = async () => {
    setSendMessage('');
    if (!email) { setSendMessage('Vui lòng nhập email'); return; }
    setSending(true);
    const res = await sendTicketEmail(booking.id, email);
    setSending(false);
    if (res?.success) {
      setSendMessage('Đã gửi mã vé vào email.');
    } else {
      setSendMessage(res?.message || 'Gửi email thất bại');
    }
  };

  if (!booking || !flight) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-4">Không có dữ liệu thanh toán</p>
            <Button onClick={() => navigate('/')}>Quay lại</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button variant="ghost" onClick={() => navigate('/history')} className="mb-4">
          ← Quay lại
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-sky-700">{flight.flight_code}</span>
              <span className="text-gray-400">|</span>
              <span>{flight.origin_code || flight.origin?.code} → {flight.dest_code || flight.destination?.code}</span>
            </CardTitle>
            <CardDescription>Mã đặt chỗ: <strong>{booking.booking_reference}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Chi tiết vé đã đặt:</h3>
              {(booking.tickets || []).map((t, i) => (
                <div key={i} className="text-sm text-gray-600">• {t.passenger_name} - Ghế {t.seat_number}</div>
              ))}
            </div>

            <div className="flex justify-between items-center p-4 bg-sky-50 rounded-lg">
              <span className="font-medium">Số tiền thanh toán:</span>
              <span className="text-2xl font-bold text-sky-600">{formatPrice(booking.total_amount)}</span>
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>}

            <Button onClick={handlePay} disabled={loading} className="w-full">
              {loading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
            </Button>
          </CardContent>
        </Card>

        {showEmailForm && (
          <Card>
            <CardHeader>
              <CardTitle>Gửi mã vé điện tử qua Gmail</CardTitle>
              <CardDescription>Nhập email để nhận các mã vé của booking này.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              {sendMessage && (
                <div className={`text-sm p-2 rounded ${sendMessage.includes('Đã gửi') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {sendMessage}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSendEmail} disabled={sending} className="flex-1">
                  {sending ? 'Đang gửi...' : 'Gửi mã vé vào Gmail'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/history')} className="flex-1">Xem lịch sử vé</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
