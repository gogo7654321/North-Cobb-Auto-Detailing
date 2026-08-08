import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import dbAdmin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import https from "https";

// Load environment variables
dotenv.config();

import fs from "fs";

// Read configurations directly from the provisioned firebase-applet-config.json
let activeProjectId = "north-cobb-detailing";
let activeDatabaseId = "";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (configData.projectId) activeProjectId = configData.projectId.trim();
    if (configData.firestoreDatabaseId) activeDatabaseId = configData.firestoreDatabaseId.trim();
    console.log(`[Firebase Admin Server] Loaded config from file: Project=${activeProjectId}, Database=${activeDatabaseId}`);
  } else {
    const envProjId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (envProjId && envProjId !== "undefined") {
      activeProjectId = envProjId.trim();
    }
    const envDbId = process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;
    if (envDbId && envDbId !== "undefined") {
      activeDatabaseId = envDbId.trim();
    }
    console.log(`[Firebase Admin Server] Loaded config from env: Project=${activeProjectId}, Database=${activeDatabaseId}`);
  }
} catch (e) {
  console.error("Failed to parse firebase-applet-config.json: ", e);
}

// Ensure proper fallback to the active Firestore Database ID for production
if (!activeDatabaseId && (activeProjectId === "north-cobb-detailing" || !activeProjectId)) {
  activeDatabaseId = "ai-studio-156f4116-40a7-4fe1-9027-3f4cb246d038";
  console.log(`[Firebase Admin Server] Using fallback Database: ${activeDatabaseId}`);
}

// Initialize Firebase Admin safely
if (dbAdmin.apps.length === 0) {
  if (activeProjectId) {
    dbAdmin.initializeApp({
      projectId: activeProjectId
    });
  } else {
    dbAdmin.initializeApp();
  }
}
const firestoreDb = activeDatabaseId ? getFirestore(dbAdmin.app(), activeDatabaseId) : getFirestore(dbAdmin.app());

const app = express();
const PORT = 3000;

app.use(express.json());

