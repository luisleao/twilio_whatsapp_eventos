// Impressão das etiquetas com múltiplas impressoras.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require("dotenv").config();

let labelListenerUnsubscribe = null;
const IP_UPDATE_INTERVAL = 15000;



const PRINTER_NAME = process.env.PRINTER_NAME ?? 'COUPOM';
let PRINTER_IP = null; //'tcp://192.168.15.71';
let printer = null;
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine, CutOptions } = require('node-thermal-printer');



// Initialize Firebase
var admin = require("firebase-admin");
if (!admin.apps.length) {
  admin.initializeApp();
}else {
   admin.app(); // if already initialized, use that one
}
const firestore = admin.firestore();


var os = require('os');


const printThermal = async (data) => {
    if (!PRINTER_IP) {
        console.log(`Error: no printer IP Address defined`);
        return false;
    }
    // try {
        console.log('Printing...', data);
        const printerConnected = await printer.isPrinterConnected();
        if (!printerConnected) {
            console.log('ERROR - COUPOM PRINTER NOT CONNECTED!!!');
            return false;
        } else {

            printer.alignCenter();
            await printer.printImage('./assets/twilio-logo.png');
            // .then(() => {

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

            if (data.settings) {
                data.settings = data.settings.split('・ ').join('\n');
                //・ Abacaxi/Pineapple・ Limão/Lime・ Maracujá/Passion fruitAçúcar/Sugar
            }

            printer.setTypeFontB();
            printer.setTextQuadArea();                                  // Set text to quad area
            printer.newLine();
            printer.println(` ${data.pedido} `);
            printer.setTextNormal();
            printer.println(` ${data.settings ?? ''} `);
            printer.println(`*** ${data.telefone} ***`);
            printer.newLine();

            printer.cut();

            // }).then(()=> {
                // return printer.execute(err => {
                //     if (err) {
                //         console.error('ERROR PRINTER EXECUTION', err);
                //         return false;
                //     }
                // });
    
            // });
        }

    // } catch (error) {
    //     console.error('ERROR PRINTING', error);
    //     return false;
    // }
}

let i = 0;
const getLabelsForPrinter = async () => {

    return firestore.collection('labels')
        .where('printer', '==', PRINTER_NAME)
        .onSnapshot(async query => {
            if (query.size > 0) {
                console.log(query.size, 'records found!');
                let batch = firestore.batch();

                let tempLabels = [];
                query.forEach(async doc => {
                    tempLabels.push(doc);
                });

                if (printer && query.size > 0) {
                    printer.clear();
                }

                for (doc of tempLabels) {
                    i++;
                    const labelData = doc.data();

                    await printThermal(labelData);
                    await batch.delete(doc.ref);
                }
                if (printer && query.size > 0) {
                    printer.execute(err => {
                        if (err) {
                            console.error('ERROR PRINTER EXECUTION', err);
                            // return false;
                        }
                    });

                }
                await batch.commit();
                // console.log('END OF THE LINE');
            }
        });
}


const updateIPAddress = async () => {

    var networkInterfaces = os.networkInterfaces();
    let ips = Object.keys(networkInterfaces).map (interface => {
        return networkInterfaces[interface].filter(i => {
            return i.family == 'IPv4' && i.address != '127.0.0.1';
        });
    }).reduce((prevValue, currentValue, currentIdx, vector) => {
        return prevValue.concat(currentValue)
    }, []);
    
    firestore.collection('printers').doc(PRINTER_NAME).set( { 
        ips,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })

    
}

(async () => {
    console.log('Initializing printing system...');

    // Filter labels on Firestore tied to printers
    // labelListenerUnsubscribe = getLabelsForPrinter();

      
    // Get printer IP
    firestore.collection('printers').doc(PRINTER_NAME).onSnapshot(async s =>  {
        const printerData = s.data();

        if (printerData.ipAddress) {
            if (PRINTER_IP != printerData.ipAddress) {
                if (labelListenerUnsubscribe) {
                    labelListenerUnsubscribe();
                }
    
                PRINTER_IP = printerData.ipAddress;

                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,
                    interface: PRINTER_IP,
                    characterSet: CharacterSet.PC860_PORTUGUESE
                });
                printer.clear();

                try {
                    await printThermal({
                        id: 'https://wa.me/551150393737?text=BARISTA',
                        codigo: '****',
                        telefone: PRINTER_IP,
                        pedido: `Connected to printer!`
                    });
                        
                    printer.execute(err => {
                        if (err) {
                            console.error('ERROR PRINTER EXECUTION', err);
                            // return false;
                        }
                    });

                } catch (error) {
                    console.error('ERROR', error)                
                }

                labelListenerUnsubscribe = await getLabelsForPrinter();
            }

        }
        
    });

    setInterval(updateIPAddress, IP_UPDATE_INTERVAL);
    console.log('System initialized!');
})();


