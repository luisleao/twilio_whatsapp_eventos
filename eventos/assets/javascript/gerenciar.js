import * as firebase from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import { getFirestore, onSnapshot, collection, query, where, orderBy, doc as docFunc, setDoc } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";

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

const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

const trilhaId = params.id;

const trails = document.getElementById("trail-talks");
const q = query(collection(db, "events", "tdcconnections2023", "palestras"), where("trilhaId", "==", trilhaId), orderBy("titulo", "asc"));


window.trigger = function() {
    onSnapshot(q, (querySnapshot) => {
        trails.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const palestra = doc.data();
            const li = document.createElement("li");
            // Add button to update database
            li.innerHTML = `${palestra.titulo} | <button id="abrir-palestra-${doc.id}" data-id="${doc.id}">Abrir</button> | <button id="fechar-doc-${doc.id}" data-id="${doc.id}">Fechar</button>`;
            li.setAttribute("data-id", doc.id);
            trails.appendChild(li);
                
            const abrirPalestra = document.getElementById(`abrir-palestra-${doc.id}`);
            abrirPalestra.addEventListener("click", (e) => {
                const palestraRef = docFunc(db, "events", "tdcconnections2023", "palestras", doc.id);
                setDoc(palestraRef, {
                    status: "Aberto"
                }, {
                    merge: true
                });
            });
            const fecharPalestra = document.getElementById(`fechar-doc-${doc.id}`);
            fecharPalestra.addEventListener("click", (e) => {
                const palestraRef = docFunc(db, "events", "tdcconnections2023", "palestras", doc.id);
                setDoc(palestraRef, {
                    status: "Fechado"
                }, {
                    merge: true
                });
            });
            if (palestra.status === "Aberto") {
                abrirPalestra.disabled = true;
                fecharPalestra.disabled = false;
            }
            if (palestra.status === "Fechado") {
                abrirPalestra.disabled = false;
                fecharPalestra.disabled = true;
            }
        });
    });    
}