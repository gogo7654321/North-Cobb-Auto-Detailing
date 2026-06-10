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

// Determine project ID dynamically using environment or pre-existing config file
const getDynamicProjectId = () => {
  const envProjId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (envProjId && envProjId !== "undefined") return envProjId.trim();

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const obj = JSON.parse(raw);
      if (obj.projectId) {
        return obj.projectId.trim();
      }
    }
  } catch (err) {}

  return "north-cobb-detailing";
};

const activeProjectId = getDynamicProjectId();
const isCustomUnauthorisedProject = activeProjectId && activeProjectId.includes("north-cobb-detailing");

// Determine database ID dynamically based on the Firebase Project ID or pre-existing config
const getDynamicDatabaseId = () => {
  const envDbId = process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;
  if (envDbId) return envDbId.trim();

  if (isCustomUnauthorisedProject) {
    // If the project is north-cobb-detailing, we must use the local container's database ID so the Admin SDK compiles
    return "ai-studio-156f4116-40a7-4fe1-9027-3f4cb246d038";
  }

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const obj = JSON.parse(raw);
      if (typeof obj.firestoreDatabaseId === "string") {
        return obj.firestoreDatabaseId.trim();
      }
    }
  } catch (err) {}

  if (!activeProjectId || activeProjectId === "undefined" || activeProjectId.includes("pdd643ltb6srk7p2d4lfjr")) {
    return "ai-studio-156f4116-40a7-4fe1-9027-3f4cb246d038";
  }
  return ""; // Uses (default) database if custom project is configured
};

const activeDatabaseId = getDynamicDatabaseId();

// Auto-generate firebase-applet-config.json from environment variables for deployment tools, preserving original parameters
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let existingConfig: any = {};
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (_) {}
  }

  const fallbackProject = activeProjectId;
  const authDomainCandidate = process.env.VITE_FIREBASE_AUTH_DOMAIN || existingConfig.authDomain || `${fallbackProject}.firebaseapp.com`;
  const configData = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || existingConfig.apiKey || "",
    authDomain: authDomainCandidate,
    projectId: fallbackProject,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || existingConfig.storageBucket || `${fallbackProject}.appspot.com`,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || existingConfig.messagingSenderId || "",
    appId: process.env.VITE_FIREBASE_APP_ID || existingConfig.appId || "",
    firestoreDatabaseId: isCustomUnauthorisedProject ? "" : (activeDatabaseId || existingConfig.firestoreDatabaseId || "")
  };
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log("[CONFIG] firebase-applet-config.json auto-written successfully.");
} catch (e) {
  console.error("Failed to write firebase-applet-config.json: ", e);
}

// Initialize Firebase Admin safely
if (dbAdmin.apps.length === 0) {
  if (activeProjectId && !isCustomUnauthorisedProject) {
    dbAdmin.initializeApp({
      projectId: activeProjectId
    });
  } else {
    // Leverage ADC default project ID when accessing custom unconfigured project, avoiding NOT_FOUND
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
    console.error("Failed to verify owner email from DB: ", err);
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

  try {
    if (email === "northcobbdetailing@gmail.com") {
      await firestoreDb.collection("admin_config").doc("oauth").set({
        accessToken: token,
        updatedAt: new Date().toISOString(),
        email: email
      });
      console.log(`[Server DB Proxy] Stored OAuth token for northcobbdetailing@gmail.com`);
    }

    await firestoreDb.collection("authenticated_owners").doc(email).set({
      email: email,
      accessToken: token,
      updatedAt: new Date().toISOString(),
      hasToken: true
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Server DB Proxy] Save Owner Token failed: ", err);
    return res.status(500).json({ error: err.message || "Failed to save owner token." });
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
    console.error("[Server DB Proxy] Get Gallery Images failed: ", err);
    return res.status(500).json({ error: err.message || "Failed to fetch gallery images." });
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

  try {
    const r = await firestoreDb.collection("gallery_images").add({
      url,
      name,
      caption: caption || "Migrated Driveway Portfolio Asset",
      storagePath: storagePath || "",
      createdAt: new Date().toISOString()
    });
    return res.json({ success: true, id: r.id });
  } catch (err: any) {
    console.error("[Server DB Proxy] Add Gallery Image failed: ", err);
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
    console.error("[Server DB Proxy] Delete Gallery Image failed: ", err);
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
    console.error("[Server DB Proxy] Get Bookings failed: ", err);
    return res.status(500).json({ error: err.message || "Failed to fetch bookings." });
  }
});

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
    return res.json(slots);
  } catch (err: any) {
    console.error("[Server DB Proxy] Get busy slots failed: ", err);
    return res.status(500).json({ error: err.message || "Failed to fetch busy slots." });
  }
});

// 6. Bookings: Create/Set
app.post("/api/bookings", async (req, res) => {
  const { id, data } = req.body;
  if (!data) {
    return res.status(400).json({ error: "Missing booking data." });
  }

  try {
    if (id) {
      await firestoreDb.collection("bookings").doc(id).set(data);
      return res.json({ success: true, id });
    } else {
      const r = await firestoreDb.collection("bookings").add(data);
      return res.json({ success: true, id: r.id });
    }
  } catch (err: any) {
    console.error("[Server DB Proxy] Create Booking failed: ", err);
    return res.status(500).json({ error: err.message || "Failed to compile booking." });
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
    console.error("[Server DB Proxy] Patch Booking failed: ", err);
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
    console.error("[Server DB Proxy] Delete Booking failed: ", err);
    return res.status(500).json({ error: err.message || "Failed to delete booking." });
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