// Self-healing multi-candidate SMTP Dispatch helper specifically solving gmail app password email assignment conflicts
async function sendSmtpEmail(options: {
  to: string;
  cc?: string | string[];
  senderName?: string;
  subject: string;
  html: string;
  adminEmail?: string;
  icalEvent?: {
    method: string;
    filename?: string;
    content: string;
  };
}) {
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailAppPassword) {
    throw new Error("GMAIL_APP_PASSWORD environment variable is not configured.");
  }

  // Strict Directive: All auto-sent business emails must be routed via "northcobbdetailing@gmail.com".
  // We completely filter out any other candidate emails (including "npatel012010@gmail.com").
  const candidates = new Set<string>();
  candidates.add("northcobbdetailing@gmail.com");

  const candidateList = Array.from(candidates);
  let lastError: any = null;

  for (const candidateUser of candidateList) {
    try {
      console.log(`[SMTP Attempt] Authenticating SMTP as host user: ${candidateUser}...`);
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: candidateUser,
          pass: gmailAppPassword
        }
      });

      const displaySender = options.senderName || "North Cobb Detailing";

      await transporter.sendMail({
        from: `"${displaySender}" <${candidateUser}>`,
        to: options.to,
        cc: options.cc,
        subject: options.subject,
        html: options.html,
        icalEvent: options.icalEvent
      });

      console.log(`[SMTP Success] Email dispatched to ${options.to} successfully via host: ${candidateUser}`);
      return { success: true, authenticatedUser: candidateUser };
    } catch (err: any) {
      console.error(`[SMTP Failed] Attempt using host user ${candidateUser} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`SMTP authentication failed for all potential account configurations (${candidateList.join(", ")}). Last SMTP error: ${lastError?.message || lastError}`);
}

// Debug Firebase Environment Variables to resolve project and database configuration discrepancy
app.get("/api/debug-firebase-env", (req, res) => {
  const envs: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("VITE_") || key.includes("FIREBASE") || key.includes("FIRESTORE") || key.includes("PROJECT")) {
      envs[key] = process.env[key] || "";
    }
  }
  res.json({
    envs,
    activeProjectId,
    activeDatabaseId,
    isCustomUnauthorisedProject: false
  });
});

// Cloud Function equivalent API for real-time automated bookings
app.post("/api/cloud-functions-booking", async (req, res) => {
  const { bookingId, bookingData } = req.body;
  
  // Strict Zero-Trust validation on document ID format and length to prevent resource poisoning
  if (!bookingId || typeof bookingId !== "string" || bookingId.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(bookingId)) {
    return res.status(400).json({ error: "Invalid bookingId. Must be a safe document ID alphanumeric string." });
  }

  try {
    let booking = bookingData;
    
    if (!booking) {
      console.log(`[Cloud Function Proxy] bookingData not provided in request. Attempting to fetch from Firestore...`);
      try {
        const bookingDoc = await firestoreDb.collection("bookings").doc(bookingId).get();
        if (bookingDoc.exists) {
          booking = bookingDoc.data();
        }
      } catch (dbErr: any) {
        console.warn(`[Cloud Function Proxy] Server-side Firestore read of booking ${bookingId} skipped/failed: ${dbErr?.message || dbErr}`);
      }
    }

    if (!booking) {
      return res.status(404).json({ error: `Booking data was not provided and could not be retrieved from Firestore.` });
    }
    console.log(`[Cloud Function Proxy] Loaded booking for ${booking.name}:`, booking);

    // Fetch the stored owner OAuth token
    let accessToken: string | null = null;
    let adminEmail = "northcobbdetailing@gmail.com";

    try {
      const adminDoc = await firestoreDb.collection("admin_config").doc("oauth").get();
      if (adminDoc.exists) {
        const adminData = adminDoc.data();
        accessToken = adminData?.accessToken || null;
        adminEmail = adminData?.email || "northcobbdetailing@gmail.com";
        console.log(`[Cloud Function Proxy] Found cached Owner Token for ${adminEmail}`);
      }
    } catch (dbErr: any) {
      console.warn(`[Cloud Function Proxy] Server-side Firestore read of admin_config failed (this is expected when running in sandboxed servers). Falling back. Error: ${dbErr?.message || dbErr}`);
    }

    let ownerAlertSuccess = false;

    // Send Admin Notification Email via Gmail API or Nodemailer SMTP to "everybody who has auth in the owner portal"
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    const senderEmail = process.env.SENDER_EMAIL || adminEmail || "northcobbdetailing@gmail.com";

    if (gmailAppPassword || accessToken) {
      try {
        const [datePart, timePart] = (booking.dateTime || "").split("T");
        const [year, month, day] = (datePart || "").split("-");
        const [hour, minute] = (timePart || "00:00:00").split(":");
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(month, 10) - 1] || "Selected Date";
        const h12 = parseInt(hour, 10) || 0;
        const ampm = h12 >= 12 ? "PM" : "AM";
        const hour12 = h12 % 12 === 0 ? 12 : h12 % 12;
        const formattedDate = `${monthName} ${parseInt(day, 10) || ""}, ${year || ""} at ${hour12}:${minute || "00"} ${ampm}`;

        const authorizedEmails = ["npatel012010@gmail.com", "northcobbdetailing@gmail.com"];
        const dynamicEmails = new Set<string>(authorizedEmails);
        try {
          const authOwnersColl = await firestoreDb.collection("authenticated_owners").get();
          authOwnersColl.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.email) {
              dynamicEmails.add(data.email.trim());
            }
          });
        } catch (dbErr) {
          console.error("[Cloud Function Proxy] Could not query authenticated_owners:", dbErr);
        }
        const finalRecipients = Array.from(dynamicEmails);

        const subject = `🚨 Action Required: New Detailing Job Requested - ${booking.service}`;

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Detailing Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fffdfb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2e261f;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffdfb; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Card Wrapper -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e6dccf; border-radius: 16px 2px 16px 2px; overflow: hidden; box-shadow: 0 4px 12px rgba(46, 38, 31, 0.05);">
          
          <!-- Banner Header -->
          <tr>
            <td style="background-color: #2e261f; padding: 30px 24px; text-align: left; border-bottom: 3px solid #b45309;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Logo Image -->
                  <td width="60" valign="middle">
                    <img src="https://north-cobb-detailing-139121508979.us-west1.run.app/North_CObb_Detailing.PNG" alt="North Cobb Detailing Logo" width="50" height="50" style="display: block; border-radius: 8px 2px 8px 2px; border: 1px solid #e6dccf; background-color: #ffffff; object-fit: contain;" />
                  </td>
                  <!-- Title text -->
                  <td valign="middle" style="padding-left: 15px;">
                    <span style="font-size: 11px; font-weight: bold; font-family: ui-monospace, 'SF Mono', SFMono-Regular, Consolas, monospace; letter-spacing: 0.15em; color: #b45309; text-transform: uppercase; display: block; margin-bottom: 2px;">AUTOMATION PIPELINE</span>
                    <span style="font-size: 18px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #ffffff; letter-spacing: -0.01em;">NORTH COBB DETAILING</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 24px;">
              
              <!-- Tag/Badge -->
              <span style="display: inline-block; background-color: #fff7ed; border: 1px solid #ffedd5; color: #c2410c; font-family: ui-monospace, 'SF Mono', monospace; font-size: 10px; font-weight: 850; padding: 4px 10px; border-radius: 4px 1px 4px 1px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 18px;">
                🚨 Action Required • Pending Review
              </span>

              <h1 style="font-size: 20px; font-weight: 700; color: #1c1917; margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: -0.01em;">
                A new mobile detailing job is waiting for your approval!
              </h1>
              
              <p style="font-size: 14px; line-height: 1.6; color: #44403c; margin: 0 0 24px 0;">
                Hi Team, a new driveway detail has been submitted by a customer. Please check the Owner Portal to accept this booking, which will instantly calendar the appointment, invite the client, and trigger their secure proof of purchase receipt.
              </p>

              <!-- Stats / Details Container -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf8f5; border: 1px solid #e6dccf; border-radius: 12px 2px 12px 2px; padding: 20px; margin-bottom: 28px;">
                <tr>
                  <td>
                    <h3 style="font-size: 11px; font-weight: bold; color: #57534e; font-family: ui-monospace, 'SF Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 14px 0; border-bottom: 1px dashed #e6dccf; padding-bottom: 8px;">
                      Requested Detailing Details
                    </h3>

                    <!-- Detail rows -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                      <tr>
                        <td width="130" style="padding: 6px 0; font-weight: 600; color: #78716c;">🚗 Package:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #1c1917;">${booking.service}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">📅 Date & Time:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #b45309;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">💰 Price Estimate:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #1c1917;">$${booking.price} Base</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">👤 Customer Name:</td>
                        <td style="padding: 6px 0; color: #1c1917;">${booking.name}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">📞 Contact Phone:</td>
                        <td style="padding: 6px 0; color: #1c1917;"><a href="tel:${booking.phone}" style="color: #b45309; text-decoration: none; font-weight: 600;">${booking.phone}</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #78716c;">✉️ Client Email:</td>
                        <td style="padding: 6px 0; color: #1c1917;"><a href="mailto:${booking.email}" style="color: #b45309; text-decoration: none;">${booking.email}</a></td>
                      </tr>
                      <tr>
                        <td valign="top" style="padding: 6px 0; font-weight: 600; color: #78716c;">📝 Special Notes:</td>
                        <td style="padding: 6px 0; color: #44403c; line-height: 1.4;">${booking.notes || "None"}</td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="https://northcobbdetailing.com/#owner-portal" target="_blank" style="display: inline-block; background-color: #b45309; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 14px 28px; border-radius: 8px 2px 8px 2px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px rgba(180, 83, 9, 0.15); transition: background-color 0.15s ease;">
                      Open Owner Portal & Accept Job
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; border-top: 1px solid #e6dccf; padding: 24px; text-align: center;">
              <p style="font-size: 11px; font-family: ui-monospace, 'SF Mono', monospace; font-weight: bold; color: #a8a29e; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 10px 0;">
                North Cobb Detailing LLC
              </p>
              <p style="font-size: 11px; line-height: 1.5; color: #78716c; margin: 0;">
                Fast, Reliable, and Dedicated Hand Care.<br/>
                This is an automated system dispatch. Do not reply directly to this mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        let sentCount = 0;
        let smtpErrorDetails = "";

        if (gmailAppPassword) {
          console.log(`[Cloud Function Proxy] Dispatching stable notifications via Nodemailer SMTP...`);
          try {
            await sendSmtpEmail({
              to: "northcobbdetailing@gmail.com",
              cc: "npatel012010@gmail.com",
              senderName: "North Cobb Detailing Automation",
              subject: subject,
              html: htmlContent,
              adminEmail: adminEmail
            });
            sentCount = 1;
            console.log(`[Cloud Function Proxy] SMTP Notification successfully sent to northcobbdetailing@gmail.com with CC to npatel012010@gmail.com`);
          } catch (smtpErr: any) {
            smtpErrorDetails = smtpErr?.message || String(smtpErr);
            console.error(`[Cloud Function Proxy] SMTP Notification failed:`, smtpErr);
          }
        }

        // Cascade/Fallback to Gmail Rest API if SMTP was not attempted or failed entirely
        if (sentCount === 0 && accessToken && adminEmail === "northcobbdetailing@gmail.com") {
          console.log(`[Cloud Function Proxy] SMTP not available/failed (${smtpErrorDetails}). Cascading to Google REST API dispatch...`);
          for (const recipient of finalRecipients) {
            try {
              const rawMime = [
                `To: ${recipient}`,
                `Subject: ${subject}`,
                `Content-Type: text/html; charset="utf-8"`,
                `MIME-Version: 1.0`,
                ``,
                htmlContent
              ].join("\r\n");

              const base64Mime = Buffer.from(rawMime, "utf-8")
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");

              const mailRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ raw: base64Mime })
              });

              if (mailRes.ok) {
                sentCount++;
              } else {
                const mailErrText = await mailRes.text();
                console.error(`[Cloud Function Proxy] Gmail OAuth dispatch failed for ${recipient}:`, mailErrText);
              }
            } catch (apiErr) {
              console.error(`[Cloud Function Proxy] Exception during Gmail REST API dispatch for ${recipient}:`, apiErr);
            }
          }
        }

        if (sentCount > 0) {
          ownerAlertSuccess = true;
          console.log(`[Cloud Function Proxy] Sent alert emails to ${sentCount} owner(s).`);
        }
      } catch (mailErr: any) {
        console.error("[Cloud Function Proxy] Gmail API/SMTP dispatch exception:", mailErr);
      }
    } else {
      console.log("[Cloud Function Proxy] Owner alert email skipped. Neither GMAIL_APP_PASSWORD nor OAuth accessToken is available.");
    }

    // Keep the Firestore booking in 'pending' status so the owners can accept it in portal
    console.log(`[Cloud Function Proxy] Booking ${bookingId} kept in PENDING status for admin review.`);

    return res.json({
      status: "success",
      bookingId,
      notifications: {
        ownerAlert: ownerAlertSuccess
      }
    });

  } catch (error: any) {
    console.error("[Cloud Function Proxy] Fatal execution error:", error);
    return res.status(500).json({ error: error.message || "Failed execution of Cloud Function booking pipeline." });
  }
});

// Secure API endpoint to dispatch buyer confirmations via server-side GMAIL_APP_PASSWORD (SMTP)
app.post("/api/send-customer-confirmation", async (req, res) => {
  const { recipientEmail, subject, htmlContent, calendarEvent } = req.body;
  if (!recipientEmail || !subject || !htmlContent) {
    return res.status(400).json({ error: "Missing recipientEmail, subject, or htmlContent parameters." });
  }

  try {
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    if (!gmailAppPassword) {
      return res.status(400).json({ error: "Gmail App Password is not configured on the server environment variables." });
    }

    // Resolve owner active email to pass down as a candidate
    let adminEmail = "northcobbdetailing@gmail.com";
    try {
      const adminDoc = await firestoreDb.collection("admin_config").doc("oauth").get();
      if (adminDoc.exists) {
        adminEmail = adminDoc.data()?.email || "northcobbdetailing@gmail.com";
      }
    } catch (dbErr: any) {
      console.warn(`[SMTP Dispatch] Admin Firestore read admin_config skipped/failed (expected when running in sandboxed environments). Proceeding with fallback adminEmail: ${adminEmail}. Error: ${dbErr?.message || dbErr}`);
    }

    let icalEventOption: any = undefined;
    const ccEmails = ["northcobbdetailing@gmail.com", "npatel012010@gmail.com"];
    
    if (calendarEvent) {
      try {
        const { bookingId, name, dateTime, service, vehicleType, price, phone } = calendarEvent;
        const startDateObj = new Date(dateTime);
        const durationHours = service === "Full Detail" ? 3 : (service === "Interior Detail" ? 2 : 1);
        const endDateObj = new Date(startDateObj.getTime() + durationHours * 60 * 60 * 1000);

        const formatIcsDate = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        };

        const dtStamp = formatIcsDate(new Date());
        const dtStart = formatIcsDate(startDateObj);
        const dtEnd = formatIcsDate(endDateObj);

        const summary = `🚗 North Cobb Detailing: ${service} (${vehicleType || "Sedan / Coupe"}) - ${name}`;
        const descriptionRaw = `Mobile Vehicle Detailing Booking Request.\n\n` +
          `Customer Contact:\n` +
          `- Name: ${name}\n` +
          `- Phone: ${phone || "N/A"}\n` +
          `- Email: ${recipientEmail}\n\n` +
          `Package Details:\n` +
          `- Service: ${service}\n` +
          `- Vehicle Type: ${vehicleType || "Sedan / Coupe"}\n` +
          `- Estimate: $${price}\n\n` +
          `Sync status: Real-time Scheduled`;

        const descriptionEscaped = descriptionRaw.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

        const icalContent = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//North Cobb Detailing//Appointment Calendar//EN",
          "METHOD:REQUEST",
          "BEGIN:VEVENT",
          `UID:booking-${bookingId || Date.now()}@northcobbdetailing.com`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${descriptionEscaped}`,
          `LOCATION:Mobile - We Come to Your Driveway!`,
          `ORGANIZER;CN="North Cobb Detailing":MAILTO:northcobbdetailing@gmail.com`,
          `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${name}":MAILTO:${recipientEmail}`,
          `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="North Cobb Detailing":MAILTO:northcobbdetailing@gmail.com`,
          `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="Owner":MAILTO:npatel012010@gmail.com`,
          "END:VEVENT",
          "END:VCALENDAR"
        ].join("\r\n");

        icalEventOption = {
          filename: "invite.ics",
          method: "REQUEST",
          content: icalContent
        };
        console.log(`[SMTP Dispatch] Successfully generated iCalendar invitation for ${name}`);
      } catch (icalErr) {
        console.error("[SMTP Dispatch] Failed to generate ics invitation:", icalErr);
      }
    }

    console.log(`[SMTP Dispatch] Sending customer receipt to ${recipientEmail} via self-healing sendSmtpEmail...`);

    await sendSmtpEmail({
      to: recipientEmail,
      cc: calendarEvent ? ccEmails : undefined,
      senderName: "North Cobb Detailing",
      subject: subject,
      html: htmlContent,
      adminEmail: adminEmail,
      icalEvent: icalEventOption
    });

    console.log(`[SMTP Dispatch] Customer confirmation successfully sent to ${recipientEmail}`);
    return res.json({ status: "success" });
  } catch (error: any) {
    console.error("[SMTP Dispatch] Error sending customer email:", error);
    return res.status(500).json({ error: error.message || "SMTP dispatch failed." });
  }
});

