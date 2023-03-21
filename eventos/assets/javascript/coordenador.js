import * as firebase from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import { getFirestore, onSnapshot, collection, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6I8Rwo9YiJgd7zK-U5RpHBZDSPsDt0ME",
    authDomain: "br-events.firebaseapp.com",
    projectId: "br-events",
    storageBucket: "br-events.appspot.com",
    messagingSenderId: "603831187236",
    appId: "1:603831187236:web:b1b3e97f5c6a38a4eb25b1"
};

const app = firebase.initializeApp(firebaseConfig);
const db = getFirestore(app);

const trails = document.getElementById("trails");
const q = query(collection(db, "events", "tdcconnections2023", "trilhas"), orderBy("trilhaNome", "asc"));
window.load = function() {
    onSnapshot(q, (querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const trilha = doc.data();
            const li = document.createElement("li");
            li.innerHTML = `${trilha.trilhaNome} | <a href="./gerenciar.html?id=${doc.id}">Gerenciar</a> | <a href="./tela.html?id=${doc.id}">TV</a>`;
            li.setAttribute("data-id", doc.id);
            trails.appendChild(li);
        });
    })
}