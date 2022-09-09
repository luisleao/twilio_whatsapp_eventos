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
    event: evento, to, token, points
*/
exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    let participanteId = event.token;

    const points = event.points * -1;

    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).set({
            pontosCorrente: admin.firestore.FieldValue.increment(points),
            pontosAcumulados: admin.firestore.FieldValue.increment(points > 0 ? points : 0),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()

        }, { merge: true});


    let participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return {
                pontosAcumulados: 0,
                pontosCorrente: 0,
            };
        }
    });

    // Enviar mensagem informando que adicionou ou removeu pontos
    let mensagemPt = [];
        mensagemPt.push(`${Math.abs(points)} ${Math.abs(points) > 1 ? 'pontos foram' : 'ponto foi'} ${points > 0 ? 'adicionado' : 'descontado'}${Math.abs(points) > 1 ? 's' : ''}!`);
        mensagemPt.push([
            `Saldo de pontos é *${participante.pontosCorrente} ${participante.pontosCorrente > 1 ? 'pontos' : 'ponto'}*.`,
            `Total de pontos acumulados: ${participante.pontosAcumulados}.`
        ].join('\n'));

    let mensagemEn = [];
        mensagemEn.push(`${Math.abs(points)} ${Math.abs(points) > 1 ? 'points' : 'points'} ${points > 0 ? 'added' : 'withdrawn'}!`);
        mensagemEn.push([
            `Balance: *${participante.pontosCorrente} ${participante.pontosCorrente > 1 ? 'points' : 'point'}*.`,
            `Accumulated: ${participante.pontosAcumulados}.`
        ].join('\n'));

    if (participante.phoneNumber) {
        await sendNotification(
            client,
            event.to,
            `whatsapp:${participante.phoneNumber}`,
            mensagemPt.join('\n\n')
        );
    }

    let data = {
        mensagem: mensagemEn.join('\n\n'),
        podeDescontarPontos: participante.pontosCorrente > 0,
        pontosCorrente: participante.pontosCorrente,
        pontosAcumulados: participante.pontosAcumulados,
        participante
    };

    callback(null, data);

};
