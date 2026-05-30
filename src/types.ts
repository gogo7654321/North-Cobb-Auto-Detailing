export type BookingServiceType = 'Exterior Detail' | 'Interior Detail' | 'Full Detail';
export type BookingStatusType = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id?: string;
  name: string;
  phone: string;
  email: string;
  service: BookingServiceType;
  price: number;
  dateTime: string; // ISO String (e.g. "2026-05-27T10:00:00")
  status: BookingStatusType;
  createdAt: string; // ISO String
  notes?: string;
  vehicleType?: string;
  calendarEventId?: string;
  actualRevenue?: number;
}

export interface DetailingService {
  name: BookingServiceType;
  price: number;
  duration: string;
  description: string;
  features: string[];
}
