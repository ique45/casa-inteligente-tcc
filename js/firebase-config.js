const firebaseConfig = {
  apiKey: "AIzaSyAWeIeAN3nNArERYUkiVFlx7D0PGD3o1OA",
  authDomain: "casa-inteligente-tcc.firebaseapp.com",
  databaseURL: "https://casa-inteligente-tcc-default-rtdb.firebaseio.com",
  projectId: "casa-inteligente-tcc",
  storageBucket: "casa-inteligente-tcc.firebasestorage.app",
  messagingSenderId: "704312663599",
  appId: "1:704312663599:web:35cabea62f1088e73bf0da"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
