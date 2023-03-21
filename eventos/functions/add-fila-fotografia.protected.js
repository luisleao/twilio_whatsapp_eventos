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
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    let agendamentoTotal = null;
    let agendamentoPosicao = null;

    const participante = await firestore.collection('participantes')
    .doc(participanteId).get().then(s => {
        if (s.exists) {
            return s.data();
        } else {
            return null;
        }
    });



    let ultimo = await firestore.collection('events')
        .doc(event.evento).collection('agendamento')
        .orderBy('posicao', 'desc').limit(1).get().then(s => {
            if (s.size == 0) {
                return 0;
            }
            return s.docs[0].data().posicao;
        });
    
    let posicao = ultimo + 1;

    let agendamento = await firestore.collection('events')
        .doc(event.evento).collection('agendamento')
        .doc(idPlayerEvent).set({
            idPlayerEvent,
            participanteId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            posicao: posicao,
            status: 'fila',
            telefone: escondeNumero(limpaNumero(event.from)),
            nome: participante.nome || '-'
        }).then(async s => {
            return firestore.collection('events')
                .doc(event.evento).collection('agendamento')
                .doc(participanteId).get().then(r => r.data());
    });

    console.log('NOVO AGENDAMENTO', agendamento);

    agendamentoTotal = await firestore.collection('events')
        .doc(event.evento).collection('agendamento')
        .where('status', '==', 'fila')
        .get().then(s => {
            return s.size;
    });
            
    agendamentoPosicao = await firestore.collection('events')
        .doc(event.evento).collection('agendamento')
        .where('status', '==', 'fila')
        .where('posicao', '<', agendamento.posicao)
        .get().then(s => {
            return s.size + 1;
    });

    let mensagem = `Seu registro para foto profissional foi realizado com sucesso!\n\nVocê é a ${agendamentoPosicao}ª pessoa na fila num total de ${agendamentoTotal} ${agendamentoTotal > 1 ? 'pessoas' : 'pessoa'}.`

    let data = {
        mensagem,
        agendamento,
        agendamentoPosicao,
        agendamentoTotal
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
