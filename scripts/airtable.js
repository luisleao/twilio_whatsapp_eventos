require("dotenv").config();



// Initialize Firebase
var admin = require("firebase-admin");


if (!admin.apps.length) {
    admin.initializeApp();
} else {
    admin.app(); // if already initialized, use that one
}
const firestore = admin.firestore();
  
  

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, EVENT_ID } = process.env;

var Airtable = require('airtable');
var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

const listPalestras = async () => {
    await base('Palestras').select({
        pageSize: 5,
        view: "Grid view"
    }).eachPage(async function page(records, fetchNextPage) {
        // This function (`page`) will get called for each page of records.
    
        await records.forEach(async (record) => {
            // Adicionar no banco
            const { id, fields } = record;
            // /events/[process.env.EVENT_ID]/palestras/[fields.Codigo from Airtable]
            await firestore.collection('events').doc(EVENT_ID)
                .collection('palestras').doc(fields.Codigo).set({
                    titulo: fields.Titulo,
                    horario: fields.Horario,
                    trilhaId: fields.Codigo.split('-')[0], //fields.TrilhaId,
                    trilhaNome: fields.Trilha,
                    status: 'Fechado',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true })

            await firestore.collection('events').doc(EVENT_ID)
                .collection('trilhas').doc(fields.Codigo.split('-')[0]).set({
                    trilhaId: fields.Codigo.split('-')[0],
                    trilhaNome: fields.Trilha,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: false })

            console.log('RECORD', record.id, record.fields);


            // Remover registro da lista
            await base('Palestras').destroy(record.id);

            return true;
        });
    
        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();
    
    }, function done(err) {
        if (err) { console.error(err); return; }
    });

}

listPalestras();
