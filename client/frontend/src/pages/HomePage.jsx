import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { searchFlights, getAirports, getSystemLogs, adminFlightDetails } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input'; // Đảm bảo đã import Input
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [airports, setAirports] = useState([]);
  
  // State tìm kiếm
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(''); // Thêm state ngày đi
  const [endDate, setEndDate] = useState('');     // Thêm state ngày về

  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [classType, setClassType] = useState('ALL');
  const [searchError, setSearchError] = useState('');
  const hasAnyFilter = (
    (origin && origin !== '0') ||
    (destination && destination !== '0') ||
    !!startDate ||
    !!endDate
  );

  useEffect(() => {
    loadAirports();
  }, []);

  const loadAirports = async () => {
    const result = await getAirports();
    if (result.success) {
      setAirports(result.airports);
    }
  };

  const handleSearch = async () => {
    if (!hasAnyFilter) {
      setSearchError('Vui lòng chọn ít nhất một tiêu chí để tìm kiếm.');
      return;
    }
    setSearchError('');
    setLoading(true);
    // Gọi API với đầy đủ 4 tham số: origin, destination, start_date, end_date
    const result = await searchFlights(
      origin ? parseInt(origin) : 0,
      destination ? parseInt(destination) : 0,
      startDate,
      endDate,
      passengers,
      classType === 'ALL' ? '' : classType
    );
    
    if (result.success) {
      setFlights(result.flights);
    }
    setLoading(false);
    setSearched(true);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBook = (flight) => {
    navigate('/booking', { state: { flight, defaultClass: classType === 'ALL' ? 'ECONOMY' : classType } });
  };

  // Admin-only: inline flight details
  const [openDetails, setOpenDetails] = useState(false);
  const [details, setDetails] = useState(null);
  const [compareSelected, setCompareSelected] = useState([]);
  const [openCompare, setOpenCompare] = useState(false);
  const showDetails = async (flightId) => {
    setDetails(null);
    setOpenDetails(true);
    const res = await adminFlightDetails(flightId);
    if (res?.success) setDetails(res);
  };

  const toggleCompare = (flight) => {
    setCompareSelected((prev) => {
      const exists = prev.includes(flight.id);
      if (exists) return prev.filter((id) => id !== flight.id);
      if (prev.length >= 2) return prev;
      return [...prev, flight.id];
    });
  };

  const openCompareModal = () => {
    if (compareSelected.length === 2) setOpenCompare(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-sky-700">✈️ Flight Booking</h1>
          <div className="flex items-center gap-4">
            {user ? (
                <>
                    {user.role === 'ADMIN' && (
                      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/flights')}>
                        Quản lý chuyến bay
                      </Button>
                    )}
                    <span className="text-gray-600">Xin chào, <strong>{user.full_name}</strong></span>
                    {user.role !== 'ADMIN' && (
                      <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
                        Vé của tôi
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={logout}>
                      Đăng xuất
                    </Button>
                </>
            ) : (
                <Button onClick={() => navigate('/login')}>Đăng nhập</Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* System Logs for Admin */}
        {user?.role === 'ADMIN' && <AdminLogsSection />}
        {/* Search Form */}
        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-sky-800">Tìm chuyến bay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              {/* Điểm đi */}
              <div className="space-y-2">
                <Label>Điểm đi</Label>
                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn điểm đi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Tất cả</SelectItem>
                    {airports.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Điểm đến */}
              <div className="space-y-2">
                <Label>Điểm đến</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn điểm đến" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Tất cả</SelectItem>
                    {airports.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ngày đi */}
              <div className="space-y-2">
                <Label>Từ ngày</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full"
                />
              </div>

              {/* Ngày về */}
              <div className="space-y-2">
                <Label>Đến ngày</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Hành khách</Label>
                <Input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={passengers} 
                    onChange={(e) => setPassengers(e.target.value)} 
                />
              </div>
              {/* Hạng ghế */}
              <div className="space-y-2">
                <Label>Hạng ghế</Label>
                <Select value={classType} onValueChange={setClassType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hạng ghế" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả</SelectItem>
                    <SelectItem value="ECONOMY">Phổ thông</SelectItem>
                    <SelectItem value="BUSINESS">Thương gia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Nút tìm kiếm */}
              <div>
                <Button onClick={handleSearch} disabled={loading || !hasAnyFilter} className="w-full bg-sky-600 hover:bg-sky-700">
                  {loading ? 'Đang tìm...' : 'Tìm kiếm'}
                </Button>
                {searchError && <div className="mt-2 text-sm text-red-500">{searchError}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Kết quả: {flights.length} chuyến bay
            </h2>
            {compareSelected.length === 2 && (
              <Card>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Đã chọn so sánh: {' '}
                    {flights.filter(f=> compareSelected.includes(f.id)).map((f, idx)=> (
                      <span key={f.id} className="font-medium text-sky-700">{f.flight_code}{idx===0?' vs ':''}</span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={()=> setCompareSelected([])}>Hủy chọn</Button>
                    <Button className="bg-sky-600 hover:bg-sky-700" onClick={openCompareModal}>So sánh</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {flights.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <div className="text-4xl mb-4">🛬</div>
                  <p>Không tìm thấy chuyến bay phù hợp với tiêu chí của bạn.</p>
                </CardContent>
              </Card>
            ) : (
              flights.map((flight) => (
                <Card key={flight.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-sky-500">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      {/* Flight Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="font-bold text-lg text-sky-700 bg-sky-50 px-3 py-1 rounded">
                            {flight.flight_code}
                          </span>
                          <span className="text-sm text-gray-500 font-medium">
                            {flight.aircraft_model}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6 text-gray-700">
                          <div className="text-center min-w-[80px]">
                            <div className="font-bold text-2xl">{flight.origin.code}</div>
                            <div className="text-sm text-gray-500">{flight.origin.city}</div>
                            <div className="text-xs font-semibold mt-1 text-sky-600">
                                {formatTime(flight.departure_time).split(' ')[1]}
                            </div>
                          </div>
                          
                          <div className="flex-1 flex flex-col items-center justify-center px-4">
                            <div className="text-xs text-gray-400 mb-1">Bay thẳng</div>
                            <div className="w-full h-[2px] bg-gray-300 relative">
                                <span className="absolute right-0 -top-[3px] w-2 h-2 bg-gray-300 rounded-full"></span>
                                <span className="absolute left-0 -top-[3px] w-2 h-2 bg-gray-300 rounded-full"></span>
                                <span className="absolute left-1/2 -top-2 -translate-x-1/2 text-gray-400">✈</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                {new Date(flight.departure_time).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                          
                          <div className="text-center min-w-[80px]">
                            <div className="font-bold text-2xl">{flight.destination.code}</div>
                            <div className="text-sm text-gray-500">{flight.destination.city}</div>
                            <div className="text-xs font-semibold mt-1 text-sky-600">
                                {formatTime(flight.arrival_time).split(' ')[1]}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="hidden md:block w-[1px] h-24 bg-gray-200 mx-4"></div>

                      {/* Price & Book */}
                      <div className="text-right min-w-[180px]">
                        <div className="mb-3">
                          <div className="text-sm text-gray-500">
                            {classType === 'BUSINESS' ? 'Thương gia từ' : classType === 'ECONOMY' ? 'Phổ thông từ' : 'Giá thấp nhất'}
                          </div>
                          <div className="text-2xl font-bold text-orange-600">
                            {classType === 'BUSINESS'
                              ? formatPrice(flight.business_price)
                              : classType === 'ECONOMY'
                                ? formatPrice(flight.economy_price)
                                : formatPrice(Math.min(Number(flight.economy_price||0), Number(flight.business_price||0)))}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {(() => {
                              const eco = flight.economy_available || 0;
                              const bus = flight.business_available || 0;
                              if (classType === 'ECONOMY') return eco > 0 ? `Còn ${eco} ghế phổ thông` : <span className="text-red-500">Hết vé phổ thông</span>;
                              if (classType === 'BUSINESS') return bus > 0 ? `Còn ${bus} ghế thương gia` : <span className="text-red-500">Hết vé thương gia</span>;
                              const total = eco + bus;
                              return total > 0 ? `Tổng còn ${total} ghế` : <span className="text-red-500">Hết vé</span>;
                            })()}
                          </div>
                        </div>
                        {user?.role !== 'ADMIN' ? (
                          <Button 
                            onClick={() => handleBook(flight)}
                            disabled={(() => {
                              const eco = flight.economy_available || 0;
                              const bus = flight.business_available || 0;
                              if (classType === 'ECONOMY') return eco < Number(passengers);
                              if (classType === 'BUSINESS') return bus < Number(passengers);
                              return (eco + bus) < Number(passengers);
                            })()}
                            className="w-full bg-orange-500 hover:bg-orange-600"
                          >
                            {classType === 'BUSINESS' ? 'Chọn vé (Thương gia)' : classType === 'ECONOMY' ? 'Chọn vé (Phổ thông)' : 'Chọn vé'}
                          </Button>
                        ) : (
                          <Button onClick={() => showDetails(flight.id)} className="w-full">Xem chi tiết</Button>
                        )}
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            className={compareSelected.includes(flight.id) ? 'border-sky-500 text-sky-700' : ''}
                            disabled={!compareSelected.includes(flight.id) && compareSelected.length >= 2}
                            onClick={() => toggleCompare(flight)}
                          >
                            {compareSelected.includes(flight.id) ? 'Đã chọn so sánh' : 'Chọn so sánh'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
      {/* Admin flight details modal */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết chuyến bay</DialogTitle>
          </DialogHeader>
          {!details ? (
            <div>Đang tải...</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-700">
                <div><strong>{details.flight.flight_code}</strong> — {details.flight.origin_code} → {details.flight.dest_code} ({details.flight.aircraft_model})</div>
                <div>{details.flight.departure_time} → {details.flight.arrival_time} | Trạng thái: {details.flight.status}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Card><CardContent className="p-3"><div>Đã đặt Economy: <strong>{details.summary.economy_booked}</strong></div></CardContent></Card>
                <Card><CardContent className="p-3"><div>Đã đặt Business: <strong>{details.summary.business_booked}</strong></div></CardContent></Card>
              </div>
              <div>
                <Card>
                  <CardHeader><CardTitle>Người dùng đặt/ thanh toán</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-80 overflow-auto">
                      {details.users.map(u => (
                        <div key={`${u.user_id}-${u.booking_id}`} className="p-2 border rounded">
                          <div className="flex justify-between">
                            <span className="font-medium">{u.full_name} (User #{u.user_id})</span>
                            <span className="text-sm">Đã thanh toán: {new Intl.NumberFormat('vi-VN').format(u.paid_amount)} đ</span>
                          </div>
                          <div className="text-sm text-gray-600">Booking #{u.booking_id} — Trạng thái: {u.booking_status}</div>
                          <div className="text-sm">Economy: {u.economy_tickets} vé • Business: {u.business_tickets} vé</div>
                        </div>
                      ))}
                      {details.users.length === 0 && <div className="text-gray-500">Chưa có người dùng đặt vé</div>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare modal */}
      <Dialog open={openCompare} onOpenChange={setOpenCompare}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>So sánh chuyến bay</DialogTitle>
          </DialogHeader>
          {compareSelected.length !== 2 ? (
            <div>Vui lòng chọn 2 chuyến bay để so sánh.</div>
          ) : (
            (()=>{
              const list = flights.filter(f=> compareSelected.includes(f.id));
              const fa = list[0];
              const fb = list[1];
              const fmt = (d)=> new Date(d).toLocaleString('vi-VN');
              const duration = (f)=> {
                try { return Math.round((new Date(f.arrival_time)-new Date(f.departure_time))/60000); } catch { return null; }
              };
              const minPriceA = Math.min(Number(fa.economy_price||0), Number(fa.business_price||0));
              const minPriceB = Math.min(Number(fb.economy_price||0), Number(fb.business_price||0));
              const cheaper = minPriceA === minPriceB ? null : (minPriceA < minPriceB ? 'A' : 'B');
              const durA = duration(fa);
              const durB = duration(fb);
              const faster = durA === durB ? null : (durA < durB ? 'A' : 'B');
              return (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className={`p-3 border rounded ${cheaper==='A' ? 'border-green-400' : ''} ${faster==='A' ? 'ring-1 ring-green-300' : ''}`}>
                    <div className="font-bold text-sky-700">{fa.flight_code}</div>
                    <div>{fa.origin.code} → {fa.destination.code} ({fa.aircraft_model})</div>
                    <div>Khởi hành: {fmt(fa.departure_time)}</div>
                    <div>Đến: {fmt(fa.arrival_time)}</div>
                    <div>Thời lượng: {durA} phút {faster==='A' && <span className="text-green-600 font-medium">(Nhanh hơn)</span>}</div>
                    <div className="mt-2">Giá phổ thông: <strong>{formatPrice(fa.economy_price)}</strong></div>
                    <div>Giá thương gia: <strong>{formatPrice(fa.business_price)}</strong></div>
                    <div className="mt-1">Giá thấp nhất: <strong className={`${cheaper==='A' ? 'text-green-700' : ''}`}>{formatPrice(minPriceA)}</strong></div>
                    <div className="mt-1">Còn {fa.economy_available || 0} ghế PT • {fa.business_available || 0} ghế TG</div>
                  </div>
                  <div className={`p-3 border rounded ${cheaper==='B' ? 'border-green-400' : ''} ${faster==='B' ? 'ring-1 ring-green-300' : ''}`}>
                    <div className="font-bold text-sky-700">{fb.flight_code}</div>
                    <div>{fb.origin.code} → {fb.destination.code} ({fb.aircraft_model})</div>
                    <div>Khởi hành: {fmt(fb.departure_time)}</div>
                    <div>Đến: {fmt(fb.arrival_time)}</div>
                    <div>Thời lượng: {durB} phút {faster==='B' && <span className="text-green-600 font-medium">(Nhanh hơn)</span>}</div>
                    <div className="mt-2">Giá phổ thông: <strong>{formatPrice(fb.economy_price)}</strong></div>
                    <div>Giá thương gia: <strong>{formatPrice(fb.business_price)}</strong></div>
                    <div className="mt-1">Giá thấp nhất: <strong className={`${cheaper==='B' ? 'text-green-700' : ''}`}>{formatPrice(minPriceB)}</strong></div>
                    <div className="mt-1">Còn {fb.economy_available || 0} ghế PT • {fb.business_available || 0} ghế TG</div>
                  </div>
                </div>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminLogsSection() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { (async ()=>{ const res = await getSystemLogs({ limit: 50 }); if (res?.success) setLogs(res.logs||[]); })(); }, []);
  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Logs hệ thống</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-auto">
          {logs.map((l)=> (
            <div key={l.id} className="text-sm text-gray-700 flex justify-between">
              <span className="font-medium">{l.action_type}</span>
              <span className="text-gray-500">{l.details}</span>
              <span className="text-gray-400">{new Date(l.timestamp).toLocaleString('vi-VN')}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-gray-500">Không có log</div>}
        </div>
      </CardContent>
    </Card>
  );
}