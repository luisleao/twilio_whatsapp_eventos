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
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    let mensagem = [];

    console.log('ADICIONANDO OPTIN', event);

    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).set({
            participanteId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phoneNumber: limpaNumero(event.from),
            recebeuOptin: true,
            aceitouOptin: parseInt(event.optin) == 1,
            cidade: event.cidade
        }, { merge: true });

    await firestore.collection('events')
        .doc(event.evento).set({
            stats: {
                cidades: {
                    [event.cidade]: admin.firestore.FieldValue.increment(1)
                }
            }
        }, { merge: true });


    switch(parseInt(event.optin) == 1) {
        case true:
            mensagem.push(`Agradecemos por aceitar!`);
            mensagem.push(`A organização do evento receberá seu contato e poderá enviar mensagens pelo WhatsApp.`);
            // mensagem.push(`Thank you for accepting!`);
            // mensagem.push(`The event organization will receive your contact and will be able to send messages via WhatsApp.`);
            break;
        case false:
            mensagem.push(`Agradecemos por nos informar!`);
            mensagem.push(`Você receberá mensagens apenas durante o evento e quando realizar alguma ativação.`);
            mensagem.push(`Após o evento, não será enviada nenhuma mensagem da Twilio ou da organização do evento.`);
            // mensagem.push(`Thanks for letting us know!`);
            // mensagem.push(`You will only receive messages during the event and when you perform an activation.`);
            // mensagem.push(`After the event, no messages will be sent from Twilio or the event organization.`);
            break;
    }

    callback(null, {
        mensagem: mensagem.join('\n\n')
    });

};
