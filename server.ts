import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import dbAdmin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin safely
if (dbAdmin.apps.length === 0) {
  dbAdmin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "north-cobb-detailing"
  });
}
const firestoreDb = getFirestore(dbAdmin.app(), "ai-studio-156f4116-40a7-4fe1-9027-3f4cb246d038");

const app = express();
const PORT = 3000;

app.use(express.json());

// Cloud Function equivalent API for real-time automated bookings
app.post("/api/cloud-functions-booking", async (req, res) => {
  const { bookingId } = req.body;
  
  // Strict Zero-Trust validation on document ID format and length to prevent resource poisoning
  if (!bookingId || typeof bookingId !== "string" || bookingId.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(bookingId)) {
    return res.status(400).json({ error: "Invalid bookingId. Must be a safe document ID alphanumeric string." });
  }

  try {
    const bookingDoc = await firestoreDb.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: `Booking document '${bookingId}' was not found.` });
    }

    const booking = bookingDoc.data();
    if (!booking) {
      return res.status(400).json({ error: "Booking data is corrupted." });
    }
    console.log(`[Cloud Function Proxy] Loaded booking for ${booking.name}:`, booking);

    // Fetch the stored owner OAuth token
    const adminDoc = await firestoreDb.collection("admin_config").doc("oauth").get();
    let accessToken: string | null = null;
    let adminEmail = "northcobbdetailing@gmail.com";

    if (adminDoc.exists) {
      const adminData = adminDoc.data();
      accessToken = adminData?.accessToken || null;
      adminEmail = adminData?.email || "northcobbdetailing@gmail.com";
      console.log(`[Cloud Function Proxy] Found cached Owner Token for ${adminEmail}`);
    } else {
      console.log("[Cloud Function Proxy] Warning: No Owner Google OAuth Token Cached. Owner alert email skipped until an owner authorizes.");
    }

    let ownerAlertSuccess = false;

    // Send Admin Notification Email via Gmail API or Nodemailer SMTP to "everybody who has auth in the owner portal"
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    const senderEmail = process.env.SENDER_EMAIL || "northcobbdetailing@gmail.com";

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
                    <a href="https://ais-pre-pdd643ltb6srk7p2d4lfjr-307654656669.us-east5.run.app/#owner-portal" target="_blank" style="display: inline-block; background-color: #b45309; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 14px 28px; border-radius: 8px 2px 8px 2px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px rgba(180, 83, 9, 0.15); transition: background-color 0.15s ease;">
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

        if (gmailAppPassword) {
          console.log(`[Cloud Function Proxy] Dispatching stable notifications via Nodemailer SMTP for ${senderEmail}...`);
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: senderEmail,
              pass: gmailAppPassword
            }
          });

          for (const recipient of finalRecipients) {
            try {
              await transporter.sendMail({
                from: `"North Cobb Detailing Automation" <${senderEmail}>`,
                to: recipient,
                subject: subject,
                html: htmlContent
              });
              sentCount++;
              console.log(`[Cloud Function Proxy] SMTP alert email successfully dispatched to ${recipient}`);
            } catch (smtpErr) {
              console.error(`[Cloud Function Proxy] Nodemailer SMTP dispatch failed for ${recipient}:`, smtpErr);
            }
          }
        } else if (accessToken) {
          console.log(`[Cloud Function Proxy] OAuth Token detected. Attempting Google REST API dispatch...`);
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
