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

/*
    event: evento, token
*/
exports.handler = async function(context, event, callback) {
    let participanteId = event.token;


    let participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return {
                pontosAcumulados: 0,
                pontosCorrente: 0,
                recebeuOptin: false,
                ativouNetworking: false,
                impressoes: 0
            };
        }
    });

    let participanteGeral = await firestore.collection('participantes')
        .doc(participante.participanteId).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return {}
        }
    });



    let data = {
        podeDescontarPontos: participante.pontosCorrente > 0,
        pontosCorrente: participante.pontosCorrente,
        pontosAcumulados: participante.pontosAcumulados,
        participante,
        participanteGeral
    };

    callback(null, data);

};
