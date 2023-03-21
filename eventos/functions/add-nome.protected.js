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
    event: evento, from, nome, to
*/
exports.handler = async function(context, event, callback) {
    let participanteId = await md5(limpaNumero(event.from));
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    let mensagem = [];

    console.log('ADICIONANDO NOME', event);

    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).set({
            participanteId,
            idPlayerEvent,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phoneNumber: limpaNumero(event.from),
            nome: event.nome
        }, { merge: true });

    await firestore.collection('participantes')
        .doc(participanteId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phoneNumber: limpaNumero(event.from),
            nome: event.nome,
            ultimoEvento: event.evento
        }, { merge: true });

    mensagem.push(`Seu nome foi registrado com sucesso!`);


    callback(null, {
        mensagem: mensagem.join('\n\n'),
    });

};
