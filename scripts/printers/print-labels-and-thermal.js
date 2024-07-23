// Impressão das etiquetas com múltiplas impressoras.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PRINTER_IP = 'tcp://192.168.15.71';

require("dotenv").config();

const fs = require('fs');
const Dymo = require('dymojs'),
    dymo = new Dymo();
const convert = require('xml-js');


let labelBarista = require('./labels/label.cafe'); 

// Initialize Firebase
var admin = require("firebase-admin");

let printers = {};
let eventos = {};
var printer = require("printer");



const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine, CutOptions } = require('node-thermal-printer');



if (!admin.apps.length) {
  admin.initializeApp();
}else {
   admin.app(); // if already initialized, use that one
}
const firestore = admin.firestore();

const mapPrinters = async () => {
    const dymoPrinters = (await printer.getPrinters()).filter(p => {
        return p.options['printer-make-and-model'].toUpperCase().indexOf('DYMO') >= 0
        && p.isDefault;
    });

    console.log('FOUND DYMO PRINTERS', dymoPrinters);


    try {
        let printersXml = convert.xml2js(await dymo.getPrinters());
        console.log('printersXml', printersXml);
        console.log('printersXml.elements[0].elements', printersXml.elements[0].elements);
        let printersArray = printersXml.elements[0].elements
            .map(e => {
                return Object.assign({},
                    ...e.elements.map(p => {
                    return { [p.name]: p.elements[0].text };
                })
            );
        });
        return Object.assign({}, ...printersArray.map(p => { return { [p.Name]: p } } ));
        
    } catch (error) {
        return [];        
    }
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


const printThermal = async (data) => {

    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: PRINTER_IP // internet share mac
        // interface: 'tcp://192.168.86.57' // internet share mac
        // interface: 'tcp://192.168.2.19' // internet share mac
        // interface: 'tcp://192.168.15.71'
        // interface: 'tcp://192.168.1.6',
    });

    if (!printer.isPrinterConnected) {

        console.log('ERROR - COUPOM PRINTER NOT CONNECTED!!!');
        return false;

    } else {
        try {
            printer.alignCenter();
            printer.printImage('./assets/twilio-logo.png').then(() => {
                printer.newLine();
                printer.printQR(data.id, { // https://wa.me/551150393737?text=Teste
                    cellSize: 8,             // 1 - 8
                    correction: 'M',         // L(7%), M(15%), Q(25%), H(30%)
                    model: 2                 // 1 - Model 1
                                            // 2 - Model 2 (standard)
                                            // 3 - Micro QR
                });
                printer.newLine();
                printer.newLine();
                printer.setTextQuadArea();                                  // Set text to quad area
                printer.setTypeFontB();
                printer.println('CODIGO');
                printer.setTypeFontA();
                printer.invert(true); 
                printer.setTextSize(3, 3);
                printer.println(` ${data.codigo} `);
                printer.invert(false);                                       // Background/text color inversion
                // printer.setTextSize();

                printer.setTypeFontB();
                printer.setTextQuadArea();                                  // Set text to quad area
                printer.newLine();
                printer.setText
                printer.println(` ${data.pedido} `);
                printer.setTextNormal()
                printer.println(` ${data.telefone} `);
                printer.newLine();




                // printer.newLine();
                // printer.setTextNormal();
                // printer.alignLeft();
                // printer.println(`Confira nossos produtos em`);
                // printer.bold();
                // printer.setTypeFontB();
                // printer.setTextSize(1, 1);
                // printer.println(`https://twil.io/fecbr`);

                

                printer.cut();
                printer.execute(err => {
                    if (err) throw err;
                });
            })


            return true;

        } catch (error) {
            console.error('ERROR PRINTING', error);
            return false;
        }
    }
}

(async () => {
    console.log('Iniciando sistema de impressão...');

    // labelBarista = fs.readFileSync('./labels/label.cafe.dymo', 'utf-8');
    // console.log('labelBarista', labelBarista);

    // Carregar impressoras Dymo
    printers = await mapPrinters();
    let printersNames = Object.keys(printers).map(p => printers[p].Name);
    printersNames.push('COUPOM');
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
                let batch = firestore.batch();

                let tempLabels = [];
                query.forEach(async doc => {
                    tempLabels.push(doc); //{id: doc.id, ...doc.data()});
                });
                for (doc of tempLabels) {

                    const labelId = doc.id;
                    const labelData = doc.data();
                    const evento = labelData.evento;
                    const eventoData = eventos[labelData.evento] || {};

                    console.log(labelData, evento); //, eventoData);

                    if (labelData.printer == 'COUPOM') {
                        let printResult = await printThermal(labelData);
                        console.log('COUPOM PRINT RESULT', printResult);
                        if (printResult) {
                            // remover da fila ao imprimir 
                            console.log('REMOVING ', doc.ref);
                            await batch.delete(doc.ref);
                        }
                
                    } else {
                        
                        let labelXml = null;
                        switch(labelData.type) {
                            case 'coffee': labelXml = labelBarista; break;
                            default:       labelXml = eventoData.label;
                        }

                        if (labelXml) {

                            // Load data into label
                            const label = Object.keys(labelData).reduce((prev, key)=> {
                                console.log(key, labelData[key]);
                                return prev.split(`{{${key}}}`).join(labelData[key]);
                            }, `${labelXml}`);


                            // Print label
                            await dymo.print(labelData.printer, label).then(async p => {
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
                            await batch.delete(doc.ref);

                        } else {
                            console.log('ERROR: EVENT WITHOUT DEFINED LABEL!');
                        }
                    } 
                    
                }
                console.log('tempLabels', tempLabels);

                await batch.commit();
                console.log('END OF THE LINE');
            }
        });

    console.log('System initialized!');
})();


(async () => {
    await printThermal({
        id: 'https://wa.me/551150393737?text=BARISTA',
        codigo: '****',
        telefone: 'FUNCIONA',
        pedido: 'Impressora Funcional!'
    })
})();