// Proxy Firebase Auth redirect callbacks from the local domain to the original Firebase project domain
// This resolves Mobile Chrome & Safari blocking cookies/sessionStorage across third-party redirect domains.
app.all("/__/auth/*", (req, res) => {
  let authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || "north-cobb-detailing.firebaseapp.com";
  if (authDomain && typeof authDomain === "string") {
    authDomain = authDomain.trim();
    if (authDomain.endsWith("/")) {
      authDomain = authDomain.slice(0, -1);
    }
    if (authDomain.toLowerCase().endsWith(".firebaseapp.co")) {
      authDomain = authDomain.slice(0, -3) + ".com";
    } else if (authDomain.toLowerCase().endsWith(".co")) {
      authDomain = authDomain.slice(0, -3) + ".com";
    }
  }

  const targetUrl = `https://${authDomain}${req.originalUrl}`;
  console.log(`[Firebase Auth Proxy] Piping local request [${req.method}] ${req.originalUrl} to auth domain: ${targetUrl}`);

  const urlParsed = new URL(targetUrl);
  const headers = { ...req.headers };
  
  // CRITICAL: Host header must match target authDomain so Google/Firebase CDN routes correctly
  headers["host"] = authDomain;
  delete headers["connection"];
  delete headers["keep-alive"];

  const proxyReq = https.request({
    method: req.method,
    hostname: urlParsed.hostname,
    path: urlParsed.pathname + urlParsed.search,
    headers: headers,
    rejectUnauthorized: false
  }, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    Object.keys(proxyRes.headers).forEach((key) => {
      if (!["connection", "keep-alive", "transfer-encoding"].includes(key.toLowerCase())) {
        res.setHeader(key, proxyRes.headers[key]!);
      }
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`[Firebase Auth Proxy Error] Failed to proxy to ${targetUrl}: `, err);
    res.status(500).send("Auth proxy error");
  });

  req.pipe(proxyReq);
});

