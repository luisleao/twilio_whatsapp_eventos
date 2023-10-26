// Impressão das etiquetas com múltiplas impressoras.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require("dotenv").config();

const fs = require('fs');
const Dymo = require('dymojs'),
    dymo = new Dymo();
const convert = require('xml-js');


let labelBarista = require('./label.cafe');

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
    console.log('printersXml', printersXml);
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
        Object.assign(printers[printerId], {...printerData});

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
        const eventData = await doc.data();
        console.log(doc.id);
        eventos[doc.id] = { ...eventData };
    });
}

const init = async () => {
    console.log('Iniciando sistema de impressão...');

    // labelBarista = fs.readFileSync('./label.cafe.dymo', 'utf-8');
    // console.log('labelBarista', labelBarista);

    // Carregar impressoras Dymo
    printers = await mapPrinters();
    const printersNames = Object.keys(printers).map(p => printers[p].Name);

    printersNames.forEach(async (p, idx) => {
        await firestore.collection('printers').doc(p).set({
            ...printers[p],
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });

    // Loading printers data from Firestore
    console.log('Listing printers...');
    await firestore.collection('printers')
        .where('Name', 'in', printersNames)
        .get().then(updatePrintersFromFirestore);

    // Load event data from Firestore
    console.log('Listing events...');
    await firestore.collection('events')
        .where('active', '==', true)
        .get().then(updateEventosFromFirestore);

        
 

    // Create listener to load printers data from Firestore
    firestore.collection('printers')
        .where('Name', 'in', printersNames)
        .onSnapshot(updatePrintersFromFirestore);

    // Create listener to load data from active events from Firestore
    firestore.collection('events')
        .where('active', '==', true)
        .onSnapshot(updateEventosFromFirestore);


    // FIlter labels on Firestore tied to printers
    firestore.collection('labels')
        .where('printer', 'in', printersNames)
        .onSnapshot(async query => {
            if (query.size > 0) {
                console.log(query.size, 'REGISTROS ENCONTRADOS!');
                const batch = firestore.batch();
                query.forEach(async doc => {
                    const labelId = doc.id;
                    const labelData = doc.data();
                    const evento = labelData.evento;
                    const eventoData = eventos[labelData.evento] || {};
                    
                    let labelXml = null;

                    switch(labelData.type) {
                        case 'coffee': labelXml = labelBarista; break;
                        default:       labelXml = eventoData.label;
                    }

                    console.log(labelData, evento, eventoData);
                    if (labelXml) {

                        // Load data into label
                        const label = Object.keys(labelData).reduce((prev, key)=> {
                            console.log(key, labelData[key]);
                            return prev.split(`{{${key}}}`).join(labelData[key]);
                        }, `${labelXml}`);


                        // Print label
                        dymo.print(labelData.printer, label).then(async p => {
                            console.log(labelData.printer, ' Printing >', labelData, '\n\n\n', p, '* * * * * \n\n\n');

                            if (evento) {
                                
                                switch(labelData.type) {
                                    case 'coffee':
                                        // Don't do nothing. It will just remove the element

                                        // await firestore.collection('events')
                                        //     .doc(evento)
                                        //     .collection('barista')
                                        //     .doc(labelId)
                                        //     .set({
                                        //         printed: true,
                                        //         impressoes: admin.firestore.FieldValue.increment(1),
                                        //         lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                                        //     }, { merge: true });

                                        break;
                                    default:

                                        // Salvar informacao de impressao no evento
                                        if (labelData.idPlayerEvent) {
                                            await firestore.collection('events')
                                                .doc(evento)
                                                .collection('participantes')
                                                .doc(labelData.idPlayerEvent)
                                                .set({
                                                    printed: true,
                                                    impressoes: admin.firestore.FieldValue.increment(1),
                                                    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                                                }, { merge: true });
                                        } else {
                                            console.log('Com evento, porém sem ID de participante!');
                                        }
                                }

                            } else {
                                console.log('ERROR: NO EVENT DEFINED!');
                            }

                        }).catch(e => { console.log("ERROR: ", e)});

                        // remover da fila ao imprimir 
                        batch.delete(doc.ref);

                    } else {
                        console.log('ERROR: EVENT WITHOUT DEFINED LABEL!');
                    }

                });
                await batch.commit();
                console.log('END OF THE LINE');
            }
        });

    console.log('System initialized!');
};


init();