import * as firebase from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import {
    getFirestore,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    limit,
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6I8Rwo9YiJgd7zK-U5RpHBZDSPsDt0ME",
    authDomain: "br-events.firebaseapp.com",
    projectId: "br-events",
    storageBucket: "br-events.appspot.com",
    messagingSenderId: "603831187236",
    appId: "1:603831187236:web:b1b3e97f5c6a38a4eb25b1",
};

const app = firebase.initializeApp(firebaseConfig);
const db = getFirestore(app);

const todo = document.getElementById("to-do");
const q = query(
    collection(db, "events", "tdcconnections2023", "barista"),
    where("status", "in", ["pendente", "preparo"])
);

function toDateTime(secs) {
    var t = new Date(1970, 0, 1); // Epoch
    t.setSeconds(secs);
    return t;
}

const sendPost = (payload) => {
    try {
        fetch("https://eventos-2246-dev.twil.io/barista-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                },
                body: JSON.stringify(payload)
        })
    } catch (err) {

    }
}

const cityCheckbox = document.getElementById("city");

const check = () => {
    if (cityCheckbox.checked) {
        todo.querySelectorAll("li").forEach((li) => {
            if (li.getAttribute("data-city") !== "Recife") {
                li.style.display = "none";
            }
            if (li.getAttribute("data-city") === "Recife") {
                li.style.display = "block";
            }
        });
    } else {
        todo.querySelectorAll("li").forEach((li) => {
            if (li.getAttribute("data-city") !== "Belo Horizonte") {
                li.style.display = "none";
            }
            if (li.getAttribute("data-city") === "Belo Horizonte") {
                li.style.display = "block";
            }
        });
    }
}

cityCheckbox.addEventListener("change", (e) => {
    check();
});

window.load = function () {
    onSnapshot(q, (querySnapshot) => {
        todo.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const cafe = doc.data();
            const li = document.createElement("li");

            li.innerHTML = `${cafe.cafe}, criado em: ${toDateTime(
                cafe.createdAt.seconds
            ).toLocaleDateString()}. | <button id="chamar-${doc.id}" data-id="${doc.id
                }">Chamar</button> | <button id="preparar-${doc.id}" data-id="${doc.id
                }">Preparar</button> | <button id="cancelar-${doc.id}" data-id="${doc.id
                }">Cancelar</button>`;
            li.setAttribute("data-id", doc.id);
            li.setAttribute("data-city", cafe.cidade);

            todo.appendChild(li);
            const chamarButton = document.getElementById(`chamar-${doc.id}`);
            chamarButton.addEventListener("click", () => {
                console.log("chamar");
                sendPost({
                    filaId: doc.id,
                    status: "chamar",
                    evento: cafe.evento,
                    idPlayerEvent: cafe.idPlayerEvent,
                })
            });
            const prepararButton = document.getElementById(`preparar-${doc.id}`);
            prepararButton.addEventListener("click", () => {
                console.log("preparar");
                sendPost({
                    filaId: doc.id,
                    status: "preparo",
                    evento: cafe.evento,
                    idPlayerEvent: cafe.idPlayerEvent,
                })
            });
            const cancelarButton = document.getElementById(`cancelar-${doc.id}`);
            cancelarButton.addEventListener("click", () => {
                console.log("cancelar");
                sendPost({
                    filaId: doc.id,
                    status: "cancelado",
                    evento: cafe.evento,
                    idPlayerEvent: cafe.idPlayerEvent,
                })
            });
            check();
        });
    });
};
