import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getUserTickets, cancelBooking, sendTicketEmail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBookingId, setActiveBookingId] = useState(null);
  const [emailById, setEmailById] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [resultById, setResultById] = useState({});
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadTickets();
  }, []);

  // Detect VNPay success redirect and pre-open email form
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const payStatus = sp.get('payment');
    const bid = sp.get('booking_id');
    if (payStatus === 'success' && bid) {
      setActiveBookingId(Number(bid));
    }
  }, [location.search]);

  const loadTickets = async () => {
    setLoading(true);
    const result = await getUserTickets(user.id);
    if (result.success) {
      setTickets(result.tickets);
    }
    setLoading(false);
  };

  const handleCancel = async (bookingId) => {
    const res = await cancelBooking(bookingId);
    if (res?.success) {
      await loadTickets();
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      'ACTIVE': 'bg-green-100 text-green-700',
      'CONFIRMED': 'bg-green-100 text-green-700',
      'PENDING': 'bg-yellow-100 text-yellow-700',
      'CANCELLED': 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    );
  };

  // Group tickets by booking
  const groupedByBooking = tickets.reduce((acc, ticket) => {
    const key = ticket.booking.booking_reference;
    if (!acc[key]) {
      acc[key] = {
        booking: ticket.booking,
        flight: ticket.flight,
        tickets: []
      };
    }
    acc[key].tickets.push(ticket);
    return acc;
  }, {});

  // Sort groups by booking date (most recent first)
  const groups = Object.values(groupedByBooking).sort((a, b) => {
    const ta = a.booking?.booking_date ? new Date(a.booking.booking_date).getTime() : 0;
    const tb = b.booking?.booking_date ? new Date(b.booking.booking_date).getTime() : 0;
    return tb - ta;
  });

  const handleSendEmail = async (bookingId) => {
    const email = (emailById[bookingId] || '').trim();
    if (!email) {
      setResultById(prev => ({ ...prev, [bookingId]: { ok: false, msg: 'Vui lòng nhập Gmail' } }));
      return;
    }
    setSendingId(bookingId);
    const res = await sendTicketEmail(bookingId, email);
    setSendingId(null);
    if (res?.success) {
      setResultById(prev => ({ ...prev, [bookingId]: { ok: true, msg: 'Đã gửi mã vé vào Gmail' } }));
      setNotice(`Đã gửi mã vé vào Gmail: ${email}`);
      // Reload to reflect email_sent status and auto-hide form
      await loadTickets();
    } else {
      const msg = res?.message || 'Gửi email thất bại';
      // If server indicates already sent, show green notice and hide input
      if (/đã được gửi/i.test(msg)) {
        setResultById(prev => ({ ...prev, [bookingId]: { ok: true, msg } }));
        setNotice(msg);
      } else {
        setResultById(prev => ({ ...prev, [bookingId]: { ok: false, msg } }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-sky-700">✈️ Vé của tôi</h1>
          <div className="flex items-center gap-4">
            {user?.role === 'ADMIN' && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/flights')}>
                Quản lý chuyến bay
              </Button>
            )}
            <span className="text-gray-600">{user?.full_name}</span>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Tìm chuyến bay
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {notice && (
          <div className="mb-4 p-3 rounded bg-green-100 text-green-700">
            {notice}
          </div>
        )}
        {loading ? (
          <div className="text-center py-12">Đang tải...</div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">🎫</div>
              <p className="text-gray-500 mb-4">Bạn chưa có vé nào</p>
              <Button onClick={() => navigate('/')}>Đặt vé ngay</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <p className="text-gray-600">Tổng cộng: {tickets.length} vé</p>
            
            {groups.map((group) => (
              <Card key={group.booking.booking_reference}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        Mã đặt chỗ: {group.booking.booking_reference}
                        {getStatusBadge(group.booking.status)}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Chuyến bay {group.flight.flight_code}: {group.flight.origin_code} → {group.flight.dest_code}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sky-600">
                        {formatPrice(group.booking.total_amount)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-sm text-gray-500">Khởi hành</div>
                        <div className="font-medium">{formatDate(group.flight.departure_time)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Đến</div>
                        <div className="font-medium">{formatDate(group.flight.arrival_time)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Trạng thái chuyến bay</div>
                        {getStatusBadge(group.flight.status)}
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Thời gian đặt vé</div>
                        <div className="font-medium">{formatDate(group.booking.booking_date)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Thời gian thanh toán</div>
                        <div className="font-medium">{formatDate(group.booking.payment_date)}</div>
                      </div>
                      {group.booking.email_sent_at && (
                        <div>
                          <div className="text-sm text-gray-500">Trạng thái gửi mã vé</div>
                          <div className="font-medium text-green-700">Đã gửi mã vé vào Gmail: {group.booking.email_sent_to}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã vé</TableHead>
                        <TableHead>Hành khách</TableHead>
                        <TableHead>CMND/CCCD</TableHead>
                        <TableHead>Ghế</TableHead>
                        <TableHead>Hạng</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-mono text-sm">
                            {ticket.ticket_number}
                          </TableCell>
                          <TableCell>{ticket.passenger_name}</TableCell>
                          <TableCell>{ticket.passenger_ic_number}</TableCell>
                          <TableCell className="font-bold">{ticket.seat_number}</TableCell>
                          <TableCell>{ticket.class_type}</TableCell>
                          <TableCell>{getStatusBadge(ticket.ticket_status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {group.booking.status === 'PENDING' && (
                    <div className="mt-4 flex justify-end gap-3">
                      {group.booking.status === 'PENDING' && (
                        <Button
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() =>
                            navigate('/payments', {
                              state: {
                                booking: {
                                  id: group.booking.id,
                                  booking_reference: group.booking.booking_reference,
                                  total_amount: group.booking.total_amount,
                                  tickets: group.tickets.map(t => ({
                                    passenger_name: t.passenger_name,
                                    seat_number: t.seat_number,
                                  })),
                                },
                                flight: group.flight,
                              },
                            })
                          }
                        >
                          Thanh toán
                        </Button>
                      )}
                      {group.booking.status !== 'CANCELLED' && (
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleCancel(group.booking.id)}
                        >
                          Hủy
                        </Button>
                      )}
                    </div>
                  )}

                  {group.booking.status === 'CONFIRMED' && !group.booking.email_sent_at && !(resultById[group.booking.id]?.ok) && (
                    <div className="mt-4 p-3 border rounded-lg bg-white">
                      <div className="flex items-center gap-3">
                        <input
                          type="email"
                          className="flex-1 border rounded px-3 py-2"
                          placeholder="Nhập Gmail để nhận mã vé"
                          value={emailById[group.booking.id] || ''}
                          onChange={(e) => setEmailById(prev => ({ ...prev, [group.booking.id]: e.target.value }))}
                        />
                        <Button
                          className="bg-sky-600 hover:bg-sky-700"
                          disabled={sendingId === group.booking.id}
                          onClick={() => handleSendEmail(group.booking.id)}
                        >
                          {sendingId === group.booking.id ? 'Đang gửi...' : ' Gửi mã vé vào Gmail'}
                        </Button>
                      </div>
                      {resultById[group.booking.id] && (
                        <div className={`mt-2 text-sm ${resultById[group.booking.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                          {resultById[group.booking.id].msg}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
