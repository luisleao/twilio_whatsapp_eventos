

require("dotenv").config();

// Initialize Firebase
var admin = require("firebase-admin");


if (!admin.apps.length) {
    admin.initializeApp();
}else {
    admin.app(); // if already initialized, use that one
}
const firestore = admin.firestore();



var printer = require("printer");
const fs = require('fs');
const tmp_dir = require('os').tmpdir();

const PDFDocument = require('pdfkit');


const getSelphyPrinter = async () => {
    const printers = (await printer.getPrinters()).filter(p => {
        return p.options['printer-make-and-model'].toUpperCase().indexOf('SELPHY') >= 0
        && p.isDefault;
    });
    // console.log('PRINTERS', printers);
    if (printers.length > 0) {
        return printers[0];
    } else {
        return null;
    }
}

const downloadPicture = async (imageUrl) => {
    const axios = require('axios');
    console.log('downloading...', imageUrl);
    // Faz a requisição HTTP usando o Axios
    return await axios.get(imageUrl, 
        // { responseType: 'stream' }
        { responseType: 'arraybuffer' }
        // ).then(r => Buffer.from(r.data, 'binary').toString('base64'));
    ).then(r => {
        console.log('DOWNLOADED!');
        return Buffer.from(r.data, 'binary')
    });
}


const print = async (pictureUrl, evento) => {
    if (!fs.existsSync(`impressoes/${evento}/`)) {
        console.log(`Criando pasta 'impressoes/${evento}/'`);
        fs.mkdirSync(`impressoes/${evento}/`);
    }
    
    let ASSET_BACKGROUND = fs.existsSync(`assets/${evento}/fundo.png`) ? `assets/${evento}/fundo.png` : `assets/fundo.png`;
    let ASSET_FOREGROUD = fs.existsSync(`assets/${evento}/frente.png`) ? `assets/${evento}/frente.png` : `assets/frente.png`;

    const fileName = pictureUrl.split('/').reverse()[0]
    const pictureBin = await downloadPicture(pictureUrl);

    const selphy = await getSelphyPrinter();
    if (!selphy) return false;

    const width = 100/10;
    const height = 148/10;

    const doc = new PDFDocument({
        size: [width * 28.3465, height * 28.3465],
        // size: 'A6', 
        // size: [1748, 2480], 
        // size: [100, 148], 
        layout: 'portrait', //'landscape', 
        margins: {
          top: 0, bottom: 0, left: 0, right: 0
        }
    });

    const file = `impressoes/${evento}/${fileName}.pdf`;
    const stream = doc.pipe(fs.createWriteStream(file));


    doc.info['Title'] = pictureUrl;
    const offsetX = 40; //44;
    const offsetY = 65; //70;

    doc
        .moveTo(0, 0)
        .image(ASSET_BACKGROUND, 0, 0, {width: doc.page.width, height: doc.page.height});

    doc
        .moveTo(0, 0)
        // .image('foto.jpeg', 0, 0, {width: doc.page.width, height: doc.page.height});
        .image(pictureBin, offsetX, 0, { 
            // width: doc.page.width - (offsetX * 2), 
            // height: doc.page.height - (offsetY + offsetY),
            fit: [doc.page.width - (offsetX * 2), doc.page.height], 
            align: 'center', 
            valign: 'center'
        });

    doc
        .moveTo(0, 0)
        .image(ASSET_FOREGROUD, 0, 0, {width: doc.page.width, height: doc.page.height});

    doc.end();
    
    stream.on('finish', function() {
        console.log('COMPLETED');
        
        // Print PDF File
        printer.printFile({
            filename: file,
            docname: fileName,
            printer: selphy.name,

            success:function(jobID){
                console.log(`sent to printer with ID: ${jobID}`);
            },
            error:function(err){
                console.log(err);
            }
        });

    });

    return true;

}

(async () => {
    console.log('Inicializado.');
    // console.log(await printer.getPrinters());
    // return;

    let selphyPrinter = await getSelphyPrinter();
    console.log('PRINTER:', selphyPrinter);
    if (!selphyPrinter) {
        console.log('No Canon SELPHY printer found!');
        return;
    }

    firestore.collectionGroup('photoprint')
        .where('status', '==', 'pending')
        .onSnapshot(async s => {
            let batch = firestore.batch();

            let tempLabels = [];
            s.forEach(async doc => {
                tempLabels.push({ ...doc.data(), ref: doc.ref}); //{id: doc.id, ...doc.data()});
            });
            for (picture of tempLabels) {
                console.log('PRINTING', picture.url);
                if (await print(picture.url, picture.evento)) {
                    batch.set(picture.ref, {
                        printed: admin.firestore.FieldValue.increment(1),
                        status: 'printed',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    console.log('PRINTED');
                } else {
                    batch.set(picture.ref, {
                        printed: admin.firestore.FieldValue.increment(1),
                        status: 'error',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true })
                    console.log('ERROR');
                }
            }
            await batch.commit();

    });

    // let imagem = '';
    // await print(imagem);

})()
