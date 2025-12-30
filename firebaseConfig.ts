
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAfv3SjVOWJCbS-RB_cuHKSrQ0uv4kJ__s",
  authDomain: "rizqdaan.firebaseapp.com",
  projectId: "rizqdaan",
  storageBucket: "rizqdaan.firebasestorage.app",
  messagingSenderId: "6770003964",
  appId: "1:6770003964:web:3e47e1d4e4ba724c446c79"
};

let app;
let auth: any = null;
let db: any = null;
const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;

try {
    if (isFirebaseConfigured()) {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }

        auth = getAuth(app);
        
        try {
            db = initializeFirestore(app, {
                experimentalForceLongPolling: true,
                useFetchStreams: false
            });
        } catch (e: any) {
            db = getFirestore(app);
        }
    }
} catch (error: any) {
    console.error("Firebase init error: ", error);
}

export { auth, db, googleProvider };
