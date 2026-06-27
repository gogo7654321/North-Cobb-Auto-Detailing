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

export interface BlockedSlot {
  id?: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // "09:00", "14:00", "18:00", "12:00", or "all"
  reason?: string;
  createdAt: string; // ISO String
  createdBy: string; // email of the owner
}