// --- SERVER-SIDE DB PROXY ENDPOINTS (Solving Firestore permission errors) ---

// Helper to assert owner email
async function verifyOwnerEmailHeader(req: express.Request): Promise<boolean> {
  const email = req.headers["x-owner-email"];
  if (!email || typeof email !== "string") return false;
  
  const authorizedEmails = ["npatel012010@gmail.com", "northcobbdetailing@gmail.com"];
  if (authorizedEmails.includes(email)) return true;

  try {
    const docSnap = await firestoreDb.collection("authenticated_owners").doc(email).get();
    if (docSnap.exists) {
      return true;
    }
  } catch (err) {
    console.error("Failed to verify owner email from DB:", err);
  }
  return false;
}

// 1. Save Owner OAuth Token
app.post("/api/save-owner-token", async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ error: "Missing email or token." });
  }

  const authorizedEmails = ["npatel012010@gmail.com", "northcobbdetailing@gmail.com"];
  if (!authorizedEmails.includes(email)) {
    return res.status(403).json({ error: "Unauthorized email." });
  }

  const oauthData = {
    accessToken: token,
    updatedAt: new Date().toISOString(),
    email: email
  };

  const ownerData = {
    email: email,
    accessToken: token,
    updatedAt: new Date().toISOString(),
    hasToken: true
  };

  try {
    if (email === "northcobbdetailing@gmail.com") {
      await firestoreDb.collection("admin_config").doc("oauth").set(oauthData);
      console.log(`[Server DB Proxy] Stored OAuth token for northcobbdetailing@gmail.com`);
    }

    await firestoreDb.collection("authenticated_owners").doc(email).set(ownerData);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Server DB Proxy] Save Owner Token Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to save token to database." });
  }
});

