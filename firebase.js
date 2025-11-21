const firebaseConfig = {
  apiKey: "AIzaSyB6ktob9HtprzBMx4xF-4yIKvWpLPTtkPo",
  authDomain: "gameword-2416d.firebaseapp.com",
  databaseURL: "https://gameword-2416d-default-rtdb.firebaseio.com",
  projectId: "gameword-2416d",
  storageBucket: "gameword-2416d.firebasestorage.app",
  messagingSenderId: "1020724306382",
  appId: "1:1020724306382:web:c2305f7092c677bd088b9f",
  measurementId: "G-M9D5Z8FK82"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();
