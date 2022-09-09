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
    event: evento, from, optin
*/
exports.handler = async function(context, event, callback) {
    let participanteId = await md5(limpaNumero(event.from));

    let mensagem = [];

    console.log('ADICIONANDO OPTIN', event);

    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phoneNumber: limpaNumero(event.from),
            recebeuOptin: true,
            aceitouOptin: parseInt(event.optin) == 1,
        }, { merge: true });

    switch(parseInt(event.optin) == 1) {
        case true:
            mensagem.push(`Agradecemos por aceitar!`);
            mensagem.push(`A organização do evento receberá seu contato e poderá enviar mensagens pelo WhatsApp.`);
            break;
        case false:
            mensagem.push(`Agradecemos por nos informar!`);
            mensagem.push(`Você receberá mensagens apenas durante o evento e quando realizar alguma ativação.`);
            mensagem.push(`Após o evento, não será enviada nenhuma mensagem da Twilio ou da organização do evento.`);
            break;
    }

    callback(null, {
        mensagem: mensagem.join('\n\n')
    });

};