// 2. Gallery Images: Read
app.get("/api/gallery-images", async (req, res) => {
  try {
    const snapshot = await firestoreDb.collection("gallery_images")
      .orderBy("createdAt", "desc")
      .get();
    
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return res.json(items);
  } catch (err: any) {
    console.error("[Server DB Proxy] Get Gallery Images Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve gallery images." });
  }
});

// 3. Gallery Images: Write
app.post("/api/gallery-images", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const { url, name, caption, storagePath } = req.body;
  if (!url || !name) {
    return res.status(400).json({ error: "Missing required fields (url, name)." });
  }

  const imageData = {
    url,
    name,
    caption: caption || "Migrated Driveway Portfolio Asset",
    storagePath: storagePath || "",
    createdAt: new Date().toISOString()
  };

  try {
    const r = await firestoreDb.collection("gallery_images").add(imageData);
    return res.json({ success: true, id: r.id });
  } catch (err: any) {
    console.error("[Server DB Proxy] Add Gallery Image Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to add gallery image." });
  }
});

// 4. Gallery Images: Delete
app.delete("/api/gallery-images/:id", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const { id } = req.params;
  try {
    await firestoreDb.collection("gallery_images").doc(id).delete();
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Server DB Proxy] Delete Gallery Image Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to delete gallery image." });
  }
});

