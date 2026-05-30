import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
// Your custom Firebase configuration as requested
const firebaseConfig = {
  apiKey: "AIzaSyDOyFrxMQg35aQ2_kCIPBb8nfK73e3Wg7Y",
  authDomain: "north-cobb-detailing.firebaseapp.com",
  projectId: "north-cobb-detailing",
  storageBucket: "north-cobb-detailing.firebasestorage.app",
  messagingSenderId: "358514521886",
  appId: "1:358514521886:web:446c71cef8924433a77b0f"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app, "ai-studio-156f4116-40a7-4fe1-9027-3f4cb246d038");

// Initialize Firebase Auth
export const auth = getAuth(app);

// Configure Google Auth Provider with Google Calendar and Gmail scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/gmail.send");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");

// In-memory caching flag and token store, backed by localStorage for session persistence
let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("ncd_owner_access_token") : null;

/**
 * Initialize Google auth listener and process redirect logins
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const authorizedEmails = ["npatel012010@gmail.com", "northcobbdetailing@gmail.com"];

  // Helper to trigger callback and fallback-fetch token if missing
  const handleSuccess = async (user: User, tokenOrNull: string | null) => {
    let finalToken = tokenOrNull;

    if (!finalToken) {
      try {
        const snap = await getDoc(doc(db, "admin_config", "oauth"));
        if (snap.exists()) {
          finalToken = snap.data().accessToken || null;
          if (finalToken) {
            cachedAccessToken = finalToken;
            if (typeof window !== "undefined") {
              localStorage.setItem("ncd_owner_access_token", finalToken);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch stored OAuth token on auth initialization: ", err);
      }
    }

    if (onAuthSuccess) {
      onAuthSuccess(user, finalToken || "");
    }
  };

  // Check for any redirect results (extremely helpful on mobile and storage-partitioned setups)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          if (typeof window !== "undefined") {
            localStorage.setItem("ncd_owner_access_token", cachedAccessToken);
          }
          if (authorizedEmails.includes(result.user.email || "")) {
            handleSuccess(result.user, cachedAccessToken);
          }
        }
      }
    })
    .catch((error) => {
      console.error("Redirect retrieval failed: ", error);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!authorizedEmails.includes(user.email || "")) {
        cachedAccessToken = null;
        if (typeof window !== "undefined") {
          localStorage.removeItem("ncd_owner_access_token");
        }
        if (onAuthFailure) onAuthFailure();
        return;
      }

      handleSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("ncd_owner_access_token");
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Executes Google login using popup (default) or redirect
 */
export const googleSignIn = async (method: "popup" | "redirect" = "popup"): Promise<{ user: User; accessToken: string } | null> => {
  isSigningIn = true;
  try {
    if (method === "redirect") {
      await signInWithRedirect(auth, googleProvider);
      return null; // Top frame redirected, code execution halts here
    }

    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not acquire Google Workspace Access Token from credential.");
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("ncd_owner_access_token", cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Sign in Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Fetch the active Workspace access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Log out
 */
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("ncd_owner_access_token");
  }
};
