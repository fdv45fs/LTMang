import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { searchFlights, getAirports } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [airports, setAirports] = useState([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    loadAirports();
    // Load all flights on mount
    handleSearch();
  }, []);

  const loadAirports = async () => {
    const result = await getAirports();
    if (result.success) {
      setAirports(result.airports);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    const result = await searchFlights(
      origin ? parseInt(origin) : 0,
      destination ? parseInt(destination) : 0
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
    navigate('/booking', { state: { flight } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-sky-700">✈️ Flight Booking</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Xin chào, <strong>{user?.full_name}</strong></span>
            <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
              Vé của tôi
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Tìm chuyến bay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={loading} className="w-full">
                  {loading ? 'Đang tìm...' : '🔍 Tìm kiếm'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Kết quả: {flights.length} chuyến bay
            </h2>
            
            {flights.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  Không tìm thấy chuyến bay phù hợp
                </CardContent>
              </Card>
            ) : (
              flights.map((flight) => (
                <Card key={flight.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Flight Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-lg text-sky-700">{flight.flight_code}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            flight.status === 'SCHEDULED' ? 'bg-green-100 text-green-700' :
                            flight.status === 'DELAYED' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {flight.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-gray-600">
                          <div className="text-center">
                            <div className="font-bold text-xl">{flight.origin.code}</div>
                            <div className="text-sm">{flight.origin.city}</div>
                          </div>
                          <div className="flex-1 flex items-center justify-center">
                            <div className="border-t-2 border-dashed border-gray-300 w-full relative">
                              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                                ✈️
                              </span>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-xl">{flight.destination.code}</div>
                            <div className="text-sm">{flight.destination.city}</div>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-500">
                          {formatTime(flight.departure_time)} → {formatTime(flight.arrival_time)}
                        </div>
                      </div>

                      {/* Price & Book */}
                      <div className="text-right">
                        <div className="mb-2">
                          <div className="text-sm text-gray-500">Phổ thông từ</div>
                          <div className="text-2xl font-bold text-sky-600">
                            {formatPrice(flight.economy_price)}
                          </div>
                          <div className="text-xs text-gray-400">
                            Còn {flight.economy_available} ghế
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleBook(flight)}
                          disabled={flight.economy_available === 0}
                        >
                          Đặt vé
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
