const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');

const {AIRTABLE_API_KEY, AIRTABLE_BASE_ID} = process.env;


/*
    event: evento, token, from
*/
exports.handler = async function(context, event, callback) {
    const palestraId = event.token.toUpperCase();
    const participanteId = await md5(limpaNumero(event.from));
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    console.log('VERIFICA PALESTRA: ', event, participanteId, idPlayerEvent);

    var Airtable = require('airtable');
    var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // TODO: carregar palestra do banco de dados
    const palestra = await firestore.collection('events').doc(event.evento)
        .collection('palestras').doc(palestraId).get();
    if (!palestra.exists) {
        return callback(null, { id: palestraId, palestra: null, err: {
            message: 'Esta palestra não foi encontrada em nossos registros!'
        }});
    }

    const palestraData = palestra.data();

    const voto = await firestore.collection('events').doc(event.evento)
        .collection('participantes').doc(idPlayerEvent)
        .collection('feedbacks').doc(palestraId.toUpperCase()).get();


    // Verificar voto também pelo banco de dados
    return callback(null, { id: palestraId, palestra: palestraData, votou: voto.exists, err: null});


    // // Verificar se palestra está no Airtable
    // await base('Palestras').select({
    //     filterByFormula:`{ID}="${palestraId}"`,
    //     fields: [
    //         'ID',
    //         'Horario',
    //         'Titulo',
    //         'Status',
    //         'Palestrante_Linkedin',
    //         'Palestrante_Nome'
    //     ]
    //     }).firstPage(async (err, records) => {
    //         if (err) { 
    //             console.error(err);
    //             return callback(null, { id: null, fields: null, votou: false, err });
    //         }
        
    //         if (records.length == 0) {
    //             return callback(null, { id: null, fields: null, votou: false, err: {
    //                 message: 'Nenhum registro encontrado'
    //             }});
    //         }

    //         const { id, fields } = records[0];
    //         await base('Avaliacoes').select({filterByFormula:`{ID}="${idPlayerEvent}_${palestraId}"`}).firstPage(async (err, avaliacaoRecords) => {
    //             if (err) {
    //                 return callback(null, { id: null, fields: null, votou: false, err: null});
    //             }

    //             return callback(null, { id, fields, votou: avaliacaoRecords.length > 0, err: null});
    //         });

    // });




    // let palestra = await firestore.collection('events').doc(event.evento).collection('palestras').doc(palestraId).get();
    // if (!activation.exists) {
    //   console.log(`Palestra ${palestraId} NÃO EXISTE!`);
    //   return callback(null, {
    //     type: 'not-found'
    //   });
    // }
    // const palestraData = palestra.data();

    // if (!palestraData.open) {
    //   return callback(null, {
    //     type: 'closed'
    //   });
    // }








    // TODO: verificar no airtable se existe esta palestra
    // TODO: verificar se palestra está aberta
    // TODO: verificar se participante já deu feedback
    // TODO: retornar sobre 


    // callback(null, {});


    // const client = await context.getTwilioClient();
    // if (!event.token) {
    //     console.log('TOKEN VAZIO');
    //     return callback(null, {
    //         type: 'not-found'
    //     });
    // }

    // let activation = await firestore.collection('events').doc(event.evento).collection('palavras').doc(event.token).get();
    // if (!activation.exists) {
    //     activation = await firestore.collection('events').doc(event.evento).collection('palavras').doc(event.token.toLowerCase()).get();
    //     if (!activation.exists) {
    //         // token não encontrado
    //         console.log(event.token, 'Palavra não existe no evento', event.evento);
    //         return callback(null, {
    //             type: 'not-found'
    //         });
    //     }
    // }

    // let activationData = activation.data();
    // if (activationData.mensagem) {
    //   activationData.mensagem = convertNewLine(activationData.mensagem);
    // }
    // let callbackData = {
    //     ...activationData
    //     // type: activationData.type || 'activation',
    // }

    // switch(activationData.type) {
    //     case 'impressao_manual':
    //         break;

    //     case 'reimpressao':
    //         break;

    //     case 'impressao':
    //         // Carregar dados de participante
    //         let participante = await firestore.collection('events').doc(event.evento).collection('participantes')
    //             .doc(participanteId)
    //             .get()
    //             .then( p => p.exists ? p.data() : null );
    
    //         if (!participante) {
    //             // Verificar se tem dado do participante geral e copiar
    //             const participanteGeral = await firestore.collection('participantes')
    //                 .doc(participanteId)
    //                 .get()
    //                 .then( p => p.exists ? p.data() : null );

    //             if (!participanteGeral) {
    //                 // Erro: participante não encontrato no evento!
    //                 return callback(null, {
    //                     type: activationData.type,
    //                     mensagem: 'Erro!\n\nParticipante não encontrado neste evento.'
    //                 });
    //             }
    //             participante = participanteGeral;
    //         }

    //         await firestore.collection('labels').add({
    //             evento: event.evento,
    //             printer: activationData.printer,
    //             participanteId,
    //             ...participante
    //         });

    //         await firestore.collection('printers').doc(activationData.printer).set({
    //             impressoes: admin.firestore.FieldValue.increment(1),
    //             updatedAt: admin.firestore.FieldValue.serverTimestamp()
    //         }, { merge: true });

    //         if (activationData.mediaUrl) {
    //             activationData.mediaUrl = fillParams(activationData.mediaUrl, {
    //                 participanteId,
    //                 ...participante
    //             });
    //         }
    //         break;

    //     case 'quiz':
    //         break;

    //     case 'certificado':
    //         break;

    //     default: // 'conteudo'
    //         break;
    // }
    // callback(null, {
    //     ...activationData
    // });

};
