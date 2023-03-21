// Adicionar feedback palestra

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
    event: evento, palestraId, from, voto, 
*/
exports.handler = async function(context, event, callback) {
    const palestraId = event.palestraId;
    let participanteId = await md5(limpaNumero(event.from));
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    const voto = parseInt(event.voto);

    console.log('ADD PALESTRA FEEDBACK: ', event, participanteId, idPlayerEvent);


    // carregar pontuação padrão do evento
    const eventoData = await firestore.collection('events').doc(event.evento).get().then(s => {
        if (s.exists) {
            return s.data();
        } else {
            return {}
        }
    });

    await firestore.collection('events').doc(event.evento)
        .collection('participantes').doc(idPlayerEvent)
        .collection('feedbacks').doc(palestraId.toUpperCase()).set({
            idPlayerEvent,
            participanteId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            voto: voto
        });

    await firestore.collection('events').doc(event.evento)
        .collection('palestras').doc(palestraId).set({
            feedbacks: admin.firestore.FieldValue.increment(1),
            totalPoints: admin.firestore.FieldValue.increment(voto),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    await firestore.collection('events').doc(event.evento)
        .collection('palestras').doc(palestraId)
        .collection('feedbacks').doc(idPlayerEvent).set({
            idPlayerEvent,
            participanteId,
            palestraId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            voto: voto
        });


    // var Airtable = require('airtable');
    // var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // // Adicionar registro de feedback
    // base('Avaliacoes').create([
    //     {
    //         "fields": {
    //             "Usuario": idPlayerEvent,
    //             "Voto": voto,
    //             "Talks": [
    //                 palestraId
    //             ]
    //         }
    //     },
    // ], async function(err, records) {
    //     if (err) {
    //         console.error(err);
    //         callback(null, { err });
    //         return;
    //     }
    // });


    let feedbackPoints = 0;
    if (eventoData.feedbackPoints) {
        feedbackPoints = eventoData.feedbackPoints;

        // Adicionar ponto por avaliação
        // Registrar pontuação no evento
        await firestore.collection('score')
            .doc(event.evento)
            .collection('participantes')
            .doc(idPlayerEvent)
            .set({
                pontosCorrente: admin.firestore.FieldValue.increment(feedbackPoints),
                pontosAcumulados: admin.firestore.FieldValue.increment(feedbackPoints),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });



        // Registrar pontuação no SCORE do PARTICIPANTE
        await firestore.collection('events')
            .doc(event.evento)
            .collection('participantes')
            .doc(idPlayerEvent)
            .set({
                pontosCorrente: admin.firestore.FieldValue.increment(feedbackPoints),
                pontosAcumulados: admin.firestore.FieldValue.increment(feedbackPoints),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

    }

    // Incrementar votacoes em stats
    await firestore.collection('events')
        .doc(event.evento).set({
            stats: {
                feedbacks: admin.firestore.FieldValue.increment(1),
                pontos: admin.firestore.FieldValue.increment(feedbackPoints)
            }
        }, { merge: true });

    if (feedbackPoints > 0) {
        callback(null, {
            message: `✅ Agradecemos por enviar seu feedback! ✅\n\nVocê acumulou mais *${feedbackPoints} ponto${ feedbackPoints > 1 ? 's': ''}*!`
        });

    } else {
        callback(null, {
            message: ''
        });
    }

};
