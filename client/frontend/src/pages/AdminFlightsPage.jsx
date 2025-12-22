import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminListFlights, adminCreateFlight, adminUpdateFlight, adminDeleteFlight, getAirports, getAircrafts } from '@/lib/api';

export default function AdminFlightsPage() {
  const { user } = useAuth();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    aircraft_id: '', origin_airport_id: '', destination_airport_id: '',
    departure_time: '', arrival_time: '', status: 'SCHEDULED',
    economy_price: '', economy_seats: '', business_price: '', business_seats: ''
  });
  const [airports, setAirports] = useState([]);
  const [aircrafts, setAircrafts] = useState([]);
  const [edits, setEdits] = useState({}); // { [flightId]: { status?: 'SCHEDULED'|'CANCELED'|'DELAYED', classes: { ECONOMY: price, BUSINESS: price } } }

  const loadFlights = async () => {
    setLoading(true);
    const res = await adminListFlights();
    setLoading(false);
    if (res?.success) setFlights(res.flights || []);
    else setError(res?.message || 'Không tải được danh sách');
  };

  useEffect(() => {
    loadFlights();
    (async () => {
      const [ap, ac] = await Promise.all([getAirports(), getAircrafts()]);
      if (ap?.success) setAirports(ap.airports || []);
      if (ac?.success) setAircrafts(ac.aircrafts || []);
    })();
  }, []);

  const handleCreate = async () => {
    setError('');
    const payload = {
      user_id: user?.id,
      aircraft_id: Number(form.aircraft_id),
      origin_airport_id: Number(form.origin_airport_id),
      destination_airport_id: Number(form.destination_airport_id),
      departure_time: form.departure_time,
      arrival_time: form.arrival_time,
      status: form.status,
      classes: [
        { class_type: 'ECONOMY', price: Number(form.economy_price), total_seats: Number(form.economy_seats) },
        { class_type: 'BUSINESS', price: Number(form.business_price), total_seats: Number(form.business_seats) },
      ],
    };
    const res = await adminCreateFlight(payload);
    if (res?.success) {
      await loadFlights();
      setForm({ aircraft_id:'', origin_airport_id:'', destination_airport_id:'', departure_time:'', arrival_time:'', status:'SCHEDULED', economy_price:'', economy_seats:'', business_price:'', business_seats:'' });
    } else setError(res?.message || 'Tạo chuyến bay thất bại');
  };

  const markEditPrice = (flightId, classType, price) => {
    setEdits(prev => {
      const next = { ...prev };
      next[flightId] = next[flightId] || { classes: {} };
      next[flightId].classes[classType] = price;
      return next;
    });
  };

  const markEditStatus = (flightId, status) => {
    setEdits(prev => {
      const next = { ...prev };
      next[flightId] = next[flightId] || { classes: {} };
      next[flightId].status = status;
      return next;
    });
  };

  const hasEdits = (flightId) => {
    const e = edits[flightId];
    return !!e && ((e.classes && Object.keys(e.classes).length > 0) || !!e.status);
  };

  const handleSave = async (flightId) => {
    const e = edits[flightId];
    if (!e) return;
    const classes = Object.entries(e.classes).map(([class_type, price]) => ({ class_type, price: Number(price) }));
    const payload = { user_id: user?.id };
    if (classes.length) payload.classes = classes;
    if (e.status) payload.status = e.status;
    const res = await adminUpdateFlight(flightId, payload);
    if (res?.success) {
      const cp = { ...edits }; delete cp[flightId]; setEdits(cp);
      loadFlights();
    } else alert(res?.message || 'Lưu thay đổi thất bại');
  };

  const handleDelete = async (flightId) => {
    const ok = confirm('Xác nhận xóa vĩnh viễn chuyến bay này?');
    if (!ok) return;
    const res = await adminDeleteFlight(flightId, user?.id);
    if (res?.success) loadFlights(); else alert(res?.message || 'Xóa thất bại');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header slidebar retained */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-sky-700">✈️ Flight Booking</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={()=>window.location.assign('/')}>Home</Button>
            <span className="text-gray-600">Xin chào, <strong>{user?.full_name}</strong></span>
            <Button variant="ghost" size="sm" onClick={()=>window.location.assign('/logout')}>Đăng xuất</Button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quản lý chuyến bay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {/* Aircraft dropdown */}
              <Select value={String(form.aircraft_id)} onValueChange={v=>setForm({...form, aircraft_id: Number(v)})}>
                <SelectTrigger><SelectValue placeholder="Chọn Aircraft" /></SelectTrigger>
                <SelectContent>
                  {aircrafts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.id} — {a.model}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Origin airport */}
              <Select value={String(form.origin_airport_id)} onValueChange={v=>setForm({...form, origin_airport_id: Number(v)})}>
                <SelectTrigger><SelectValue placeholder="Chọn sân bay đi" /></SelectTrigger>
                <SelectContent>
                  {airports.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.city}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Destination airport */}
              <Select value={String(form.destination_airport_id)} onValueChange={v=>setForm({...form, destination_airport_id: Number(v)})}>
                <SelectTrigger><SelectValue placeholder="Chọn sân bay đến" /></SelectTrigger>
                <SelectContent>
                  {airports.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.city}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Datetime pickers similar style */}
              <Input type="datetime-local" value={form.departure_time} onChange={e=>setForm({...form, departure_time:e.target.value})} />
              <Input type="datetime-local" value={form.arrival_time} onChange={e=>setForm({...form, arrival_time:e.target.value})} />
              {/* Status fixed to SCHEDULED */}
              <Input value={form.status} disabled />
              <Input placeholder="Economy Price" value={form.economy_price} onChange={e=>setForm({...form, economy_price:e.target.value})} />
              <Input placeholder="Economy Seats" value={form.economy_seats} onChange={e=>setForm({...form, economy_seats:e.target.value})} />
              <Input placeholder="Business Price" value={form.business_price} onChange={e=>setForm({...form, business_price:e.target.value})} />
              <Input placeholder="Business Seats" value={form.business_seats} onChange={e=>setForm({...form, business_seats:e.target.value})} />
            </div>
            <div className="mt-4"><Button onClick={handleCreate}>Thêm chuyến bay</Button></div>
            {error && <div className="text-red-500 mt-2">{error}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Danh sách</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div>Đang tải...</div> : (
              <div className="space-y-4">
                {flights.map(f => (
                  <div key={f.id} className="p-4 border rounded">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{f.flight_code} — {f.origin_code} → {f.dest_code}</div>
                        <div className="text-sm text-gray-600">{f.departure_time} → {f.arrival_time} | {f.aircraft_model}</div>
                        <div className="text-sm">Trạng thái: {(edits[f.id]?.status) || f.status}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="destructive" onClick={()=>handleDelete(f.id)}>Xóa</Button>
                        {/* Status controls */}
                        {['SCHEDULED','CANCELLED','DELAYED'].map(st => {
                          const current = edits[f.id]?.status || f.status;
                          const isActive = current === st;
                          return (
                            <Button key={st}
                              variant={isActive ? 'default' : 'secondary'}
                              onClick={()=>markEditStatus(f.id, st)}>
                              {st}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {f.classes.map(c => (
                        <div key={c.class_type} className="border rounded p-2">
                          <div className="text-sm">{c.class_type}: {c.total_seats} ghế, đặt {c.booked_seats}</div>
                          <div className="flex gap-2 items-center mt-1">
                              <Input defaultValue={c.price} onChange={(e)=>markEditPrice(f.id, c.class_type, e.target.value)} />
                              <span className="text-sm">VND</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasEdits(f.id) && (
                      <div className="mt-3">
                        <Button onClick={()=>handleSave(f.id)}>Lưu</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