// 5. Bookings: Read
app.get("/api/bookings", async (req, res) => {
  try {
    const snapshot = await firestoreDb.collection("bookings")
      .orderBy("dateTime", "asc")
      .get();
    
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return res.json(items);
  } catch (err: any) {
    console.error("[Server DB Proxy] Get Bookings Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve bookings." });
  }
});

// Dynamic Weekly Schedule Settings & Helper functions
const DEFAULT_WEEKLY_SCHEDULE: Record<string, { status: string; blockedStart?: string; blockedEnd?: string; note?: string }> = {
  monday: { status: "blocked_hours", blockedStart: "08:00", blockedEnd: "15:30", note: "Student school hours" },
  tuesday: { status: "blocked_hours", blockedStart: "08:00", blockedEnd: "15:30", note: "Student school hours" },
  wednesday: { status: "blocked_hours", blockedStart: "08:00", blockedEnd: "15:30", note: "Student school hours" },
  thursday: { status: "blocked_hours", blockedStart: "08:00", blockedEnd: "15:30", note: "Student school hours" },
  friday: { status: "blocked_hours", blockedStart: "08:00", blockedEnd: "15:30", note: "Student school hours" },
  saturday: { status: "open_all_day", blockedStart: "", blockedEnd: "", note: "Open all day" },
  sunday: { status: "open_all_day", blockedStart: "", blockedEnd: "", note: "Open all day" }
};

