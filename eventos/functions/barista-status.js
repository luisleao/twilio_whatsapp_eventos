const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();

/*
    event: filaId, evento, idPlayerEvent, status
*/
exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();


    // Verificar se possui pontuação mínima para pedido
    const participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(event.idPlayerEvent).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return {
                pontosAcumulados: 0,
                pontosCorrente: 0,
                coffeeUnlimited: false,
                cafes: 0
            };
        }
    });

    // const participantGeral = await firestore.collection('participantes')
    //     .doc(event.participanteId).get().then(s => {
    //         if (s.exists) {
    //             return s.data();
    //         } else {
    //             return null;
    //         }
    //     });

    if (!participante) {
        return callback(null, {
            erro: true,
            mensagem: 'Participante não encontrado!\n\nInforme para responsável da Twilio.'
        });
    } 

    switch (event.status) {
        case 'chamar':
            await sendNotification(
                client,
                `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
                `whatsapp:${participante.phoneNumber}`,
                `Seu café já pode ser preparado!\n\nVenha até o estande da Twilio | WhatsApp e procure pelo nosso barista.`
            );

            await firestore.collection('events').doc(event.evento)
                .collection('barista').doc(event.filaId).set({
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    chamados: admin.firestore.FieldValue.increment(1)
                }, { merge: true });

            break;

        case 'cancelado':

            // Verificar se participante não é ilimitado e retornar pontos e total de cafés
            let evento = await firestore.collection('events')
                .doc(event.evento).get().then(async s => {
                if (s.exists) {
                    return s.data();
                } else {
                    return null;
                }
            });

            // resetando contador de café e voltando pontos
            await firestore.collection('events')
                .doc(event.evento).collection('participantes')
                .doc(event.idPlayerEvent).set({
                    cafes: admin.firestore.FieldValue.increment(-1),
                    pontosCorrente: admin.firestore.FieldValue.increment(participante.coffeeUnlimited ? 0 : evento.barista.points),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
    
            await sendNotification(
                client,
                `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
                `whatsapp:${participante.phoneNumber}`,
                `Seu pedido de café foi cancelado, mas você pode realizar um novo pedido quando desejar e seus pontos foram recuperados.`
            );

            await firestore.collection('events').doc(event.evento)
                .collection('barista').doc(event.filaId).set({
                    status: 'cancelado',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            break;

        case 'preparo':
            await firestore.collection('events').doc(event.evento)
                .collection('barista').doc(event.filaId).set({
                    status: 'preparo',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            break;

        case 'pronto':
            await firestore.collection('events').doc(event.evento)
                .collection('barista').doc(event.filaId).set({
                    status: 'pronto',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

            await sendNotification(
                client,
                `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
                `whatsapp:${participante.phoneNumber}`,
                `Seu pedido de café está pronto e foi oferecido pela Twilio e WhatsApp!\n\nQuer saber como implementamos isso?\nAcesse https://github.com/luisleao/twilio_whatsapp_eventos e favorite o repositório.`
            );

            // Atualizar stats de café
            await firestore.collection('events').doc(event.evento)
                .set({
                    stats: {
                        cafe: admin.firestore.FieldValue.increment(1)
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
        
            break;
    }

    callback(null, 'OK');
};
