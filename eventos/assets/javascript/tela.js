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

const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});


window.display = function() {
    const q = query(
        collection(db, "events", "tdcconnections2023", "palestras"), 
        where("trilhaId", "==", params.id), 
        where("status", "==", "Aberto"), 
        orderBy("updatedAt", "desc"),
        limit(1));
    
    onSnapshot(q, (querySnapshot) => {
        console.log("total de palestras: ", querySnapshot.size);
        const mainContainer = document.getElementById("container");
        const emptyContainer = document.getElementById("empty");
        const main = document.getElementById("main-container");
        const brandContainer = document.getElementById("brand-container");

        if (querySnapshot.size === 0) {
            mainContainer.classList.add("hidden");
            emptyContainer.classList.remove("hidden");
            main.classList.remove("hidden");
            brandContainer.classList.add("hidden");
            return;
        }
    
        const palestra = querySnapshot.docs[0].data();
        const idPalestra = querySnapshot.docs[0].id;
    
        const dynamicCode = document.getElementById("dynamic-code");
        dynamicCode.innerHTML = `${idPalestra}`
    
        const talkTitle = document.getElementById("talk-title");
        talkTitle.innerHTML = palestra.titulo;

        const trilha = document.getElementById("trilha");
        trilha.innerHTML = `${palestra.trilhaNome}`;
    
        const url = `https://chart.googleapis.com/chart?chs=500x500&cht=qr&chl=https://wa.me/551150393737?text=${idPalestra}`
        const currentQrCode = document.getElementById("current-qrcode");
        if (currentQrCode) {
            currentQrCode.remove();
        }
        const codeContainer = document.getElementById("image-content-qr");
        codeContainer.insertAdjacentHTML("afterbegin", `<img width="100%" id="current-qrcode" src="${url}" alt="whatsapp-logo-with-twilio" />`)
        emptyContainer.classList.add("hidden");
        main.classList.remove("hidden");
        mainContainer.classList.remove("hidden");
        brandContainer.classList.remove("hidden");
    });
}