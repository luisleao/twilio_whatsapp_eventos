const fs = require('fs');
require("dotenv").config();


// Initialize Firebase
var admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
  }else {
     admin.app(); // if already initialized, use that one
  }
  const firestore = admin.firestore();

const csv = require('csvtojson');


let eventos = {};
let evento = null;  

const importFile = async (arquivo) => {
    console.log('Importando arquivo: ', arquivo);





    const lista = [...new Set(await csv()
        .fromFile(arquivo)
        .then((lista) => {
            return lista; //lista.map(e => e.Email)
        }))];
    
    console.log(`Encontrei ${lista.length} registros!`);
    console.log(`Adicionando no banco de dados do evento "${evento.key}"...`);
    let totalAdded = 0;

    for (registro of lista) {
        // console.log(registro)

        let participante = {
            csvUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            syncVersion: admin.firestore.FieldValue.increment(1)
        };

        const allowedElements = ['nome', 'email', 'firstName', 'lastName', 'empresa', 'cargo'];
        Object.keys(allowedElements).map((e, idx) => {
            if (registro[allowedElements[e]]) {
                participante[allowedElements[e]] = registro[allowedElements[e]]
            }
        });
    
        await firestore.collection('events').doc(evento.key).collection('emails')
            .doc(participante.email.toLowerCase().trim()).set({
                ...participante
        }, { merge: true }).then( writeResult => {
            console.log('Adicionado ', participante.email);
            totalAdded++;
        });


    }
    console.log( `${totalAdded} registro(s) adicionado(s).`);

}

const init = async () => {
    console.log('Iniciando importação de registro de CSV...');

    // Carregar evento ativo e default
    const eventos = await firestore.collection('events')
        .where('default', '==', true)
        .where('active', '==', true)
        .get()
        .then(snapshot => {
            return snapshot.docs.map(doc => {
                return { key: doc.id, ...doc.data() }
            });
        });

    if (eventos.length == 0) {
        console.log('ERRO: nenhum evento ativo e default encontrado!');
        return
    }
    evento = eventos[0];

    // evento.key
    console.log('Utilizando evento', evento.key);

    // Lista arquivos .CSV da pasta /csv
    fs.readdir('./csv', async (err, files) => {
        let csvs = files.filter(f => f.indexOf('.csv') >= 0)
        if (csvs.length > 0) {
            importFile(`./csv/${csvs[0]}`);
        } else {
            console.log('NENHUM ARQUIVO .CSV ENCONTRADO');
        }
    });

};

init();