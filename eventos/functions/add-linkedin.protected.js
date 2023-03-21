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
    event: evento, from, linkedin, to
*/
exports.handler = async function(context, event, callback) {
    let participanteId = await md5(limpaNumero(event.from));
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    let mensagem = [];

    console.log('ADICIONANDO LINKEDIN', event);

    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).set({
            idPlayerEvent,
            participanteId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phoneNumber: limpaNumero(event.from),
            ativouNetworking: true,
            game: true,
            linkedin: event.linkedin
        }, { merge: true });


    await firestore.collection('participantes')
        .doc(participanteId).set({
            idPlayerEvent,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phoneNumber: limpaNumero(event.from),
            ativouNetworking: true,
            game: true,
            linkedin: event.linkedin,
            ultimoEvento: event.evento
        }, { merge: true });

    // mensagem.push(`Seu perfil do linkedin foi registrado com sucesso!`);
    // mensagem.push(`Você pode mostrar este QRCode para se conectar com participantes do evento.`)
    mensagem.push(`Para imprimir seu QRCode, vá até o estande da Twilio e peça a impressão.`);
    mensagem.push(``);
    mensagem.push(``);
    mensagem.push(`Envie uma selfie no evento para gerar um video dinâmico com a Videomatik.`);
    mensagem.push(`Se passar no estande você pode ganhar brindes.`);
    

    // TODO: gerar QRCode.

    // increment stats
    await firestore.collection('events')
      .doc(event.evento).set({
        stats: {
          pessoas: admin.firestore.FieldValue.increment(1)
        }
      }, { merge: true });



    let media = `https://chart.googleapis.com/chart?chs=500x500&cht=qr&chl=https://wa.me/551150393737?text=${idPlayerEvent}`; 


    callback(null, {
        mensagem: mensagem.join('\n\n'),
        media
    });

};