async function getWeeklyScheduleConfig() {
  try {
    const docSnap = await firestoreDb.collection("settings").doc("weekly_schedule").get();
    if (docSnap.exists) {
      return { ...DEFAULT_WEEKLY_SCHEDULE, ...docSnap.data() };
    }
  } catch (err) {
    console.warn("[Server DB Proxy] Failed to fetch weekly schedule settings from Firestore, using defaults:", err);
  }
  return DEFAULT_WEEKLY_SCHEDULE;
}

function getDayOfWeekName(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[d.getDay()] || "";
}

function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(n => parseInt(n, 10));
  if (isNaN(h)) return 0;
  return h * 60 + (isNaN(m) ? 0 : m);
}

function isSlotBlockedByWeeklySchedule(dateStr: string, timeStr: string, scheduleConfig: any): { blocked: boolean; reason?: string } {
  if (!dateStr || !timeStr || timeStr === "12:00") return { blocked: false };
  const dayName = getDayOfWeekName(dateStr);
  if (!dayName || !scheduleConfig || !scheduleConfig[dayName]) return { blocked: false };

  const dayRule = scheduleConfig[dayName];
  if (dayRule.status === "blocked_all_day") {
    return { blocked: true, reason: dayRule.note || `${dayName.toUpperCase()} is marked as unavailable by the owner.` };
  }

  if (dayRule.status === "blocked_hours" && dayRule.blockedStart && dayRule.blockedEnd) {
    const slotMins = timeStringToMinutes(timeStr);
    const startMins = timeStringToMinutes(dayRule.blockedStart);
    const endMins = timeStringToMinutes(dayRule.blockedEnd);
    if (slotMins >= startMins && slotMins <= endMins) {
      return { 
        blocked: true, 
        reason: dayRule.note || `Hours between ${dayRule.blockedStart} and ${dayRule.blockedEnd} on ${dayName.toUpperCase()}s are blocked by the owner.`
      };
    }
  }

  return { blocked: false };
}

// Bookings: Public Busy-slots (Only returns safe time & status indicators for busy slots)
app.get("/api/busy-slots", async (req, res) => {
  try {
    const snapshot = await firestoreDb.collection("bookings").get();
    const slots: any[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.dateTime && (data.status === "pending" || data.status === "confirmed")) {
        slots.push({
          id: docSnap.id,
          dateTime: data.dateTime,
          status: data.status
        });
      }
    });

    // Merge blocked slots from the owner portal
    try {
      const blockedSnapshot = await firestoreDb.collection("blocked_slots").get();
      blockedSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.date && data.timeSlot) {
          if (data.timeSlot === "all") {
            const standardSlots = ["09:00", "14:00", "18:00", "12:00"];
            standardSlots.forEach((slot) => {
              slots.push({
                id: `${docSnap.id}_${slot}`,
                dateTime: `${data.date}T${slot}:00`,
                status: "confirmed",
                isBlocked: true,
                reason: data.reason
              });
            });
          } else {
            slots.push({
              id: docSnap.id,
              dateTime: `${data.date}T${data.timeSlot}:00`,
              status: "confirmed",
              isBlocked: true,
              reason: data.reason
            });
          }
        }
      });
    } catch (blockedErr) {
      console.warn("[Server DB Proxy] Failed to fetch blocked slots for busy slots calculation:", blockedErr);
    }

    const weeklySchedule = await getWeeklyScheduleConfig();

    return res.json({ slots, weeklySchedule });
  } catch (err: any) {
    console.error("[Server DB Proxy] Get busy slots Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve busy slots." });
  }
});

// 6. Bookings: Create/Set
app.post("/api/bookings", async (req, res) => {
  const { id, data } = req.body;
  if (!data) {
    return res.status(400).json({ error: "Missing booking data." });
  }

  try {
    if (data.dateTime) {
      const [bDate, bTime] = data.dateTime.split("T");
      const bHourMin = bTime ? bTime.substring(0, 5) : "";
      
      // Dynamic Weekly Schedule Check
      const scheduleConfig = await getWeeklyScheduleConfig();
      const weeklyCheck = isSlotBlockedByWeeklySchedule(bDate, bHourMin, scheduleConfig);
      if (weeklyCheck.blocked) {
        return res.status(400).json({ 
          error: weeklyCheck.reason || "The selected time falls outside of the owner's operating hours." 
        });
      }

      const docIdSpecific = `${bDate}_${bHourMin}`;
      const docIdAll = `${bDate}_all`;
      
      const [specificSnap, allSnap] = await Promise.all([
        firestoreDb.collection("blocked_slots").doc(docIdSpecific).get(),
        firestoreDb.collection("blocked_slots").doc(docIdAll).get()
      ]);
      
      if (specificSnap.exists || allSnap.exists) {
        return res.status(400).json({ error: "The selected date or time slot has been blocked out by the owner. Please select another slot." });
      }
    }

    if (id) {
      await firestoreDb.collection("bookings").doc(id).set(data);
      return res.json({ success: true, id });
    } else {
      const r = await firestoreDb.collection("bookings").add(data);
      return res.json({ success: true, id: r.id });
    }
  } catch (err: any) {
    console.error("[Server DB Proxy] Create Booking Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to create booking." });
  }
});

