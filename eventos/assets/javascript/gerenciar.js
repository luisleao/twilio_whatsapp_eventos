import * as firebase from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import { getFirestore, onSnapshot, collection, query, where, orderBy, doc as docFunc, setDoc, FieldValue } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";

const CURRENT_EVENT = 'tdcbusiness2023';

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
const q = query(
    collection(db, "events", CURRENT_EVENT, "palestras"), 
    where("trilhaId", "==", trilhaId), 
    orderBy("horario", "asc")
);

window.trigger = function() {
    onSnapshot(q, (querySnapshot) => {
        trails.innerHTML = "";
        if (querySnapshot.docs.length > 0) {
            // TODO: adicionar nome da trilha no topo
            document.getElementById("trail-name").innerText = querySnapshot.docs[0].data().trilhaNome;
        }
        querySnapshot.forEach((doc) => {
            const palestra = doc.data();
            const li = document.createElement("li");
            // Add button to update database
            li.innerHTML = `
                <button id="abrir-palestra-${doc.id}" data-id="${doc.id}">Abrir</button>
                <button id="fechar-doc-${doc.id}" data-id="${doc.id}">Fechar</button>
                ${palestra.feedbacks ? '[' + palestra.feedbacks + ' &gt; ' + (palestra.totalPoints / palestra.feedbacks).toFixed(2) + ']' : ''} ${palestra.horario}: ${palestra.titulo}
                (${doc.id})
            `;
            li.setAttribute("data-id", doc.id);
            trails.appendChild(li);
                
            const abrirPalestra = document.getElementById(`abrir-palestra-${doc.id}`);
            abrirPalestra.addEventListener("click", (e) => {
                const palestraRef = docFunc(db, "events", CURRENT_EVENT, "palestras", doc.id);
                setDoc(palestraRef, {
                    status: "Aberto",
                    // updatedAt: FieldValue.serverTimestamp()
                }, {
                    merge: true
                });
            });
            const fecharPalestra = document.getElementById(`fechar-doc-${doc.id}`);
            fecharPalestra.addEventListener("click", (e) => {
                const palestraRef = docFunc(db, "events", CURRENT_EVENT, "palestras", doc.id);
                setDoc(palestraRef, {
                    status: "Fechado",
                    // updatedAt: FieldValue.serverTimestamp()
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