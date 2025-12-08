import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { createBooking, processPayment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BookingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const flight = location.state?.flight;
  
  const [classType, setClassType] = useState('ECONOMY');
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengers, setPassengers] = useState([{ name: user?.full_name || '', ic_number: '' }]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Info, 2: Payment, 3: Done
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState('');

  if (!flight) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-4">Không có thông tin chuyến bay</p>
            <Button onClick={() => navigate('/')}>Quay lại tìm kiếm</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
  };

  const getPrice = () => {
    return classType === 'ECONOMY' ? flight.economy_price : flight.business_price;
  };

  const getTotalPrice = () => {
    return getPrice() * passengerCount;
  };

  const handlePassengerCountChange = (count) => {
    const newCount = parseInt(count);
    setPassengerCount(newCount);
    
    const newPassengers = [...passengers];
    while (newPassengers.length < newCount) {
      newPassengers.push({ name: '', ic_number: '' });
    }
    while (newPassengers.length > newCount) {
      newPassengers.pop();
    }
    setPassengers(newPassengers);
  };

  const updatePassenger = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);
  };

  const handleSubmitBooking = async () => {
    // Validate
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].name || !passengers[i].ic_number) {
        setError(`Vui lòng điền đầy đủ thông tin hành khách ${i + 1}`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const result = await createBooking(user.id, flight.id, classType, passengers);
      
      if (result.success) {
        setBookingResult(result.booking);
        setStep(2);
      } else {
        setError(result.message || 'Đặt vé thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await processPayment(bookingResult.id);
      
      if (result.success) {
        setStep(3);
      } else {
        setError(result.message || 'Thanh toán thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          ← Quay lại
        </Button>

        {/* Flight Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-sky-700">{flight.flight_code}</span>
              <span className="text-gray-400">|</span>
              <span>{flight.origin.code} → {flight.destination.code}</span>
            </CardTitle>
            <CardDescription>
              {flight.origin.city} đến {flight.destination.city}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Step 1: Passenger Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin đặt vé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Class & Count Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hạng vé</Label>
                  <Select value={classType} onValueChange={setClassType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ECONOMY">
                        Phổ thông - {formatPrice(flight.economy_price)}
                      </SelectItem>
                      <SelectItem value="BUSINESS">
                        Thương gia - {formatPrice(flight.business_price)}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Số hành khách</Label>
                  <Select value={String(passengerCount)} onValueChange={handlePassengerCountChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} người</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Passenger Forms */}
              {passengers.map((p, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">Hành khách {i + 1}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Họ và tên</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => updatePassenger(i, 'name', e.target.value)}
                        placeholder="Nhập họ tên"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CMND/CCCD</Label>
                      <Input
                        value={p.ic_number}
                        onChange={(e) => updatePassenger(i, 'ic_number', e.target.value)}
                        placeholder="Nhập số CMND/CCCD"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-sky-50 rounded-lg">
                <span className="font-medium">Tổng tiền:</span>
                <span className="text-2xl font-bold text-sky-600">
                  {formatPrice(getTotalPrice())}
                </span>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>
              )}

              <Button onClick={handleSubmitBooking} disabled={loading} className="w-full">
                {loading ? 'Đang xử lý...' : 'Tiếp tục thanh toán'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Payment */}
        {step === 2 && bookingResult && (
          <Card>
            <CardHeader>
              <CardTitle>Thanh toán</CardTitle>
              <CardDescription>
                Mã đặt chỗ: <strong>{bookingResult.booking_reference}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Chi tiết vé đã đặt:</h3>
                {bookingResult.tickets.map((ticket, i) => (
                  <div key={i} className="text-sm text-gray-600">
                    • {ticket.passenger_name} - Ghế {ticket.seat_number}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center p-4 bg-sky-50 rounded-lg">
                <span className="font-medium">Số tiền thanh toán:</span>
                <span className="text-2xl font-bold text-sky-600">
                  {formatPrice(bookingResult.total_amount)}
                </span>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-gray-500 mb-4">
                  (Demo) Nhấn nút bên dưới để hoàn tất thanh toán
                </p>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>
              )}

              <Button onClick={handlePayment} disabled={loading} className="w-full">
                {loading ? 'Đang xử lý...' : '💳 Xác nhận thanh toán'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                Đặt vé thành công!
              </h2>
              <p className="text-gray-600 mb-6">
                Mã đặt chỗ của bạn: <strong className="text-xl">{bookingResult?.booking_reference}</strong>
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/history')}>
                  Xem vé của tôi
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Đặt vé khác
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