// 7. Bookings: Update (Patch)
app.patch("/api/bookings/:id", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const { id } = req.params;
  const updates = req.body;
  if (!updates) {
    return res.status(400).json({ error: "Missing booking updates." });
  }

  try {
    await firestoreDb.collection("bookings").doc(id).update(updates);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Server DB Proxy] Patch Booking Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to update booking." });
  }
});

// 8. Bookings: Delete
app.delete("/api/bookings/:id", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const { id } = req.params;
  try {
    await firestoreDb.collection("bookings").doc(id).delete();
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Server DB Proxy] Delete Booking Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to delete booking." });
  }
});

// 9. Blocked Slots: Read
app.get("/api/blocked-slots", async (req, res) => {
  try {
    const snapshot = await firestoreDb.collection("blocked_slots")
      .orderBy("date", "asc")
      .get();
    
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return res.json(items);
  } catch (err: any) {
    console.error("[Server DB Proxy] Get Blocked Slots Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve blocked slots." });
  }
});

// 9.5 Weekly Schedule: Read & Save
app.get("/api/weekly-schedule", async (req, res) => {
  try {
    const config = await getWeeklyScheduleConfig();
    return res.json(config);
  } catch (err: any) {
    console.error("[Server DB Proxy] Get Weekly Schedule failed:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve weekly schedule." });
  }
});

app.post("/api/weekly-schedule", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const newSchedule = req.body;
  if (!newSchedule || typeof newSchedule !== "object") {
    return res.status(400).json({ error: "Invalid schedule payload." });
  }

  try {
    await firestoreDb.collection("settings").doc("weekly_schedule").set(newSchedule, { merge: true });
    return res.json({ success: true, schedule: newSchedule });
  } catch (err: any) {
    console.error("[Server DB Proxy] Save Weekly Schedule failed:", err);
    return res.status(500).json({ error: err.message || "Failed to update weekly schedule." });
  }
});

// 10. Blocked Slots: Write
app.post("/api/blocked-slots", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const { date, timeSlot, reason } = req.body;
  if (!date || !timeSlot) {
    return res.status(400).json({ error: "Missing required fields (date, timeSlot)." });
  }

  // Generate standard document ID so we can query it easily from security rules: YYYY-MM-DD_timeSlot (e.g., 2026-06-28_all)
  const docId = `${date}_${timeSlot}`;
  const blockData = {
    date,
    timeSlot,
    reason: reason || "Unavailable",
    createdAt: new Date().toISOString(),
    createdBy: req.headers["x-owner-email"] || "northcobbdetailing@gmail.com"
  };

  try {
    await firestoreDb.collection("blocked_slots").doc(docId).set(blockData);
    return res.json({ success: true, id: docId });
  } catch (err: any) {
    console.error("[Server DB Proxy] Add Blocked Slot Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to add blocked slot." });
  }
});

// 11. Blocked Slots: Delete
app.delete("/api/blocked-slots/:id", async (req, res) => {
  if (!(await verifyOwnerEmailHeader(req))) {
    return res.status(403).json({ error: "Unauthorized access: Owner only." });
  }

  const { id } = req.params;
  try {
    await firestoreDb.collection("blocked_slots").doc(id).delete();
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Server DB Proxy] Delete Blocked Slot Firestore failed:", err);
    return res.status(500).json({ error: err.message || "Failed to delete blocked slot." });
  }
});

// Configure Vite middleware or production asset hosting
async function configureApp() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded as Express middleware.");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from compiled dist/ workspace.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running at http://localhost:${PORT}`);
  });
}

configureApp().catch((err) => {
  console.error("Express Applet Initialization Error:", err);
});
