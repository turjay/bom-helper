import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

console.log('Connecting to Firebase Project:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testConnection() {
  try {
    const colRef = collection(db, 'fsg_bom_entries');
    
    // 1. Add a test entry
    console.log('Writing test document...');
    const testEntry = {
      system: 'BR',
      assembly: 'Brake Discs',
      subAssembly: 'none',
      part: 'Agent Test Brake Rotor',
      make_buy: 'make',
      quantity: '2',
      comments: 'Firebase connection verification test',
      custom_id: 'TEST-ROTOR-01',
      delete: '0',
      createdBy_name: 'Antigravity Verification Agent',
      createdBy_email: 'agent@antigravity-ide.com',
      createdAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(colRef, testEntry);
    console.log('Successfully wrote document. Generated Firestore ID:', docRef.id);

    // 2. Read back entries
    console.log('Fetching documents from collection "fsg_bom_entries"...');
    const querySnapshot = await getDocs(colRef);
    console.log(`Found ${querySnapshot.size} total entries in Firestore:`);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`- ID: ${doc.id} | Part: "${data.part}" | Created By: ${data.createdBy_name} (${data.createdBy_email})`);
    });

    // 3. Clean up the test document
    console.log('Cleaning up test document...');
    await deleteDoc(doc(db, 'fsg_bom_entries', docRef.id));
    console.log('Clean up complete.');
    console.log('Firestore integration verified successfully with zero errors.');
    
  } catch (error) {
    console.error('Firestore connection test failed:', error);
  }
}

testConnection();
