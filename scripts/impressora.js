// Impressão das etiquetas com múltiplas impressoras.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
require("dotenv").config();
const Dymo = require('dymojs'),
    dymo = new Dymo();
const convert = require('xml-js');


// Initialize Firebase
var admin = require("firebase-admin");

let printers = {};
let eventos = {};



if (!admin.apps.length) {
  admin.initializeApp();
}else {
   admin.app(); // if already initialized, use that one
}
const firestore = admin.firestore();

const mapPrinters = async () => {
    let printersXml = convert.xml2js(await dymo.getPrinters());
    let printersArray = printersXml.elements[0].elements
        .map(e => {
            return Object.assign({},
                ...e.elements.map(p => {
                return { [p.name]: p.elements[0].text };
            })
        );
    });
    return Object.assign({}, ...printersArray.map(p => { return { [p.Name]: p } } ));
}

const updatePrintersFromFirestore = query => {
    query.forEach(async doc => {
        const printerId = doc.id;
        const printerData = await doc.data();
        // console.log('PRINTER CHANGED', printerData.Name);
        Object.assign(printers[printerId], {...printerData});
        console.log(printerData)
        // carregar dados do evento (label, inclusive)
        if (printerData.evento) {
            const evento = await firestore.collection('events').doc(printerData.evento).get();
            if (evento.exists) {
                eventos[printerData.evento] = evento.data();
                printers[printerId].eventoData = {...evento.data()};
            } else {
                console.log(printerData.evento, 'EVENTO NAO EXISTE NO FIRESTORE')
            }
        } else {
            console.log(printerData.Name, 'SEM EVENTO!');
        }
    });
}


const updateEventosFromFirestore = query => {
    console.log('carregando eventos...');
    query.forEach(async doc => {
        try {
            const eventData = await doc.data();
            console.log(doc.id);
            eventos[doc.id] = { ...eventData };
        } catch (err) {
            console.log(err)
        }
    });
}

const init = async () => {
    console.log('Iniciando sistema de impressão...');

    // Carregar impressoras Dymo
    printers = await mapPrinters();
    const printersNames = Object.keys(printers).map(p => printers[p].Name);

    printersNames.forEach(async (p, idx) => {
        await firestore.collection('printers').doc(p).set({
            ...printers[p],
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });

    console.log('listando impressoras...');
    // Carregar dados da impressora do Firestore
    await firestore.collection('printers')
        .where('Name', 'in', printersNames)
        .get().then(updatePrintersFromFirestore);

    console.log('listando eventos...');
    // Carregar dados de eventos do Firestore
    await firestore.collection('events')
        .where('active', '==', true)
        .get().then(updateEventosFromFirestore);

        


    // Criar listener para carregar dados da impressora do Firestore
    firestore.collection('printers')
        .where('Name', 'in', printersNames)
        .onSnapshot(updatePrintersFromFirestore);

    // Criar listener para carregar dados dos eventos ativos do Firestore
    firestore.collection('events')
        .where('active', '==', true)
        .onSnapshot(updateEventosFromFirestore);


    // Filtrar no firestore etiquetas vinculadas as impressoras 
    firestore.collection('labels')
        .where('printer', 'in', ['IMPRIMIR'])
        .onSnapshot(async query => {
            if (query.size > 0) {
                console.log(query.size, 'REGISTROS ENCONTRADOS!');
                const batch = firestore.batch();
                query.forEach(async doc => {
                    const labelId = doc.id;
                    const labelData = doc.data();
                    const evento = labelData.evento;
                    const eventoData = evento;
                    
                    // const evento = null; // printers[labelData.printer].evento || null
                    // const eventoData = {}; // eventos[evento] || {}
                    // console.log(evento)
                    console.log(eventoData)
                    // console.log(eventoData);
                    if ("Python Brasil") {

                        // TODO: carregar label do evento ou default
                        const label = Object.keys(labelData).reduce((prev, key)=> {
                            console.log(key, labelData[key]);
                            return prev.split(`{{${key}}}`).join(labelData[key]);
                        }, `${"Python Brasil"}`);

                        // Imprimir label
                        dymo.print(printersNames[0], label).then(async p => {
                            console.log('Imprimindo >', labelData);
                            // const { participanteId, nome, pronome, linkedin, impressoes, evento } = doc.data();

                            // if (evento) {
                                // Salvar informacao de impressao no evento
                                if (labelData.participanteId) {
                                    await firestore.collection('events')
                                        .doc("pythonbr")
                                        .collection('participantes')
                                        .doc(labelData.participanteId)
                                        .set({
                                            printed: true,
                                            impressoes: admin.firestore.FieldValue.increment(1),
                                            lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                                        }, { merge: true });
                                } else {
                                    console.log('Com evento, porém sem ID de participante!');
                                }

                            // } else {
                            //     console.log('SEM EVENTO');
                            // }

                        }).catch(e => { console.log("ERRO ", e)});

                        // remover da fila ao imprimir 
                        batch.delete(doc.ref);

                    } else {
                        console.log('EVENTO SEM LABEL DEFINIDO!');
                    }

                });
                await batch.commit();
                console.log('FIM DA FILA');
            }
        });

    console.log('Sistema carregado com sucesso!');
};


init();
