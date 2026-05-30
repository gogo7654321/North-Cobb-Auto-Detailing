import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";
import { 
  db, 
  auth, 
  googleSignIn, 
  getAccessToken, 
  googleSignOut,
  initAuth 
} from "../lib/firebase";
import { Booking, BookingStatusType } from "../types";
import { 
  Lock, 
  Unlock, 
  Calendar, 
  Mail, 
  Smartphone, 
  Check, 
  Trash2, 
  Eye, 
  LogOut, 
  Settings, 
  FileText,
  AlertTriangle,
  PlayCircle,
  TrendingUp,
  UserCheck
} from "lucide-react";

export default function AdminPortal() {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoPilot, setAutoPilot] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInIframe, setIsInIframe] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const authorizedEmails = ["npatel012010@gmail.com", "northcobbdetailing@gmail.com"];

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInIframe(window.self !== window.top);
    }
  }, []);

  const saveOwnerToken = async (email: string, token: string) => {
    try {
      await setDoc(doc(db, "admin_config", "oauth"), {
        accessToken: token,
        updatedAt: new Date().toISOString(),
        email: email
      });
      // Save to authenticated_owners collection to dynamically record portal users
      await setDoc(doc(db, "authenticated_owners", email), {
        email: email,
        accessToken: token,
        updatedAt: new Date().toISOString(),
        hasToken: true
      });
    } catch (err: any) {
      console.error("Failed to automatically save Owner OAuth token: ", err);
    }
  };

  // Bind full strict authorization observer
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        if (authorizedEmails.includes(user.email || "")) {
          setIsAdminAuth(true);
          setAdminUser(user);
          if (token) {
            setAccessToken(token);
            saveOwnerToken(user.email || "", token);
          }
        } else {
          setErrorMessage("Access Restricted: This account is not registered as an authorized North Cobb Detailing Owner.");
          googleSignOut();
        }
      },
      () => {
        setIsAdminAuth(false);
        setAdminUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Subscribe to raw Bookings collection
  useEffect(() => {
    if (!isAdminAuth) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "bookings"), orderBy("dateTime", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Booking[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Booking);
      });
      setBookings(items);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdminAuth]);

  // Autopilot processor
  useEffect(() => {
    if (autoPilot && bookings.length > 0 && accessToken) {
      const pendingBookings = bookings.filter(b => b.status === "pending");
      if (pendingBookings.length > 0) {
        addLog(`[Auto-pilot] Detected ${pendingBookings.length} pending bookings. Processing sequences...`);
        pendingBookings.forEach(async (booking) => {
          try {
            await handleConfirm(booking);
          } catch (e: any) {
            addLog(`Error auto-processing: ${e.message}`);
          }
        });
      }
    }
  }, [bookings, autoPilot, accessToken]);

  const addLog = (text: string) => {
    setSyncLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev.slice(0, 49)]);
  };

  const handleLogin = async (method: "popup" | "redirect" = "popup") => {
    setErrorMessage("");
    try {
      const res = await googleSignIn(method);
      if (res) {
        if (authorizedEmails.includes(res.user.email || "")) {
          setIsAdminAuth(true);
          setAdminUser(res.user);
          setAccessToken(res.accessToken);
          saveOwnerToken(res.user.email || "", res.accessToken);
          addLog("Logged in successfully. Granted permissions for Google Calendar and Gmail API.");
        } else {
          setErrorMessage("Access Restricted: This login email is not registered as an authorized North Cobb Detailing Owner.");
          await googleSignOut();
        }
      } else {
        if (method === "redirect") {
          addLog("Google Login redirection triggered...");
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes("missing initial state") ||
        errMsg.includes("sessionStorage") ||
        errMsg.includes("storage-partitioned") ||
        errMsg.includes("auth/web-storage-unsupported")
      ) {
        setErrorMessage(
          "Iframe Storage Restriction Detected!\n\n" +
          "Since this application runs inside an iframe wrapper, modern browser storage security rules prevent Firebase from completing the Google signature handshake.\n\n" +
          "🛠️ FIX: Simply click 'Open in a new tab' (the arrow screen icon in the builder's top status menu) to launch the app directly. Google Sign-In will authorize flawlessly!"
        );
      } else {
        setErrorMessage(errMsg || "OAuth Portal failed to authenticate.");
      }
    }
  };

  const handleLogout = async () => {
    await googleSignOut();
    setIsAdminAuth(false);
    setAdminUser(null);
    setAccessToken(null);
  };

  // Google Calendar Integration API dispatcher
  const createGoogleCalendarEvent = async (booking: Booking, token: string) => {
    const startTimeStr = booking.dateTime;
    const startDateObj = new Date(startTimeStr);
    
    // Set duration based on service choice (1 hour or 3 hours)
    const durationHours = booking.service === "Full Detail" ? 3 : (booking.service === "Interior Detail" ? 2 : 1);
    const endDateObj = new Date(startDateObj.getTime() + durationHours * 60 * 60 * 1000);
    const endTimeStr = endDateObj.toISOString().split(".")[0] + "Z"; // simple UTC string conversion

    const adjustment = getVehicleTypePriceAdjustment(booking.vehicleType);
    const estTotal = booking.price + adjustment;

    // Combine passenger and all authorized admin/owner emails
    const uniqueAttendees = new Set<string>();
    uniqueAttendees.add(booking.email);
    authorizedEmails.forEach(email => uniqueAttendees.add(email));

    const attendeesPayload = Array.from(uniqueAttendees).map(email => {
      if (email === booking.email) {
        return { email, responseStatus: "tentative" };
      }
      // Invite everyone else
      return { email, responseStatus: "needsAction" };
    });

    const eventPayload = {
      summary: `🚗 North Cobb Detailing: ${booking.service} (${booking.vehicleType || "Sedan / Coupe"}) - ${booking.name}`,
      location: "Mobile - We Come to Your Driveway!",
      description: `Mobile Vehicle Detailing Booking Request.\n\n` +
                   `Customer Contact:\n` +
                   `- Name: ${booking.name}\n` +
                   `- Phone: ${booking.phone}\n` +
                   `- Email: ${booking.email}\n\n` +
                   `Package Details:\n` +
                   `- Service: ${booking.service}\n` +
                   `- Vehicle Type: ${booking.vehicleType || "Sedan / Coupe"}\n` +
                   `- Dynamic Estimate: $${estTotal} ($${booking.price} base${adjustment > 0 ? ` + $${adjustment} size upgrade` : ""})\n\n` +
                   `Sync status: Real-time Scheduled`,
      start: {
        dateTime: startDateObj.toISOString(),
        timeZone: "UTC"
      },
      end: {
        dateTime: endDateObj.toISOString(),
        timeZone: "UTC"
      },
      attendees: attendeesPayload,
      reminders: {
        useDefault: true
      }
    };

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendar service error: ${errorText}`);
    }
    return await response.json();
  };

  // Delete Google Calendar Event helper
  const deleteGoogleCalendarEvent = async (calendarEventId: string, token: string) => {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendar delete error: ${errorText}`);
    }
  };

  // Gmail API Dispatcher formatted as standard MIME Base64
  const sendMimeGmailConfirmation = async (booking: Booking, token: string) => {
    const [datePart, timePart] = (booking.dateTime || "").split("T");
    const [year, month, day] = (datePart || "").split("-");
    const [hour, minute] = (timePart || "00:00:00").split(":");
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[parseInt(month, 10) - 1] || "Selected Date";
    const h12 = parseInt(hour, 10) || 0;
    const ampm = h12 >= 12 ? "PM" : "AM";
    const hour12 = h12 % 12 === 0 ? 12 : h12 % 12;
    const formattedDate = `${monthName} ${parseInt(day, 10) || ""}, ${year || ""} at ${hour12}:${minute || "00"} ${ampm}`;

    const subject = `CONFIRMED: Detailing Reservation - ${booking.service}`;
    const adjustment = getVehicleTypePriceAdjustment(booking.vehicleType);
    const estTotal = booking.price + adjustment;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detailing Reservation Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fffdfb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2e261f;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffdfb; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Card Frame -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e6dccf; border-radius: 16px 2px 16px 2px; overflow: hidden; box-shadow: 0 6px 18px rgba(46, 38, 31, 0.06);">
          
          <!-- Obsidian Header Banner -->
          <tr>
            <td style="background-color: #2e261f; padding: 35px 24px; text-align: left; border-bottom: 3px solid #b45309;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Logo Frame -->
                  <td width="60" valign="middle">
                    <img src="https://north-cobb-detailing-139121508979.us-west1.run.app/North_CObb_Detailing.PNG" alt="North Cobb Detailing Logo" width="55" height="55" style="display: block; border-radius: 8px 2px 8px 2px; border: 1px solid #e6dccf; background-color: #ffffff; object-fit: contain;" />
                  </td>
                  <!-- Brand Name -->
                  <td valign="middle" style="padding-left: 15px;">
                    <span style="font-size: 11px; font-weight: bold; font-family: ui-monospace, 'SF Mono', monospace; letter-spacing: 0.18em; color: #b45309; text-transform: uppercase; display: block; margin-bottom: 2px;">RESERVATION CONFIRMED</span>
                    <span style="font-size: 20px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #ffffff; letter-spacing: -0.01em;">NORTH COBB DETAILING</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 35px 24px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #1c1917; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: -0.02em;">
                Hi ${booking.name}, your mobile detail is locked in! 🎉
              </h1>
              
              <p style="font-size: 13.5px; line-height: 1.6; color: #44403c; margin: 0 0 24px 0;">
                We are excited to restore your vehicle to a mirror-like finish! Our mobile detailers will arrive on schedule. To learn more or prepare your car, examine your appointment summary below.
              </p>

              <!-- Address Action Banner -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1.5px solid #fef3c7; border-radius: 10px 2px 10px 2px; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td valign="top" width="24" style="font-size: 16px;">📍</td>
                  <td style="padding-left: 10px; font-size: 13px; line-height: 1.5; color: #78350f;">
                    <strong style="color: #451a03; display: block; margin-bottom: 3px;">Address Confirmation Action Required</strong>
                    We will reply to this email thread to contact you about your address, or you can go ahead and <strong>reply directly to this thread with your address</strong> so we can add it to our route!
                  </td>
                </tr>
              </table>

              <!-- Appointment Details Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf8f5; border: 1px solid #e6dccf; border-radius: 12px 2px 12px 2px; padding: 22px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <h3 style="font-size: 11px; font-weight: bold; color: #78716c; font-family: ui-monospace, 'SF Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 14px 0; border-bottom: 1px dashed #e6dccf; padding-bottom: 8px;">
                      Appointment Summary
                    </h3>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5;">
                      <tr>
                        <td width="130" style="padding: 6px 0; font-weight: 600; color: #78716c;">🚗 Detailing Type:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #1c1917;">${booking.service}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">🛞 Vehicle Type:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #1c1917;">${booking.vehicleType || "Sedan / Coupe"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">📅 Scheduled Slot:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #b45309;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">💰 Price Estimate:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #1c1917;">
                          $${estTotal} 
                          <span style="font-size: 11px; font-weight: normal; color: #78716c;">
                            ($${booking.price} base${adjustment > 0 ? ` + $${adjustment} sizing upgrade` : ""})
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">📍 Location:</td>
                        <td style="padding: 6px 0; color: #1c1917;">Mobile (We drive directly to you!)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Utility Requirement Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1.5px solid #dcfce7; border-radius: 10px 2px 10px 2px; padding: 16px; margin-bottom: 24px;">
                <tr>
                   <td valign="top" width="24" style="font-size: 16px;">🔌</td>
                   <td style="padding-left: 10px; font-size: 13px; line-height: 1.5; color: #14532d;">
                     <strong style="color: #052e16;">On-Site Support Notice</strong>
                     Please ensure we have access to exactly <strong>one standard outdoor water spigot</strong> and <strong>one standard electrical wall outlet plug</strong>.
                   </td>
                </tr>
              </table>

              <!-- Google Calendar Notification -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border: 1.5px solid #dbeafe; border-radius: 10px 2px 10px 2px; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td valign="top" width="24" style="font-size: 16px;">📅</td>
                  <td style="padding-left: 10px; font-size: 13px; line-height: 1.5; color: #1e40af;">
                    <strong style="color: #1e3a8a;">Added to your Google Calendar</strong>
                    We have scheduled this detailing appointment directly on your Google Calendar! We sent an invitation to <strong>${booking.email}</strong>, so it will stay synchronized with your personal schedule.
                  </td>
                </tr>
              </table>

              <p style="font-size: 13.5px; line-height: 1.6; color: #44403c; margin: 0 0 28px 0;">
                Need to coordinate coordinates, reschedule slots, or send us photos? Reach our team easily by emailing <a href="mailto:northcobbdetailing@gmail.com" style="color: #b45309; text-decoration: none; font-weight: bold;">northcobbdetailing@gmail.com</a>.
              </p>

              <!-- Aesthetic Slogan Block -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e6dccf; padding-top: 20px; text-align: center;">
                <tr>
                  <td>
                    <span style="font-size: 12px; font-family: ui-monospace, 'SF Mono', monospace; font-weight: bold; letter-spacing: 0.12em; color: #78716c; text-transform: uppercase;">
                      Fast • Reliable • Affordable
                    </span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; border-top: 1px solid #e6dccf; padding: 24px; text-align: center;">
              <p style="font-size: 11px; font-family: ui-monospace, 'SF Mono', monospace; font-weight: bold; color: #a8a29e; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 8px 0;">
                North Cobb Detailing Team
              </p>
              <p style="font-size: 11px; line-height: 1.4; color: #78716c; margin: 0;">
                Serving Marietta, Kennesaw, Acworth & surrounding Georgia communities.<br/>
                © 2026 North Cobb Detailing LLC. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const rawMime = [
      `To: ${booking.email}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset="utf-8"`,
      `MIME-Version: 1.0`,
      ``,
      htmlContent
    ].join("\r\n");

    // Convert MIME to Base64url safe string representation
    const base64Mime = btoa(unescape(encodeURIComponent(rawMime)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: base64Mime })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API error: ${errorText}`);
    }
    return await response.json();
  };

  const resolveSendCredentials = async () => {
    // Default fallback to current logins
    let sendToken = accessToken;
    let emailSentFrom = adminUser?.email || "owner";

    if (adminUser?.email !== "northcobbdetailing@gmail.com" && db) {
      try {
        const ownerDocRef = doc(db, "authenticated_owners", "northcobbdetailing@gmail.com");
        const ownerDocSnap = await getDoc(ownerDocRef);
        if (ownerDocSnap.exists()) {
          const ownerData = ownerDocSnap.data();
          if (ownerData && ownerData.accessToken) {
            sendToken = ownerData.accessToken;
            emailSentFrom = "northcobbdetailing@gmail.com";
          }
        }
      } catch (err) {
        console.error("Error loading central system credentials:", err);
      }
    }
    return { sendToken, emailSentFrom };
  };

  // Full confirmation pipeline helper
  const handleConfirm = async (booking: Booking) => {
    try {
      addLog(`Confirming [${booking.name} - ${booking.service}]...`);

      // Resolve the system credentials (prefers northcobbdetailing@gmail.com if available)
      const { sendToken, emailSentFrom } = await resolveSendCredentials();

      if (emailSentFrom === "northcobbdetailing@gmail.com") {
        addLog(`- System Router: Routing notifications via primary ${emailSentFrom} mailbox.`);
      } else {
        addLog(`- System Router: Routing notifications via active logged-in account: ${emailSentFrom}.`);
      }

      // 1. Google Calendar dispatch (if authorized)
      let calendarEventId: string | undefined = undefined;
      if (sendToken) {
        try {
          const calEventResult = await createGoogleCalendarEvent(booking, sendToken);
          if (calEventResult && calEventResult.id) {
            calendarEventId = calEventResult.id;
          }
          addLog(`- Google Calendar: Added event containing all admin calendars.`);
        } catch (calError: any) {
          addLog(`- Google Calendar Alert: Unable to schedule: ${calError.message}`);
        }
      } else {
        addLog(`- Google Calendar: Skipped (Offline/Direct mode).`);
      }

      // 2. Gmail dispatch (if authorized)
      if (sendToken) {
        try {
          await sendMimeGmailConfirmation(booking, sendToken);
          addLog(`- Gmail Alerts: Emailed receipt to ${booking.email} from ${emailSentFrom} successfully.`);
        } catch (mailError: any) {
          addLog(`- Gmail Alert: Failed to email customer: ${mailError.message}`);
        }
      } else {
        addLog(`- Gmail Alert: Skipped (Offline/Direct mode).`);
      }

      // 3. Update Firestore database state keys
      const bookingDocRef = doc(db, "bookings", booking.id!);
      const updateData: any = { status: "confirmed" };
      if (calendarEventId) {
        updateData.calendarEventId = calendarEventId;
      }
      await updateDoc(bookingDocRef, updateData);
      addLog(`Status Updated! [${booking.name}] marked as CONFIRMED in Database.`);

    } catch (err: any) {
      console.error(err);
      addLog(`Sync Blocked for [${booking.name}]: ${err.message}`);
    }
  };

  const handleCancel = async (booking: Booking) => {
    const confirmed = window.confirm(`Mark reservation for ${booking.name} as CANCELLED?`);
    if (!confirmed) return;

    try {
      const bookingDocRef = doc(db, "bookings", booking.id!);
      await updateDoc(bookingDocRef, { status: "cancelled" });
      addLog(`Booking for ${booking.name} cancelled.`);
    } catch (err: any) {
      addLog(`Failed to cancel booking: ${err.message}`);
    }
  };

  const handleComplete = async (booking: Booking) => {
    const estimated = booking.price + getVehicleTypePriceAdjustment(booking.vehicleType);
    const amountStr = window.prompt(
      `Mark detailing for ${booking.name} as COMPLETED. How much money did you actually make on this job?`,
      String(estimated)
    );
    if (amountStr === null) {
      return; // Canceled the action
    }

    const parsed = parseFloat(amountStr);
    const finalRevenue = isNaN(parsed) ? estimated : parsed;

    try {
      const bookingDocRef = doc(db, "bookings", booking.id!);
      await updateDoc(bookingDocRef, { 
        status: "completed",
        actualRevenue: finalRevenue
      });
      addLog(`Job for ${booking.name} marked as COMPLETED. Actual revenue recorded: $${finalRevenue}`);
    } catch (err: any) {
      addLog(`Failed to complete booking: ${err.message}`);
    }
  };

  const handleDelete = async (booking: Booking) => {
    const confirmed = window.confirm(`DELETE booking for ${booking.name} entirely from Firestore? This action is IRREVERSIBLE.`);
    if (!confirmed) return;

    try {
      const { sendToken } = await resolveSendCredentials();
      const tokenToUse = sendToken || accessToken;
      if (booking.calendarEventId && tokenToUse) {
        addLog(`Attempting to delete associated Google Calendar event [${booking.calendarEventId}]...`);
        try {
          await deleteGoogleCalendarEvent(booking.calendarEventId, tokenToUse);
          addLog(`- Google Calendar: Successfully deleted calendar event.`);
        } catch (calError: any) {
          addLog(`- Google Calendar Alert: Unable to delete event: ${calError.message}`);
        }
      }
      await deleteDoc(doc(db, "bookings", booking.id!));
      addLog(`Deleted booking document: ${booking.id!!}`);
    } catch (err: any) {
      addLog(`Delete failed: ${err.message}`);
    }
  };

  const getVehicleTypePriceAdjustment = (type: string | undefined) => {
    if (type === "Crossover / Small SUV") return 15;
    if (type === "Large SUV / Truck / Minivan") return 30;
    return 0;
  };

  // Metrics calculators
  const getTotalRevenue = () => {
    return bookings
      .filter(b => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => {
        if (b.status === "completed" && b.actualRevenue !== undefined) {
          return sum + b.actualRevenue;
        }
        return sum + b.price + getVehicleTypePriceAdjustment(b.vehicleType);
      }, 0);
  };

  const getPercentageByStatus = (status: BookingStatusType) => {
    if (bookings.length === 0) return 0;
    const count = bookings.filter(b => b.status === status).length;
    return Math.round((count / bookings.length) * 100);
  };

  const displayedBookings = bookings.filter((b) => {
    if (activeTab === 'completed') {
      return b.status === 'completed';
    } else {
      return b.status !== 'completed';
    }
  });

  if (!isAdminAuth) {
    return (
      <div className="bg-[#fffdfb] border-2 border-[#2e261f] p-8 max-w-md mx-auto text-center"
        style={{ borderRadius: "24px 4px 24px 4px" }}
      >
        <div className="bg-[#fff9e6] border border-amber-300/60 text-[#b45309] p-4 rounded-full max-w-max mx-auto mb-5">
          <Lock className="w-6 h-6 animate-pulse" />
        </div>
        
        <h4 className="text-xl font-serif font-black text-[#2e261f] tracking-tight">Owner Dispatch Portal</h4>
        <p className="text-[#5c544a] text-xs mt-3 leading-relaxed">
          Authorized sign-in is required to secure customer files and synchronize detailing tasks to your business Google Calendar and email pipelines.
        </p>

        {/* Informative benefits row */}
        <div className="my-5 p-3 rounded-xl bg-amber-50/50 border border-amber-200/30 text-[11px] text-[#5c544a] text-left space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <span>🔌 Enabled Integrations:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Google Calendar Dispatching (Automatic event scheduling)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>Gmail Auto-Confirmation (Automated Mime Receipt deliveries)</span>
          </div>
        </div>

        {isInIframe && (
          <div className="mt-4 bg-amber-50 border border-amber-200/60 p-3 rounded-lg text-xs text-left text-amber-900 leading-normal flex gap-2 animate-in fade-in">
            <span className="text-sm mt-0.5">💡</span>
            <span>
              <strong>Running in preview iframe:</strong> If Google pops up are blocked, click the <strong>Open in a new tab</strong> (the square arrow icon) at the top-right corner to load the app directly.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 bg-[#fff1f2] border border-red-200 text-red-800 p-3 rounded-lg gap-2 text-xs text-left flex animate-in fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-sans leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {/* Method 1: Popup Sign In Button */}
          <button
            id="admin_oauth_signin_popup_btn"
            onClick={() => handleLogin("popup")}
            className="w-full py-3 bg-[#b45309] hover:bg-[#9a3412] text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
            style={{ borderRadius: "8px 2px 8px 2px" }}
          >
            <Unlock className="w-4 h-4" />
            Sign In (Google Pop-up)
          </button>

          {/* Method 2: Redirect Sign In Button (Mobile and secure browser fallback) */}
          <button
            id="admin_oauth_signin_redirect_btn"
            onClick={() => handleLogin("redirect")}
            className="w-full py-2.5 bg-white border border-[#e6dccf] text-[#5c544a] hover:text-[#2e261f] hover:bg-[#faf8f5] font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            style={{ borderRadius: "8px 2px 8px 2px" }}
          >
            <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
            Switch to Mobile Redirect Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#fffdfb] border-2 border-[#2e261f] p-6 text-[#2e261f]"
      style={{ borderRadius: "24px 4px 24px 4px" }}
    >
      {/* Header and Sync Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dashed border-[#e6dccf] pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="text-xl font-serif font-black text-[#2e261f]">Owner Dashboard</h4>
            <span className="bg-[#faf5f0] border border-[#e6dccf] text-amber-900 font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">
              {adminUser?.email || "Authorized"}
            </span>
          </div>
          <p className="text-xs text-[#5c544a] mt-1">Real-time detailing dispatch, scheduling queue & database manager.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Autopilot toggle */}
          <button
            id="autopilot_toggle_btn"
            onClick={() => setAutoPilot(!autoPilot)}
            className={`flex items-center gap-2 px-4 py-2 border font-bold text-xs uppercase tracking-wide transition-all duration-200 cursor-pointer ${
              autoPilot
                ? "bg-[#fff9e6] border-[#b45309] text-[#b45309]"
                : "bg-white border-[#e6dccf] text-[#5c544a] hover:bg-[#faf8f5]"
            }`}
            style={{ borderRadius: "8px 2px 8px 2px" }}
          >
            <PlayCircle className="w-4 h-4" />
            Auto-Pilot: {autoPilot ? "Active" : "Disabled"}
          </button>

          {/* Logout btn */}
          <button
            id="admin_logout_btn"
            onClick={handleLogout}
            className="p-2.5 bg-white hover:bg-[#faf8f5] border border-[#e6dccf] text-[#5c544a] hover:text-[#2e261f] transition-all duration-150 cursor-pointer"
            style={{ borderRadius: "8px 2px 8px 2px" }}
            title="Disconnect portal account"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#faf8f5] border border-[#e6dccf] p-4 flex flex-col justify-between"
          style={{ borderRadius: "12px 2px 12px 2px" }}
        >
          <span className="text-[9px] text-[#5c544a] uppercase font-mono font-bold tracking-wider">Total Bookings</span>
          <span className="text-2xl font-serif font-black text-[#2e261f] mt-1">{bookings.length}</span>
        </div>
        <div className="bg-[#faf8f5] border border-[#e6dccf] p-4 flex flex-col justify-between"
          style={{ borderRadius: "12px 2px 12px 2px" }}
        >
          <span className="text-[9px] text-[#5c544a] uppercase font-mono font-bold tracking-wider">Forecast Revenue</span>
          <span className="text-2xl font-serif font-black text-[#b45309] mt-1 flex items-center gap-1">
            ${getTotalRevenue()}
          </span>
        </div>
        <div className="bg-[#faf8f5] border border-[#e6dccf] p-4 flex flex-col justify-between"
          style={{ borderRadius: "12px 2px 12px 2px" }}
        >
          <span className="text-[9px] text-[#5c544a] uppercase font-mono font-bold tracking-wider">Pending Rate</span>
          <span className="text-2xl font-serif font-black text-amber-800 mt-1">{getPercentageByStatus("pending")}%</span>
        </div>
        <div className="bg-[#faf8f5] border border-[#e6dccf] p-4 flex flex-col justify-between"
          style={{ borderRadius: "12px 2px 12px 2px" }}
        >
          <span className="text-[9px] text-[#5c544a] uppercase font-mono font-bold tracking-wider">Confirmed Rate</span>
          <span className="text-2xl font-serif font-black text-emerald-800 mt-1">{getPercentageByStatus("confirmed")}%</span>
        </div>
      </div>

      {/* Main CRM Grid split into List and Telemetry log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bookings Queue Column (Takes 2/3 of space) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#e6dccf] pb-2">
            <h5 className="text-xs font-bold text-[#2e261f] font-mono tracking-widest uppercase">
              {activeTab === 'active' ? "Active Schedule Queue" : "Completed Jobs Record"}
            </h5>
            <div className="flex bg-[#faf8f5] border border-[#e6dccf] p-0.5 rounded-lg gap-1 self-start">
              <button
                id="active_tab_btn"
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-all rounded-md cursor-pointer ${
                  activeTab === 'active'
                    ? "bg-[#b45309] text-white shadow-sm"
                    : "text-[#5c544a] hover:bg-[#efece6] hover:text-[#2e261f]"
                }`}
              >
                Active Queue
              </button>
              <button
                id="completed_tab_btn"
                onClick={() => setActiveTab('completed')}
                className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-all rounded-md cursor-pointer ${
                  activeTab === 'completed'
                    ? "bg-[#b45309] text-white shadow-sm"
                    : "text-[#5c544a] hover:bg-[#efece6] hover:text-[#2e261f]"
                }`}
              >
                Completed ({bookings.filter(b => b.status === "completed").length})
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-10 text-zinc-500 text-xs font-serif italic">Searching driveway schedules...</div>
          ) : displayedBookings.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-xs border border-dashed border-[#e6dccf] p-6"
              style={{ borderRadius: "12px 2px 12px 2px" }}
            >
              {activeTab === 'completed' 
                ? "No completed jobs on record yet." 
                : "No active driveway reservations found in the database."}
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {displayedBookings.map((booking) => (
                <div
                  id={`booking_crm_item_${booking.id}`}
                  key={booking.id}
                  className={`p-4 border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    booking.status === "confirmed" 
                      ? "bg-emerald-50/20 border-emerald-300/60" 
                      : booking.status === "completed"
                      ? "bg-zinc-50/80 border-zinc-250 opacity-90"
                      : booking.status === "cancelled"
                      ? "bg-red-50/15 border-red-200 opacity-60"
                      : "bg-white border-[#e6dccf] hover:border-amber-400"
                  }`}
                  style={{ borderRadius: "12px 2px 12px 2px" }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        booking.status === "confirmed" 
                          ? "bg-emerald-600" 
                          : booking.status === "completed"
                          ? "bg-zinc-500"
                          : booking.status === "cancelled"
                          ? "bg-red-500"
                          : "bg-amber-500 animate-pulse"
                      }`} />
                      <strong className="text-[#2e261f] text-sm font-serif font-black">{booking.name}</strong>
                      <span className="text-[9px] font-mono bg-[#faf5f0] border border-[#e6dccf] text-amber-900 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        {booking.service}
                      </span>
                      {booking.vehicleType && (
                        <span className="text-[9px] font-mono bg-amber-50 border border-amber-250/30 text-amber-900 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          🛞 {booking.vehicleType}
                        </span>
                      )}
                      {booking.status === "completed" && booking.actualRevenue !== undefined ? (
                        <span className="text-[9px] font-mono bg-emerald-100 border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                          ✓ Paid: ${booking.actualRevenue}
                        </span>
                      ) : (
                        <>
                          <span className="text-[9px] font-mono bg-zinc-100 border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded font-black tracking-wider">
                            ${booking.price + getVehicleTypePriceAdjustment(booking.vehicleType)} EST
                          </span>
                          {booking.status === "completed" && (
                            <span className="text-[9px] font-mono bg-zinc-200 border border-zinc-350 text-zinc-700 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                              ✓ Completed
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-[#5c544a]">
                      <span className="flex items-center gap-1 font-mono">
                        <Smartphone className="w-3 h-3 text-zinc-400" />
                        {booking.phone}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Mail className="w-3 h-3 text-zinc-400 truncate max-w-[160px]" />
                        {booking.email}
                      </span>
                      <span className="flex items-center gap-1 col-span-2 mt-1 font-serif italic text-amber-950">
                        <Calendar className="w-3.5 h-3.5 text-amber-700" />
                        {new Date(booking.dateTime).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    {booking.notes && (
                      <div className="mt-2 text-xs bg-amber-550/5 border border-amber-200/50 p-2 rounded-lg text-zinc-700 italic font-sans max-w-sm">
                        <span className="font-bold not-italic text-amber-800 text-[10px] tracking-wider uppercase mr-1">Notes:</span>
                        {booking.notes}
                      </div>
                    )}
                  </div>

                  {/* Operational sync triggers */}
                  <div className="flex items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100 justify-end">
                    {booking.status === "pending" && (
                      <>
                        <button
                          id={`crm_confirm_${booking.id}`}
                          onClick={() => handleConfirm(booking)}
                          className="px-3 py-1.5 bg-[#b45309] text-white text-xs font-bold hover:bg-[#9a3412] active:scale-95 transition-all duration-150 flex items-center gap-1 cursor-pointer"
                          style={{ borderRadius: "6px 2px 6px 2px" }}
                          title="Auto-schedule Google Calendar, Email and text SMS confirmations instantly"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Confirm & Sync
                        </button>
                        <button
                          id={`crm_cancel_${booking.id}`}
                          onClick={() => handleCancel(booking)}
                          className="px-2.5 py-1.5 bg-white text-red-700 border border-[#e6dccf] hover:bg-red-50 text-xs font-bold active:scale-95 transition-all duration-150 cursor-pointer"
                          style={{ borderRadius: "6px 2px 6px 2px" }}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {booking.status === "confirmed" && (
                      <button
                        id={`crm_complete_${booking.id}`}
                        onClick={() => handleComplete(booking)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-95 transition-all duration-150 flex items-center gap-1 cursor-pointer"
                        style={{ borderRadius: "6px 2px 6px 2px" }}
                        title="Mark this reservation as completed"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Complete Job
                      </button>
                    )}

                    <button
                      id={`crm_delete_${booking.id}`}
                      onClick={() => handleDelete(booking)}
                      className="p-2 border border-[#e6dccf] text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all duration-150 cursor-pointer"
                      style={{ borderRadius: "6px 2px 6px 2px" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync telemetry & Admin configuration (Takes 1/3) */}
        <div className="space-y-6">
          
          <div className="bg-[#faf8f5] border border-[#e6dccf] p-4"
            style={{ borderRadius: "16px 2px 16px 2px" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h5 className="text-[10px] font-bold text-[#2e261f] font-mono tracking-wider uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-800" />
                INTEGRATION LOGS
              </h5>
              {syncLogs.length > 0 && (
                <button
                  id="clear_integration_logs_btn"
                  onClick={() => setSyncLogs([])}
                  className="text-[9px] font-mono font-bold text-amber-950 bg-amber-100 hover:bg-amber-250 border border-amber-300 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="bg-white border border-[#e6dccf] rounded p-3 h-40 overflow-y-auto text-[10px] font-mono text-zinc-700 space-y-1 shadow-inner">
              {syncLogs.length === 0 ? (
                <div className="text-zinc-400 italic">No schedules processed in this admin session. Logs will stream here in real-time...</div>
              ) : (
                syncLogs.map((log, lIdx) => <div key={lIdx} className="leading-relaxed border-b border-zinc-100 pb-1 break-words">{log}</div>)
              )}
            </div>
          </div>

          {/* Secure Admin Note */}
          <div className="p-4 bg-[#fff9e6] border border-amber-200 rounded-xl flex gap-3 text-xs text-amber-900 leading-normal">
            <UserCheck className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#2e261f] font-bold block font-serif">Automatic Calendar Integration</strong>
              When you sync a pending slot, it is automatically scheduled on your primary business Google Calendar, and confirmations are emailed through your Google OAuth pipeline.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
