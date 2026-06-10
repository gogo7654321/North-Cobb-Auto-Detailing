import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc,
  addDoc
} from "firebase/firestore";
import { 
  db, 
  auth, 
  googleSignIn, 
  getAccessToken, 
  googleSignOut,
  initAuth,
  storage
} from "../lib/firebase";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll
} from "firebase/storage";
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
  UserCheck,
  UploadCloud,
  Link,
  Image,
  Sparkles
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
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'gallery'>('active');
  const [showAuthWarning, setShowAuthWarning] = useState(false);

  // Gallery Management States
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [caption, setCaption] = useState("");
  const [imageInputMethod, setImageInputMethod] = useState<'file' | 'url'>('file');
  const [imageUrl, setImageUrl] = useState("");
  const [galleryError, setGalleryError] = useState("");
  const [gallerySuccess, setGallerySuccess] = useState("");
  const [multiUploadStatus, setMultiUploadStatus] = useState<{
    total: number;
    current: number;
    currentName: string;
    stage: 'converting' | 'uploading' | 'saving' | 'idle';
  } | null>(null);

  // Firebase Storage checking states for the portfolio migration hub
  const [existingStorageFiles, setExistingStorageFiles] = useState<{name: string, url: string}[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);

  const formatStorageName = (fileName: string) => {
    let clean = fileName;
    if (clean.startsWith("migrated_")) {
      clean = clean.replace(/^migrated_/, "");
    }
    // Remove leading epoch timestamp (digits followed by underscore, e.g. 1717589201524_)
    clean = clean.replace(/^\d+_+/, "");
    // Remove file extension
    clean = clean.replace(/\.[^/.]+$/, "");
    // Replace underscores or dashes with spaces
    clean = clean.replace(/[_-]/g, " ");
    // Titlecase
    return clean.replace(/\b\w/g, c => c.toUpperCase());
  };

  // Merge Firestore-registered photos and raw Storage files, deduplicated with strict uniqueness checks
  const mergedDynamicPhotos = React.useMemo(() => {
    const list: any[] = [];
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();

    const addIfUnique = (photo: any) => {
      const url = (photo.url || "").trim();
      const name = (photo.name || "").toLowerCase().trim();
      if (!url || url.startsWith("/")) return; // Skip empty or unresolved local paths

      if (!seenUrls.has(url) && !seenNames.has(name)) {
        seenUrls.add(url);
        seenNames.add(name);
        list.push(photo);
      }
    };

    // Add Firestore-registered ones first
    galleryPhotos.forEach((p) => addIfUnique(p));
    
    // Add raw storage files if not already represented
    existingStorageFiles.forEach((sFile) => {
      if (!sFile.url) return;
      const cleanName = sFile.name;
      const formattedName = formatStorageName(cleanName);
      
      const alreadyRepresented = list.some(p => 
        p.storagePath === `gallery/${cleanName}` || 
        p.url === sFile.url ||
        p.name.toLowerCase().trim() === formattedName.toLowerCase().trim()
      );
      
      if (!alreadyRepresented) {
        addIfUnique({
          id: `storage-${cleanName}`,
          url: sFile.url,
          name: formattedName,
          caption: "Dynamic Storage Asset",
          storagePath: `gallery/${cleanName}`,
          createdAt: new Date().toISOString()
        });
      }
    });

    return list;
  }, [galleryPhotos, existingStorageFiles]);

  const checkStorageFiles = async () => {
    if (!storage) return;
    setLoadingStorage(true);
    try {
      console.log("Scanning Firebase Storage bucket under 'gallery' prefix...");
      const storageRef = ref(storage, "gallery");
      const res = await listAll(storageRef);
      const files = await Promise.all(
        res.items.map(async (item) => {
          try {
            const url = await getDownloadURL(item);
            return { name: item.name, url };
          } catch (e) {
            return { name: item.name, url: "" };
          }
        })
      );
      setExistingStorageFiles(files);
      console.log("Successfully retrieved", files.length, "files from storage container.");
    } catch (err) {
      console.error("Failed to list files in storage bucket: ", err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const fetchGalleryPhotos = async () => {
    try {
      const response = await fetch("/api/gallery-images");
      if (response.ok) {
        const data = await response.json();
        setGalleryPhotos(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard dynamic photos via API: ", err);
    }
  };

  // Load dynamic gallery photos
  useEffect(() => {
    if (!isAdminAuth) return;
    
    fetchGalleryPhotos();
    const interval = setInterval(fetchGalleryPhotos, 10000);

    // Run initial scans for already uploaded items
    checkStorageFiles();

    return () => clearInterval(interval);
  }, [isAdminAuth]);

  const handleAddMultipleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) {
      setGalleryError("Please select a valid image file first.");
      return;
    }
    setUploading(true);
    setGalleryError("");
    setGallerySuccess("");

    const fileArray = Array.from(files);
    let successCount = 0;
    let failedCount = 0;

    // Dynamically load heic2any with generic typing to bypass static linter checks
    let heic2anyLib: any = null;
    try {
      const module = await import("heic2any");
      heic2anyLib = module.default || module;
    } catch (e) {
      console.warn("Failed to load browser HEIC conversion library: ", e);
    }

    for (let i = 0; i < fileArray.length; i++) {
      let file = fileArray[i];
      const displayName = file.name;

      setMultiUploadStatus({
        total: fileArray.length,
        current: i + 1,
        currentName: displayName,
        stage: 'converting'
      });
      setUploadProgress(0);

      // Detect if file is iOS HEIC/HEIF
      const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";

      if (isHeic) {
        try {
          if (heic2anyLib) {
            console.log(`Converting HEIC file: ${displayName}...`);
            const conversionResult = await heic2anyLib({
              blob: file,
              toType: "image/jpeg",
              quality: 0.8
            });

            const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
            file = new File([blob], newName, { type: "image/jpeg" });
          } else {
            throw new Error("Client converter module is not available.");
          }
        } catch (err: any) {
          console.error("HEIC conversion failed:", err);
          setGalleryError(prev => prev ? `${prev}\nFailed to decode HEIC (${displayName}): ${err.message || err}` : `Failed to decode HEIC (${displayName}): ${err.message || err}`);
          failedCount++;
          continue;
        }
      }

      setMultiUploadStatus(prev => prev ? { ...prev, stage: 'uploading' } : null);

      const fileName = `${Date.now()}_${file.name}`;
      const storagePath = `gallery/${fileName}`;
      const fileRef = ref(storage, storagePath);

      try {
        // 1. Try Firebase Storage standard upload
        const uploadTask = uploadBytesResumable(fileRef, file);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(pct);
            }, 
            (error) => {
              console.warn("Storage upload failed, fallback to base64: ", error);
              reject(error);
            }, 
            () => resolve()
          );
        });

        const downloadURL = await getDownloadURL(fileRef);

        setMultiUploadStatus(prev => prev ? { ...prev, stage: 'saving' } : null);

        // Try direct save via client JS SDK first (to north-cobb-detailing)
        let directDBSaveSucceeded = false;
        try {
          const payload = {
            url: downloadURL,
            name: caption.trim() || file.name,
            caption: caption.trim(),
            storagePath: storagePath,
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, "gallery_images"), payload);
          directDBSaveSucceeded = true;
          console.log("[Client SDK] Portfolio photo saved directly to Firestore successfully.");
        } catch (clientDBSaveErr) {
          console.warn("[Client SDK Warning] Failed direct portfolio registration, attempting API proxy:", clientDBSaveErr);
        }

        // Save to collection via Proxy API (as fallback and local container database synchronization)
        try {
          const apiRes = await fetch("/api/gallery-images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
            },
            body: JSON.stringify({
              url: downloadURL,
              name: caption.trim() || file.name,
              caption: caption.trim(),
              storagePath: storagePath
            })
          });

          if (!apiRes.ok && !directDBSaveSucceeded) {
            const apiErr = await apiRes.json();
            throw new Error(apiErr.error || "Proxy save rejected.");
          }
        } catch (apiErr) {
          console.warn("[Server DB Proxy Sync Warning] Proxy save failed to run: ", apiErr);
          if (!directDBSaveSucceeded) {
            throw apiErr;
          }
        }

        successCount++;
      } catch (err: any) {
        console.log("Storage upload skipped or failed, using base64 direct embedding...");
        try {
          const base64Data = await convertToBase64(file);
          
          let directBase64SaveSucceeded = false;
          try {
            const payload = {
              url: base64Data,
              name: caption.trim() || file.name,
              caption: caption.trim(),
              createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, "gallery_images"), payload);
            directBase64SaveSucceeded = true;
            console.log("[Client SDK] base64 photo saved directly to Firestore.");
          } catch (clientBase64Err) {
            console.warn("[Client SDK Warning] Direct base64 save failed, fell back on proxy:", clientBase64Err);
          }

          try {
            const apiRes = await fetch("/api/gallery-images", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
              },
              body: JSON.stringify({
                url: base64Data,
                name: caption.trim() || file.name,
                caption: caption.trim()
              })
            });

            if (!apiRes.ok && !directBase64SaveSucceeded) {
              const apiErr = await apiRes.json();
              throw new Error(apiErr.error || "Proxy base64 save rejected.");
            }
          } catch (apiErr) {
            console.warn("[Server DB Proxy Sync Warning] Proxy base64 failed:", apiErr);
            if (!directBase64SaveSucceeded) {
              throw apiErr;
            }
          }

          successCount++;
        } catch (fallbackErr: any) {
          setGalleryError(prev => prev ? `${prev}\nFallback Upload Error (${displayName}): ${fallbackErr.message}` : `Fallback Upload Error (${displayName}): ${fallbackErr.message}`);
          failedCount++;
        }
      }
    }

    setCaption("");
    setUploading(false);
    setMultiUploadStatus(null);
    setUploadProgress(0);

    if (successCount > 0) {
      if (failedCount > 0) {
        setGallerySuccess(`Successfully processed and uploaded ${successCount} photo(s). ${failedCount} photo(s) failed.`);
      } else {
        setGallerySuccess(`Successfully uploaded all ${successCount} photo(s) to North Cobb portfolio!`);
      }
    } else if (failedCount > 0) {
      setGalleryError(`Batch upload failed. Verify connections and try again.`);
    }
  };

  const handleAddUrlImage = async () => {
    if (!imageUrl) {
      setGalleryError("Please enter a valid Image URL first.");
      return;
    }
    setUploading(true);
    setGalleryError("");
    setGallerySuccess("");
    try {
      const apiRes = await fetch("/api/gallery-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
        },
        body: JSON.stringify({
          url: imageUrl.trim(),
          name: caption.trim() || `Linked Photo - ${new Date().toLocaleDateString()}`,
          caption: caption.trim()
        })
      });

      if (!apiRes.ok) {
        const apiErr = await apiRes.json();
        throw new Error(apiErr.error || "Proxy url save rejected.");
      }

      setGallerySuccess("Successfully linked custom photo!");
      setImageUrl("");
      setCaption("");
    } catch (err: any) {
      setGalleryError(`Firestore Link Failure: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteGalleryImage = async (photo: any) => {
    if (!window.confirm("Are you sure you want to delete this photo from the gallery?")) return;
    try {
      setGalleryError("");
      setGallerySuccess("");

      if (!photo.id.startsWith("storage-")) {
        const apiRes = await fetch(`/api/gallery-images/${photo.id}`, {
          method: "DELETE",
          headers: {
            "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
          }
        });

        if (!apiRes.ok) {
          const apiErr = await apiRes.json();
          throw new Error(apiErr.error || "Proxy deletion rejected.");
        }
      }

      if (photo.storagePath) {
        try {
          const fileRef = ref(storage, photo.storagePath);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn("Storage cleanup skipped or unsuccessful:", storageErr);
        }
      }

      setGallerySuccess("Successfully deleted photo from portfolio.");
      setTimeout(() => {
        fetchGalleryPhotos();
        checkStorageFiles();
      }, 800);
    } catch (err: any) {
      setGalleryError(`Failed to delete: ${err.message}`);
    }
  };

  // --- TEMPORARY BATCH PORTFOLIO MIGRATION UTILITY ---
  const staticMigratables = [
    "/IMG_0659.jpeg",
    "/IMG_0663.jpeg",
    "/impala close up cinematic front.jpeg",
    "/impala exterior front view.jpeg",
    "/impala shined wheels.jpeg",
    "/impala another exterior side.jpeg",
    "/impala back seat.jpeg",
    "/IMG_7813.jpeg",
    "/IMG_7815.jpeg",
    "/IMG_7816.jpeg",
    "/IMG_7817.jpeg",
    "/IMG_7819.jpeg",
    "/IMG_7820.jpeg",
    "/IMG_7821.jpeg",
    "/IMG_7823.jpeg",
    "/IMG_7824.jpeg",
    "/IMG_7825.jpeg",
    "/IMG_7826.jpeg",
    "/IMG_7827.jpeg",
    "/IMG_7829.jpeg",
    "/IMG_7830.jpeg",
    "/IMG_7838.jpeg",
    "/IMG_0648.jpeg",
    "/IMG_0985.jpeg",
    "/IMG_0986.jpeg",
    "/IMG_0990.jpeg",
    "/IMG_0991.jpeg",
    "/IMG_0992.jpeg",
    "/IMG_0994.jpeg",
    "/IMG_0995.jpeg",
    "/IMG_0996.jpeg",
    "/IMG_0997.jpeg",
    "/IMG_1001.jpeg"
  ];

  type MigrationStatus = 'idle' | 'downloading' | 'uploading' | 'completed' | 'failed' | 'already-exists';
  const [migrationTasks, setMigrationTasks] = useState<{[key: string]: {status: MigrationStatus, error?: string, progress?: number}}>({});
  const [isMigratingAll, setIsMigratingAll] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);

  // Function to migrate a single asset with fallback support
  const handleMigrateSingle = async (path: string) => {
    // 1. Format Name and verify if already added to gallery
    const cleanName = path.replace(/^\//, "");
    const formattedName = cleanName
      .replace(/\.[^/.]+$/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    const alreadyExists = galleryPhotos.some(gp => 
      gp.name === formattedName || 
      gp.url?.includes(cleanName) || 
      (gp.storagePath && gp.storagePath.includes(cleanName))
    );

    const alreadyInStorage = existingStorageFiles.some(f => f.name.includes(cleanName));

    if (alreadyExists || alreadyInStorage) {
      setMigrationTasks(prev => ({
        ...prev,
        [path]: { status: 'already-exists', progress: 100 }
      }));
      if (alreadyInStorage && !alreadyExists) {
        setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⏭️ Skipped (already in Storage bucket): ${cleanName}`]);
      }
      return;
    }

    setMigrationTasks(prev => ({
      ...prev,
      [path]: { status: 'downloading', progress: 0 }
    }));

    try {
      // Check if file is already in Firebase Storage but unlinked in database
      const existingFile = existingStorageFiles.find(f => f.name.includes(cleanName));
      if (existingFile && existingFile.url) {
        setMigrationTasks(prev => ({
          ...prev,
          [path]: { status: 'uploading', progress: 60 }
        }));
        setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ☁️ File found in Storage bucket: '${existingFile.name}'. Skipping cloud upload, registering direct DB Link...`]);
        try {
          const apiRes = await fetch("/api/gallery-images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
            },
            body: JSON.stringify({
              url: existingFile.url,
              name: formattedName,
              caption: "Migrated Driveway Portfolio Asset",
              storagePath: `gallery/${existingFile.name}`
            })
          });

          if (!apiRes.ok) {
            const apiErr = await apiRes.json();
            throw new Error(apiErr.error || "Proxy register failed.");
          }

          setMigrationTasks(prev => ({
            ...prev,
            [path]: { status: 'completed', progress: 100 }
          }));
          setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Successfully matched and registered '${cleanName}' with existing Storage file.`]);
          return;
        } catch (dbErr: any) {
          console.warn(`Direct DB configuration failed for existing file:`, dbErr);
          setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ Link step failed (${cleanName}): ${dbErr.message}. Falling back to embedded local storage...`]);
          throw dbErr; // Let it fall through to the catch block & Base64 option
        }
      }

      // 1. Fetch file as Blob directly from public assets folder
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Static file status error: ${response.status}`);
      }

      setMigrationTasks(prev => ({
        ...prev,
        [path]: { status: 'uploading', progress: 20 }
      }));

      const blob = await response.blob();

      // 2. Upload to Firebase Storage
      const storagePath = `gallery/migrated_${Date.now()}_${cleanName}`;
      const fileRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(fileRef, blob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setMigrationTasks(prev => ({
              ...prev,
              [path]: { status: 'uploading', progress: 20 + Math.round(pct * 0.7) }
            }));
          }, 
          (error) => reject(error), 
          () => resolve()
        );
      });

      const downloadURL = await getDownloadURL(fileRef);

      // 3. Add to Firestore collection via Proxy API
      const apiRes = await fetch("/api/gallery-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
        },
        body: JSON.stringify({
          url: downloadURL,
          name: formattedName,
          caption: "Migrated Driveway Portfolio Asset",
          storagePath: storagePath
        })
      });

      if (!apiRes.ok) {
        const apiErr = await apiRes.json();
        throw new Error(apiErr.error || "Proxy add failed.");
      }

      setMigrationTasks(prev => ({
        ...prev,
        [path]: { status: 'completed', progress: 100 }
      }));
      setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Successfully migrated: ${cleanName}`]);
    } catch (err: any) {
      console.warn(`Storage upload rejected for ${path}, activating embedded fallback...`, err);
      // Fallback base64 conversion & Firestore save
      try {
        const response = await fetch(path);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const base64Data = await base64Promise;

          // Add to Firestore collection via Proxy API
          const apiRes = await fetch("/api/gallery-images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
            },
            body: JSON.stringify({
              url: base64Data,
              name: formattedName,
              caption: "Migrated Driveway Portfolio Asset (Embedded Entry)"
            })
          });

          if (!apiRes.ok) {
            const apiErr = await apiRes.json();
            throw new Error(apiErr.error || "Proxy base64 embed failed.");
          }

          setMigrationTasks(prev => ({
            ...prev,
            [path]: { status: 'completed', progress: 100 }
          }));
          setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Successfully migrated (embedded database): ${cleanName}`]);
          return;
        }
      } catch (fallbackErr: any) {
        console.error("Fallback script failed too:", fallbackErr);
      }

      setMigrationTasks(prev => ({
        ...prev,
        [path]: { status: 'failed', error: err.message || "Unknown Error" }
      }));
      setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Failed to migrate ${cleanName}: ${err.message}`]);
    }
  };

  // Run bulk sequential migration
  const handleMigrateAll = async () => {
    if (isMigratingAll) return;
    setIsMigratingAll(true);
    setMigrationLog(prev => [...prev, `\n--- Starting batch migration for ${staticMigratables.length} files... ---`]);

    let successCount = 0;
    let skipCount = 0;

    for (const path of staticMigratables) {
      const cleanName = path.replace(/^\//, "");
      const formattedName = cleanName
        .replace(/\.[^/.]+$/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      // Pre-check skip
      const alreadyExists = galleryPhotos.some(gp => 
        gp.name === formattedName || 
        gp.url?.includes(cleanName) || 
        (gp.storagePath && gp.storagePath.includes(cleanName))
      );

      const alreadyInStorage = existingStorageFiles.some(f => f.name.includes(cleanName));

      if (alreadyExists || alreadyInStorage) {
        setMigrationTasks(prev => ({
          ...prev,
          [path]: { status: 'already-exists', progress: 100 }
        }));
        skipCount++;
        if (alreadyInStorage && !alreadyExists) {
          setMigrationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⏭️ Skipped (already in Storage bucket): ${cleanName}`]);
        }
        continue;
      }

      await handleMigrateSingle(path);
      successCount++;
      // Minimal cooling interval
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    setIsMigratingAll(false);
    setMigrationLog(prev => [...prev, `--- Migration task completed! Moved: ${successCount} items, Already Migrated: ${skipCount} items. ---`]);
  };

  const authorizedEmails = ["npatel012010@gmail.com", "northcobbdetailing@gmail.com"];

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInIframe(window.self !== window.top);
    }
  }, []);

  const saveOwnerToken = async (email: string, token: string) => {
    try {
      const res = await fetch("/api/save-owner-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, token })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed secure token transmission.");
      }
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

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (err) {
      console.error("Failed to fetch bookings via API:", err);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to raw Bookings collection using live real-time query straight from the custom Firestore DB
  useEffect(() => {
    if (!isAdminAuth) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Create live snapshot listener straight from Client SDK
    const q = query(collection(db, "bookings"), orderBy("dateTime", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() as Booking });
      });
      setBookings(list);
      setLoading(false);
    }, (error) => {
      console.warn("Client subscription to bookings failed (uncreated collections or rules block), enabling API backend polls:", error);
      // Fallback: poll API as permanent resilient candidate
      fetchBookings();
      const interval = setInterval(fetchBookings, 8000);
      return () => clearInterval(interval);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
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
    // We default to the requested method (usually "popup") rather than forcing mobile redirects automatically.
    // Popup-based login is highly resilient because standard Google OAuth/Firebase configurations pre-approve 
    // project.firebaseapp.com popup endpoints, which completely eliminates Error 400: redirect_uri_mismatch on custom/dev domains
    // and correctly signals authentication state back to the parent page via window.postMessage.
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
  const sendMimeGmailConfirmation = async (booking: Booking, token: string | null, fallbackCalendar: boolean = false) => {
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

    if (token) {
      try {
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

        if (response.ok) {
          return await response.json();
        }
        
        const errorText = await response.text();
        console.warn(`Direct Google OAuth send failed: ${errorText}. Cascading to server-side backup SMTP...`);
      } catch (directErr) {
        console.warn(`Direct Google OAuth send exception:`, directErr);
      }
    }

    // Server-side fallback via SMTP App Password
    console.log("Triggering server-side fallback email dispatch via /api/send-customer-confirmation...");
    const serverResponse = await fetch("/api/send-customer-confirmation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipientEmail: booking.email,
        subject,
        htmlContent,
        calendarEvent: fallbackCalendar ? {
          bookingId: booking.id,
          name: booking.name,
          email: booking.email,
          phone: booking.phone || "",
          dateTime: booking.dateTime,
          service: booking.service,
          vehicleType: booking.vehicleType || "Sedan / Coupe",
          price: booking.price + getVehicleTypePriceAdjustment(booking.vehicleType)
        } : undefined
      })
    });

    if (!serverResponse.ok) {
      const fallbackErrText = await serverResponse.text();
      throw new Error(`Direct Google OAuth & Server Backup SMTP both failed. SMTP logs: ${fallbackErrText}`);
    }

    return await serverResponse.json();
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
      let calendarDispatchFailed = false;
      if (sendToken) {
        try {
          const calEventResult = await createGoogleCalendarEvent(booking, sendToken);
          if (calEventResult && calEventResult.id) {
            calendarEventId = calEventResult.id;
          }
          addLog(`- Google Calendar: Added event containing all admin calendars.`);
        } catch (calError: any) {
          calendarDispatchFailed = true;
          const isAuthErr = calError.message?.includes("401") || calError.message?.toLowerCase().includes("auth") || calError.message?.toLowerCase().includes("credential");
          if (isAuthErr) {
            setShowAuthWarning(true);
          }
          addLog(`- Google Calendar Alert: Unable to schedule: ${calError.message}. Triggering self-healing SMTP Calendar invite fallback...`);
        }
      } else {
        calendarDispatchFailed = true;
        addLog(`- Google Calendar: Skipped (Offline/Direct mode). Triggering self-healing SMTP Calendar invite fallback...`);
      }

      // 2. Gmail dispatch (prefers Google OAuth, falls back to server-side SMTP)
      try {
        // Strict safety rule: Only send customer-facing emails via client-side Gmail API if the identity matches northcobbdetailing@gmail.com.
        // For other admin identities (like personal profiles), bypass direct OAuth send and route safely through the server SMTP.
        const gmailApiToken = emailSentFrom === "northcobbdetailing@gmail.com" ? sendToken : null;
        await sendMimeGmailConfirmation(booking, gmailApiToken, calendarDispatchFailed);
        addLog(`- Gmail Alerts: Emailed receipt to ${booking.email} successfully.`);
      } catch (mailError: any) {
        addLog(`- Gmail Alert: Failed to email customer: ${mailError.message}`);
      }

      // 3. Update Firestore database state keys via Client SDK & Proxy API
      const updateData: any = { status: "confirmed" };
      if (calendarEventId) {
        updateData.calendarEventId = calendarEventId;
      }
      
      let directUpdateSucceeded = false;
      try {
        const docRef = doc(db, "bookings", booking.id!!);
        await updateDoc(docRef, updateData);
        directUpdateSucceeded = true;
        console.log("[Client SDK] Direct booking confirmation saved to Firestore.");
      } catch (clientUpdErr) {
        console.warn("[Client SDK Warning] Direct confirmation state save failed: ", clientUpdErr);
      }

      try {
        const apiRes = await fetch(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
          },
          body: JSON.stringify(updateData)
        });
        if (!apiRes.ok && !directUpdateSucceeded) {
          const apiErr = await apiRes.json();
          throw new Error(apiErr.error || "Proxy patch status failed.");
        }
      } catch (proxyErr: any) {
        console.warn("[Server DB Proxy Sync Warning] Proxy booking update did not resolve: ", proxyErr);
        if (!directUpdateSucceeded) {
          throw proxyErr;
        }
      }

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
      let directUpdateSucceeded = false;
      try {
        const docRef = doc(db, "bookings", booking.id!!);
        await updateDoc(docRef, { status: "cancelled" });
        directUpdateSucceeded = true;
        console.log("[Client SDK] Direct cancel status saved to Firestore.");
      } catch (clientUpdErr) {
        console.warn("[Client SDK Warning] Direct cancellation save failed: ", clientUpdErr);
      }

      try {
        const apiRes = await fetch(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
          },
          body: JSON.stringify({ status: "cancelled" })
        });
        if (!apiRes.ok && !directUpdateSucceeded) {
          const apiErr = await apiRes.json();
          throw new Error(apiErr.error || "Proxy patch cancel failed.");
        }
      } catch (proxyErr: any) {
        console.warn("[Server DB Proxy Sync Warning] Proxy cancel did not resolve: ", proxyErr);
        if (!directUpdateSucceeded) {
          throw proxyErr;
        }
      }

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
      const updateData = { 
        status: "completed",
        actualRevenue: finalRevenue
      };

      let directUpdateSucceeded = false;
      try {
        const docRef = doc(db, "bookings", booking.id!!);
        await updateDoc(docRef, updateData);
        directUpdateSucceeded = true;
        console.log("[Client SDK] Direct completion recorded to Firestore.");
      } catch (clientUpdErr) {
        console.warn("[Client SDK Warning] Direct completion state save failed: ", clientUpdErr);
      }

      try {
        const apiRes = await fetch(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
          },
          body: JSON.stringify(updateData)
        });
        if (!apiRes.ok && !directUpdateSucceeded) {
          const apiErr = await apiRes.json();
          throw new Error(apiErr.error || "Proxy patch complete failed.");
        }
      } catch (proxyErr: any) {
        console.warn("[Server DB Proxy Sync Warning] Proxy complete update did not resolve: ", proxyErr);
        if (!directUpdateSucceeded) {
          throw proxyErr;
        }
      }

      addLog(`Job for ${booking.name} marked as COMPLETED. Actual revenue recorded: $${finalRevenue}`);
    } catch (err: any) {
      addLog(`Failed to complete booking: ${err.message}`);
    }
  };

  const handleDelete = async (booking: Booking) => {
    if (booking.status === "completed") {
      addLog(`Delete rejected: Booking for ${booking.name} is already COMPLETED and cannot be deleted.`);
      return;
    }
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
      
      let directDeleteSucceeded = false;
      try {
        const docRef = doc(db, "bookings", booking.id!!);
        await deleteDoc(docRef);
        directDeleteSucceeded = true;
        addLog(`Deleted booking document directly: ${booking.id!!}`);
      } catch (clientDelErr) {
        console.warn("[Client SDK Warning] Direct booking deletion failed: ", clientDelErr);
      }

      try {
        const apiRes = await fetch(`/api/bookings/${booking.id}`, {
          method: "DELETE",
          headers: {
            "X-Owner-Email": adminUser?.email || "npatel012010@gmail.com"
          }
        });
        if (!apiRes.ok && !directDeleteSucceeded) {
          const apiErr = await apiRes.json();
          throw new Error(apiErr.error || "Proxy delete booking failed.");
        }
        if (!directDeleteSucceeded) {
          addLog(`Deleted booking document via proxy API: ${booking.id!!}`);
        }
      } catch (err: any) {
        console.warn("[Server DB Proxy Sync Warning] Proxy booking deletion did not resolve: ", err);
        if (!directDeleteSucceeded) {
          addLog(`Delete failed: ${err.message}`);
        }
      }
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

        {/* Render buttons dynamically, recommending popup-based authentication for best-in-class multi-domain compatibility */}
        {(() => {
          const isMobileDevice = typeof window !== "undefined" && typeof navigator !== "undefined" && 
            /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          if (isMobileDevice) {
            return (
              <div className="mt-6 space-y-3 text-left">
                <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-lg text-[11px] text-amber-950 leading-relaxed mb-1">
                  <span className="font-extrabold block mb-1">📱 Mobile Device / Touch Mode:</span>
                  Please use <strong>Google Pop-up Mode</strong>. It will open a temporary secure browser tab to authenticate and return you straight back to this dashboard. This completely avoids Google OAuth <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px] font-mono">redirect_uri_mismatch</code> errors!
                  <span className="block mt-1 font-semibold text-amber-800">⚠️ Note: If prompted, please allow pop-ups for this site.</span>
                </div>
                
                {/* Pop-up is the highly recommended default on mobile */}
                <button
                  id="admin_oauth_signin_popup_btn"
                  onClick={() => handleLogin("popup")}
                  className="w-full py-3 bg-[#b45309] hover:bg-[#9a3412] text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
                  style={{ borderRadius: "8px 2px 8px 2px" }}
                >
                  <Unlock className="w-4 h-4 animate-pulse" />
                  Sign In (Google Pop-up - Recommended)
                </button>

                <button
                  id="admin_oauth_signin_redirect_btn"
                  onClick={() => handleLogin("redirect")}
                  className="w-full py-2 bg-white border border-[#e6dccf] text-[#5c544a] hover:text-[#2e261f] hover:bg-[#faf8f5] font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ borderRadius: "8px 2px 8px 2px" }}
                >
                  <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
                  Fallback Redirect Method (GCP config required)
                </button>
              </div>
            );
          }

          return (
            <div className="mt-6 space-y-3">
              {/* Method 1: Popup Sign In Button */}
              <button
                id="admin_oauth_signin_popup_btn"
                onClick={() => handleLogin("popup")}
                className="w-full py-3 bg-[#b45309] hover:bg-[#9a3412] text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
                style={{ borderRadius: "8px 2px 8px 2px" }}
              >
                <Unlock className="w-4 h-4" />
                Sign In (Google Pop-up - Recommended)
              </button>

              {/* Method 2: Redirect Sign In Button (Fallback) */}
              <button
                id="admin_oauth_signin_redirect_btn"
                onClick={() => handleLogin("redirect")}
                className="w-full py-2.5 bg-white border border-[#e6dccf] text-[#5c544a] hover:text-[#2e261f] hover:bg-[#faf8f5] font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                style={{ borderRadius: "8px 2px 8px 2px" }}
              >
                <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
                Fallback Redirect Mode (GCP config required)
              </button>
            </div>
          );
        })()}
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

      {showAuthWarning && (
        <div className="mb-6 bg-red-50 border border-red-200 text-[#7f1d1d] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in"
          style={{ borderRadius: "8px 2px 8px 2px" }}
        >
          <div className="flex gap-3 text-xs leading-relaxed text-left">
            <span className="text-lg">🔑</span>
            <div>
              <strong className="block font-black font-serif text-sm text-[#7f1d1d]">Google Calendar Auth Expired</strong>
              Your Google login token has expired or is invalid. Real-time Google Calendar sync is offline. Click renew to re-authorize instantly.
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await handleLogin("popup");
                setShowAuthWarning(false);
              } catch (err) {
                console.error(err);
              }
            }}
            className="px-3 py-1.5 bg-[#b45309] hover:bg-[#92400e] text-white text-[10px] font-bold font-mono uppercase tracking-wider rounded transition-all active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-center"
            style={{ borderRadius: "4px 2px 4px 2px" }}
          >
            Renew Google Handshake
          </button>
        </div>
      )}

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
              {activeTab === 'active' ? "Active Schedule Queue" : activeTab === 'completed' ? "Completed Jobs Record" : "Driveway Portfolio Manager"}
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
              <button
                id="gallery_tab_btn"
                onClick={() => setActiveTab('gallery')}
                className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-all rounded-md cursor-pointer ${
                  activeTab === 'gallery'
                    ? "bg-[#b45309] text-white shadow-sm"
                    : "text-[#5c544a] hover:bg-[#efece6] hover:text-[#2e261f]"
                }`}
              >
                Manage Gallery
              </button>
            </div>
          </div>
          
          {activeTab === 'gallery' ? (
            <div className="space-y-6">
              {/* GALLERY MANAGER VIEW */}
              <div className="bg-[#faf8f5] border border-[#e6dccf] p-5 relative"
                style={{ borderRadius: "16px 2px 16px 2px" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-1 px-2.5 bg-[#fff9e6] border border-amber-300 text-amber-900 font-mono text-[9px] font-black rounded uppercase tracking-widest">
                    SYNC MEDIA PORT
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-[#b45309]" />
                </div>
                
                <h6 className="text-[#2e261f] font-serif font-black text-sm mb-1">Add Dynamic Gallery Shot</h6>
                <p className="text-[11px] text-[#5c544a] mb-4">
                  Select a picture to upload directly. Photos instantly sync live and render dynamically alongside static items.
                </p>

                {/* Feedback boxes */}
                {galleryError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded text-xs mb-3 font-mono leading-normal">
                    ⚠️ {galleryError}
                  </div>
                )}
                {gallerySuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs mb-3 font-mono leading-normal">
                    ✓ {gallerySuccess}
                  </div>
                )}

                {/* Upload Form Elements */}
                <div className="space-y-4">
                  {/* Caption */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 font-mono">
                      Photo Title / Caption
                    </label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="e.g. Arthur shine finish on red Charger"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#e6dccf] text-[#2e261f] focus:outline-none focus:border-amber-500 rounded"
                      disabled={uploading}
                    />
                  </div>

                  {/* Input Method Switcher */}
                  <div className="flex gap-2.5 border-b border-[#e6dccf] pb-3">
                    <button
                      type="button"
                      onClick={() => setImageInputMethod('file')}
                      className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        imageInputMethod === 'file' 
                          ? 'bg-[#b45309] text-white' 
                          : 'bg-white hover:bg-[#efece6] border border-[#e6dccf] text-zinc-500'
                      }`}
                    >
                      📁 Local File Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMethod('url')}
                      className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        imageInputMethod === 'url' 
                          ? 'bg-[#b45309] text-white' 
                          : 'bg-white hover:bg-[#efece6] border border-[#e6dccf] text-zinc-500'
                      }`}
                    >
                      🔗 Paste Web URL Link
                    </button>
                  </div>

                  {/* Method Panels */}
                  {imageInputMethod === 'file' ? (
                    <div className="border-2 border-dashed border-[#e6dccf] hover:border-amber-500 bg-white/60 p-6 text-center rounded-xl transition-all relative">
                      {uploading ? (
                        <div className="space-y-3 py-4">
                          <span className="inline-block animate-spin text-xl text-[#b45309]">⌛</span>
                          {multiUploadStatus ? (
                            <div className="space-y-1">
                              <p className="text-xs font-mono text-[#b45309] font-black uppercase tracking-wider">
                                {multiUploadStatus.stage === 'converting' && "🔄 Decoding iPhone HEIC file..."}
                                {multiUploadStatus.stage === 'uploading' && "📤 Syncing file to Cloud Storage..."}
                                {multiUploadStatus.stage === 'saving' && "💾 Saving details to database..."}
                              </p>
                              <p className="text-xs text-[#2e261f] font-bold truncate max-w-xs mx-auto">
                                File {multiUploadStatus.current} of {multiUploadStatus.total}: <span className="font-mono text-zinc-650">{multiUploadStatus.currentName}</span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs font-mono text-zinc-650 font-bold">Processing uploads...</p>
                          )}

                          <div className="w-52 bg-zinc-100 h-2 mx-auto rounded-full overflow-hidden border border-zinc-200 shadow-inner">
                            <div className="bg-amber-600 h-full transition-all duration-150 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                          
                          <p className="text-[10px] text-zinc-500 font-mono">
                            {multiUploadStatus && multiUploadStatus.total > 1 ? (
                              `Overall Batch Progress: ${Math.round(((multiUploadStatus.current - 1) / multiUploadStatus.total) * 100)}%`
                            ) : (
                              `Single File Progress: ${uploadProgress}%`
                            )}
                          </p>
                          <p className="text-[9px] text-[#854d0e] bg-amber-50 border border-amber-200/50 p-1 rounded max-w-xs mx-auto font-mono">
                            Auto backup base64 database sync stands by as redundancy.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <UploadCloud className="w-10 h-10 text-amber-750/70 mx-auto animate-pulse" />
                          <p className="text-xs font-extrabold text-[#2e261f]">Click to browse or drag & drop images</p>
                          <p className="text-[10px] text-[#5c544a] font-mono uppercase tracking-wider">
                            Supports Jpeg, Png, Webp, or iOS HEIC/HEIF files
                          </p>
                          <input
                            type="file"
                            accept="image/*,.heic,.heif,image/heic,image/heif"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handleAddMultipleFiles(files);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 bg-white border border-[#e6dccf] p-4 rounded-xl">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1 font-mono">
                          Image Web Link (HTTP/HTTPS)
                        </label>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="e.g. https://imgur.com/your-detailing-shot.jpeg"
                          className="w-full px-3 py-2 text-xs bg-[#fafafc] border border-[#e6dccf] text-[#2e261f] focus:outline-none focus:border-amber-500 rounded"
                          disabled={uploading}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddUrlImage}
                        disabled={uploading}
                        className="w-full px-4 py-2 bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                        style={{ borderRadius: "6px 2px 6px 2px" }}
                      >
                        {uploading ? "Linking Media..." : "Save Photo Link to Portfolio"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* CURRENT LOADED IMAGES FEED */}
              <div className="space-y-3">
                <h6 className="text-xs font-bold text-[#2e261f] font-mono tracking-widest uppercase border-b border-dashed border-[#e6dccf] pb-2">
                  Active Dynamic Portfolio Items ({mergedDynamicPhotos.length} Photos)
                </h6>

                {mergedDynamicPhotos.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-dashed border-[#e6dccf] text-zinc-500 text-xs italic"
                    style={{ borderRadius: "12px 2px 12px 2px" }}
                  >
                    No custom dynamic images uploaded yet. Added photos will list and manage here live.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mergedDynamicPhotos.map((photo) => {
                      const isBase64 = photo.url.startsWith("data:");
                      return (
                        <div
                          key={photo.id}
                          className="bg-white border border-[#e6dccf] p-2 relative group hover:shadow-md transition-all flex flex-col justify-between"
                          style={{ borderRadius: "10px 2px 10px 2px" }}
                        >
                          <div className="aspect-square w-full bg-zinc-50 overflow-hidden rounded relative border border-zinc-150">
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {isBase64 && (
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-50 text-[8px] font-mono text-amber-800 font-bold border border-amber-200 uppercase rounded tracking-wider leading-none select-none">
                                DB Embedded
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-left">
                            <p className="text-[10px] font-black font-serif line-clamp-1 text-[#2e261f]">
                              {photo.name}
                            </p>
                            <span className="text-[8px] font-mono text-zinc-400 block mt-0.5">
                              {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : "Custom Linked"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteGalleryImage(photo)}
                            className="absolute top-2 right-2 p-1.5 bg-red-50 hover:bg-red-200 text-red-650 rounded hover:text-red-700 transition-all cursor-pointer border border-red-200"
                            title="Delete this dynamic image instantly"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : loading ? (
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
                        {booking.dateTime && (booking.dateTime.endsWith("T12:00:00") || booking.dateTime.endsWith("T12:00")) ? (
                          <span>
                            {new Date(booking.dateTime).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric"
                            })} - <strong className="text-[#b45309] not-italic font-sans text-xs">Custom / Other (Text to Arrange)</strong>
                          </span>
                        ) : (
                          new Date(booking.dateTime).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        )}
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

                    {booking.status !== "completed" && (
                      <button
                        id={`crm_delete_${booking.id}`}
                        onClick={() => handleDelete(booking)}
                        className="p-2 border border-[#e6dccf] text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all duration-150 cursor-pointer"
                        style={{ borderRadius: "6px 2px 6px 2px" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
