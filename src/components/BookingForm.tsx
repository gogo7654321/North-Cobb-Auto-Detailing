import React, { useState, useEffect } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { BookingServiceType, Booking } from "../types";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Wrench, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  FileText,
  Car
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types corresponding to Firestore Error logging
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface BookingFormProps {
  initialService?: string;
  onBookingSuccess?: () => void;
}

export default function BookingForm({ initialService, onBookingSuccess }: BookingFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState<BookingServiceType>("Exterior Detail");
  const [vehicleType, setVehicleType] = useState<string>("Sedan / Coupe");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  // Focus / edit tracking for validation layouts
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);

  // Restrict date selection to at least tomorrow (24 hours lead time)
  const getMinDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  // Real-time validations
  const isNameValid = name.trim().length >= 2;
  const isPhoneValid = phone.trim().replace(/\D/g, "").length >= 10;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isDateValid = date !== "" && date >= getMinDateString();

  // Set initial service if passed from pricing cards
  useEffect(() => {
    if (initialService) {
      setService(initialService as BookingServiceType);
    }
  }, [initialService]);

  // Get service price mapping to display and write
  const getPrice = (type: BookingServiceType) => {
    switch (type) {
      case "Exterior Detail": return 50;
      case "Interior Detail": return 80;
      case "Full Detail": return 120;
      default: return 50;
    }
  };

  const getVehicleAdjustmentPrice = (vType: string) => {
    switch (vType) {
      case "Crossover / Small SUV": return 15;
      case "Large SUV / Truck / Minivan": return 30;
      default: return 0;
    }
  };

  // Error logging in conformity with the Firebase Integration Skill (Pillar 3 Error Handling)
  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: { userId: null, email: null },
      operationType,
      path
    };
    console.error("Firestore Permission/Write Error Detail: ", JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    // Set all fields touched on attempt
    setNameTouched(true);
    setPhoneTouched(true);
    setEmailTouched(true);
    setDateTouched(true);

    if (!isNameValid) {
      setErrorMsg("Please enter your name (at least 2 characters).");
      setLoading(false);
      return;
    }
    if (!isPhoneValid) {
      setErrorMsg("Please enter a valid phone number with at least 10 digits.");
      setLoading(false);
      return;
    }
    if (!isEmailValid) {
      setErrorMsg("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!isDateValid) {
      if (date === "") {
        setErrorMsg("Please select a preferred date.");
      } else {
        setErrorMsg(`Bookings must be scheduled at least 24 hours in advance. Please select tomorrow (${getMinDateString()}) or a later date.`);
      }
      setLoading(false);
      return;
    }

    // Front-end hours validation
    const hourNum = parseInt(time.split(":")[0], 10);
    const minNum = parseInt(time.split(":")[1], 10);

    // Hard temporal lock: no bookings after 18:00 (6:00 PM)
    if (hourNum < 9 || hourNum > 18 || (hourNum === 18 && minNum > 0)) {
      setErrorMsg("Booking hours are strictly 9:00 AM to 6:00 PM. Please select a valid slot.");
      setLoading(false);
      return;
    }

    // Prepare ISO dateTime string
    const bookingDateTime = `${date}T${time}:00`;
    const finalPrice = getPrice(service);
    const bookingId = "book_" + Math.random().toString(36).substring(2, 10);

    const bookingPayload: Booking = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      service,
      price: finalPrice,
      dateTime: bookingDateTime,
      status: "pending",
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
      vehicleType: vehicleType
    };

    const pathForWrite = `bookings/${bookingId}`;

    // Helper for Firestore Write Timeout to prevent endless queues on unconfigured databases
    function promiseWithTimeout<T>(promise: Promise<T>, ms: number, errCode: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errCode)), ms);
        promise
          .then((res) => {
            clearTimeout(timer);
            resolve(res);
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });
    }

    try {
      // 1. Try to save directly to Firestore via client-side SDK first (to custom firebase project)
      let directSaveSucceeded = false;
      try {
        const bookingDocRef = doc(db, "bookings", bookingId);
        await setDoc(bookingDocRef, bookingPayload);
        directSaveSucceeded = true;
        console.log("[Client SDK] Booking recorded directly to Firestore successfully.");
      } catch (clientWriteErr) {
        console.warn("[Client SDK Warning] Direct write failed, relying entirely on proxy:", clientWriteErr);
      }

      // 2. Call our Google Cloud Function proxy backend to process the automation sequences first so it is never blocked
      try {
        const response = await fetch("/api/cloud-functions-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, bookingData: bookingPayload })
        });
        const cfData = await response.json();
        console.log("[Cloud Function booking sequence active]:", cfData);
      } catch (cfErr) {
        console.error("Cloud function automated notification trigger failed:", cfErr);
      }

      // 3. Save to sync/secure firestore via server proxy API with explicit timeout protection
      try {
        await promiseWithTimeout(
          (async () => {
            const res = await fetch("/api/bookings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                id: bookingId,
                data: bookingPayload
              })
            });
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || "Failed to create details reservation.");
            }
          })(),
          5000,
          "FIRESTORE_WRITE_TIMEOUT"
        );
      } catch (proxyWriteErr: any) {
        console.warn("[Server DB Proxy Sync Warning] Proxy write did not resolve: ", proxyWriteErr);
        // If direct client-side save succeeded, we can proceed as the reservation is saved
        if (!directSaveSucceeded) {
          throw proxyWriteErr;
        }
      }
      
      setSuccess(true);
      setName("");
      setPhone("");
      setEmail("");
      setDate("");
      setTime("09:00");
      setNotes("");
      setVehicleType("Sedan / Coupe");
      setNameTouched(false);
      setPhoneTouched(false);
      setEmailTouched(false);
      setDateTouched(false);
      if (onBookingSuccess) {
        onBookingSuccess();
      }
    } catch (err: any) {
      if (err instanceof Error && err.message === "FIRESTORE_WRITE_TIMEOUT") {
        setErrorMsg(
          "The connection to your Firestore database timed out. If you recently switched to a new project (north-cobb-detailing), please ensure: \n" +
          "1. Go to your Firebase Console under 'Firestore Database' and click 'Create Database' to enable it.\n" +
          "2. Ensure the location region is selected and rules are configured. Once created, client writes will resolve instantly!"
        );
      } else {
        // Handle in accordance with exact skill logging
        try {
          handleFirestoreError(err, OperationType.WRITE, pathForWrite);
        } catch (proxiedErr: any) {
          const rawMessage = err?.message || String(err);
          setErrorMsg(`Failed to book reservation: ${rawMessage}. Ensure that 'Firestore Database' is fully enabled/created in your Firebase Console under project 'north-cobb-detailing' and try again.`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getInputClassName = (isValid: boolean, touched: boolean) => {
    const base = "w-full block max-w-full min-w-0 box-border appearance-none bg-[#fdfbf8] border-2 rounded-xl px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none transition-all duration-200 min-h-[48px]";
    if (!touched) return `${base} border-[#e6dccf] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20`;
    return isValid
      ? `${base} border-emerald-600 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/10 bg-emerald-50/5`
      : `${base} border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/10 bg-rose-50/5`;
  };

  return (
    <div id="booking_form_wrapper" className="bg-white border-2 border-[#eee3d5] rounded-3xl p-6 sm:p-8 max-w-lg mx-auto shadow-xl shadow-amber-950/5 overflow-hidden">
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="booking-success"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="text-center py-10 flex flex-col items-center flex-wrap"
          >
            <div className="bg-amber-100 text-amber-600 p-4 rounded-full mb-4 animate-bounce">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-serif font-black text-zinc-900 tracking-tight">Request Received!</h3>
            <p className="text-zinc-700 text-sm mt-3 px-4 max-w-xs leading-relaxed font-sans">
              We received your detailing request for <strong className="text-amber-700">{service === "Full Detail" ? "Full Detail" : service.split(" ")[0]}</strong>!
            </p>
            
            <div className="mt-4 bg-amber-50/50 border border-amber-250/30 rounded-2xl p-4 max-w-md mx-auto text-left space-y-3">
              <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                ⚡ <strong>What happens next?</strong> Once we review and accept your booking request:
              </p>
              <ul className="text-xs text-zinc-650 space-y-2 pl-1 list-none leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>When a team member approves this job, <strong>then you will receive the automated confirmation email</strong> confirming your schedule slot.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>A team member will send you a <strong>personal text message</strong> to greet you, answer any questions, and request your exact driveway address!</span>
                </li>
              </ul>
            </div>
            
            <div className="pt-3 max-w-sm mx-auto text-center">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-sans">Accepted Payment Methods (After Completion)</span>
              <div className="flex justify-center gap-2 mt-2">
                {/* Cash */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded-md border border-green-200/40 text-[10px] font-extrabold uppercase font-sans">
                  <svg className="w-2.5 h-2.5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span>Pure Cash</span>
                </div>
                {/* Zelle */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#7414ca]/15 text-[#7414ca] rounded-md border border-[#7414ca]/20 text-[10px] font-extrabold uppercase font-sans">
                  <span className="w-2.5 h-2.5 flex items-center justify-center bg-[#7414ca] text-white rounded-full font-serif font-black text-[7px] leading-none">z</span>
                  <span>Zelle</span>
                </div>
                {/* Cash App */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00D632]/15 text-[#00b029] rounded-md border border-[#00D632]/25 text-[10px] font-extrabold uppercase font-sans">
                  <span className="w-2.5 h-2.5 flex items-center justify-center bg-[#00D632] text-white rounded-[3px] font-sans font-black text-[7px] leading-none">$</span>
                  <span>Cash App</span>
                </div>
                {/* Venmo */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#008CFF]/15 text-[#007cd6] rounded-md border border-[#008CFF]/20 text-[10px] font-extrabold uppercase font-sans">
                  <span className="w-2.5 h-2.5 flex items-center justify-center bg-[#008CFF] text-white rounded-[3px] font-sans font-black text-[7px] leading-none">V</span>
                  <span>Venmo</span>
                </div>
              </div>
              <p className="text-[10.5px] text-zinc-500 mt-2 px-1 leading-normal">
                No deposit or upfront prepayments required. Pay Arthur & Carson directly upon completion!
              </p>
            </div>
            <button
              id="book_another_button"
              onClick={() => setSuccess(false)}
              className="mt-6 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 pointer-events-auto cursor-pointer"
            >
              Book Another Vehicle
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="booking-form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div className="border-b border-zinc-200 pb-4 text-left">
              <h3 className="text-xl font-bold text-zinc-900">
                Request Detailing Slot
              </h3>
              <p className="text-zinc-550 text-xs mt-1">
                No prepayments or deposits required. Our 2-man crew comes right to your driveway!
              </p>
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200 text-red-650 rounded-xl p-3 flex items-start gap-2.5 text-xs text-left"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* Customer Name */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#b45309]" />
                Your Name
              </label>
              <input
                id="booking_input_name"
                type="text"
                required
                autoComplete="name"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                onBlur={() => setNameTouched(true)}
                className={getInputClassName(isNameValid, nameTouched)}
              />
              <AnimatePresence>
                {nameTouched && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <p className={`text-[10px] font-sans font-bold flex items-center gap-1 mt-1 uppercase ${
                      isNameValid ? "text-emerald-700" : "text-rose-500"
                    }`}>
                      {isNameValid ? "✓ Name looks ideal" : "⚠ Name must be at least 2 characters"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Contact Methods: Grid for layout efficiency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Phone */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#b45309]" />
                  Phone Number
                </label>
                <input
                  id="booking_input_phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="(208) 770-7517"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneTouched(true);
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  className={getInputClassName(isPhoneValid, phoneTouched)}
                />
                <AnimatePresence>
                  {phoneTouched && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <p className={`text-[10px] font-sans font-bold flex items-center gap-1 mt-1 uppercase ${
                        isPhoneValid ? "text-emerald-700" : "text-rose-500"
                      }`}>
                        {isPhoneValid ? "✓ Phone number is valid" : "⚠ Enter at least 10 digits"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Customer Email */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#b45309]" />
                  Email Address
                </label>
                <input
                  id="booking_input_email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTouched(true);
                  }}
                  onBlur={() => setEmailTouched(true)}
                  className={getInputClassName(isEmailValid, emailTouched)}
                />
                <AnimatePresence>
                  {emailTouched && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <p className={`text-[10px] font-sans font-bold flex items-center gap-1 mt-1 uppercase ${
                        isEmailValid ? "text-emerald-700" : "text-rose-500"
                      }`}>
                        {isEmailValid ? "✓ Email syntax is valid" : "⚠ Enter a correct email format"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Service & Vehicle Type Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-[#b45309]" />
                  Detailing Package
                </label>
                <div className="relative">
                  <select
                    id="booking_input_service"
                    value={service}
                    onChange={(e) => setService(e.target.value as BookingServiceType)}
                    className="w-full block max-w-full bg-[#fdfbf8] border-2 border-[#e6dccf] rounded-xl px-4 py-3 text-sm text-zinc-800 focus:outline-none focus:border-amber-500 transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="Exterior Detail">Exterior</option>
                    <option value="Interior Detail">Interior</option>
                    <option value="Full Detail">Full Detail</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#b45309] text-[10px] font-sans font-bold select-none uppercase tracking-wider">
                    BASE
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-[#b45309]" />
                  Vehicle Type
                </label>
                <div className="relative">
                  <select
                    id="booking_input_vehicle_type"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full block max-w-full bg-[#fdfbf8] border-2 border-[#e6dccf] rounded-xl px-4 py-3 text-sm text-zinc-800 focus:outline-none focus:border-amber-500 transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="Sedan / Coupe">Sedan / Coupe</option>
                    <option value="Crossover / Small SUV">Crossover / Small SUV</option>
                    <option value="Large SUV / Truck / Minivan">Large SUV / Truck / Minivan</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-[10px] font-sans font-bold select-none uppercase tracking-wider">
                    SIZE
                  </div>
                </div>
              </div>
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#b45309]" />
                  Select Date
                </label>
                <input
                  id="booking_input_date"
                  type="date"
                  required
                  min={getMinDateString()}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setDateTouched(true);
                  }}
                  onBlur={() => setDateTouched(true)}
                  className={getInputClassName(isDateValid, dateTouched)}
                />
                <AnimatePresence>
                  {dateTouched && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <p className={`text-[10px] font-sans font-bold flex items-center gap-1 mt-1 uppercase ${
                        isDateValid ? "text-emerald-700" : "text-rose-500"
                      }`}>
                        {isDateValid 
                          ? "✓ Date selected" 
                          : date === "" 
                            ? "⚠ Pick a preferred slot" 
                            : "⚠ Must be tomorrow or later"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#b45309]" />
                  Select Time
                </label>
                <select
                  id="booking_input_time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full block max-w-full bg-[#fdfbf8] border-2 border-[#e6dccf] rounded-xl px-4 py-3 text-sm text-zinc-800 focus:outline-none focus:border-amber-500 transition-all duration-200 min-h-[48px] cursor-pointer"
                >
                  <option value="09:00">09:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">01:00 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="17:00">05:00 PM</option>
                  <option value="18:00">06:00 PM</option>
                </select>
              </div>
            </div>

            {/* Notes / Special Requests */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#b45309]" />
                Special Notes / Requests
              </label>
              <textarea
                id="booking_input_notes"
                rows={3}
                placeholder="e.g. Please focus on water spot removal on the hood, or let us know about any standard hose/outlet accessibility..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#fdfbf8] border-2 border-[#e6dccf] rounded-xl px-4 py-3 text-sm text-zinc-850 placeholder:text-zinc-450 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all duration-200 resize-none font-sans"
              />
            </div>

            {/* Pricing Highlight Card */}
            <div className="bg-[#faf6f0] border-2 border-amber-100 p-4 rounded-2xl flex flex-col gap-2 text-left">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] text-zinc-650 font-extrabold uppercase tracking-wider">Estimated Total Price*</span>
                  <span className="text-[10px] text-zinc-500 leading-none mt-0.5">
                    ${getPrice(service)} base {getVehicleAdjustmentPrice(vehicleType) > 0 ? `+ $${getVehicleAdjustmentPrice(vehicleType)} sizing upgrade` : "(standard size)"}
                  </span>
                </div>
                <span className="text-3xl font-black text-amber-700 tracking-tight font-sans">
                  ${getPrice(service) + getVehicleAdjustmentPrice(vehicleType)}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-snug italic font-medium font-sans">
                *Note: Final pricing depends on your exact vehicle condition/dirtiness. Checked & verified with you prior to cleaning.
              </p>
              <div className="border-t border-amber-200/40 pt-2.5 mt-1 text-xs font-semibold text-amber-900">
                <span className="block text-[10px] uppercase font-bold text-zinc-550 mb-1.5">Pay After Service — Accepted Payments:</span>
                <div className="flex flex-wrap gap-2">
                  {/* Cash */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-lg border border-green-200/40 text-[10.5px] font-extrabold font-sans">
                    <svg className="w-3 h-3 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                    <span>CASH</span>
                  </div>
                  {/* Zelle */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-[#7414ca]/10 text-[#7414ca] rounded-lg border border-[#7414ca]/20 text-[10.5px] font-extrabold font-sans">
                    <span className="w-3.5 h-3.5 flex items-center justify-center bg-[#7414ca] text-white rounded-full font-serif font-black text-[9px] leading-none">z</span>
                    <span>ZELLE</span>
                  </div>
                  {/* Cash App */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-[#00D632]/10 text-[#00b32a] rounded-lg border border-[#00D632]/20 text-[10.5px] font-extrabold font-sans">
                    <span className="w-3.5 h-3.5 flex items-center justify-center bg-[#00D632] text-white rounded-[4px] font-sans font-black text-[9px] leading-none">$</span>
                    <span>CASH APP</span>
                  </div>
                  {/* Venmo */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-[#008CFF]/10 text-[#007cd6] rounded-lg border border-[#008CFF]/25 text-[10.5px] font-extrabold font-sans">
                    <span className="w-3.5 h-3.5 flex items-center justify-center bg-[#008CFF] text-white rounded-[4px] font-sans font-black text-[9px] leading-none">V</span>
                    <span>VENMO</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="submit_booking_btn"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm tracking-widest uppercase rounded-xl transition-all duration-300 shadow-md shadow-amber-900/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Processing Sequence..." : "Request Detail Service"}
            </button>

            {/* Friendly contact help note */}
            <p className="text-center text-xs text-zinc-500 leading-relaxed pt-1 select-none font-sans">
              Have questions or dynamic detailing requirements? <br />
              Feel free to <span className="font-bold text-[#b45309]">contact us if you need anything</span>! We are always happy to help.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
