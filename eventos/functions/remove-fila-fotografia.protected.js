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
    event: evento, token, from
*/
exports.handler = async function(context, event, callback) {
    let participanteId = await md5(limpaNumero(event.from));

    let agendamentoTotal = null;
    let agendamentoPosicao = null;

    await firestore.collection('events')
        .doc(event.evento).collection('agendamento')
        .doc(participanteId).delete();

    let mensagem = `Remoção da fila foi realizada com sucesso.`

    let data = {
        mensagem
    };


    // TODO: verificar pontuação de networking
    // /events/{eventId}/participantes/{participanteId}/ [PontosAcumulados, PontosCorrente]
    // como resoler pontuação igual?

    // TODO: montar mensagem padrão para participante com resumo das informações



    // console.log('VERIFICA PALAVRA: ', event);

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

    console.log('DATA', data);
    

    callback(null, data);

};
