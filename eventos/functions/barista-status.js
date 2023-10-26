const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams, replaceVariablesTemplateMessage } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();

/*
    event: filaId, evento, status, idPlayerEvent
*/
exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();


    const evento = await firestore.collection('events').doc(event.evento).get().then(s => {
        if (s.exists) {
            return s.data();
        } else {
            return {}
        }
    });


    const barista = await firestore.collection('events').doc(event.evento)
        .collection('barista').doc(event.filaId).get().then(async s => {
            if (s.exists) {
                return s.data();
            } else {
                return null;
            }
        });

    
    if (barista) {

        // Verificar se possui pontuação mínima para pedido
        const participante = await firestore.collection('events')
            .doc(event.evento).collection('participantes')
            .doc(barista.idPlayerEvent).get().then(async s => {
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

        if (!participante) {
            return callback(null, {
                erro: true,
                mensagem: evento.barista.messages.attendeeNotFound
            });
        }

        const numero = limpaNumero(participante.phoneNumber);
        const codigo = numero.substr(numero.length - 4 )

        switch (event.status) {
            case 'chamar':

                // (client, from, to, message, messagingServiceSid)
                await sendNotification(
                    client, null,
                    `whatsapp:${participante.phoneNumber}`,
                    replaceVariablesTemplateMessage(evento.barista.messages.call,
                        {
                            'code': codigo
                    },
                    evento.barista.messageServiceSID
                    )
    
                );

                await firestore.collection('events').doc(event.evento)
                    .collection('barista').doc(event.filaId).set({
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        chamados: admin.firestore.FieldValue.increment(1)
                    }, { merge: true });

                break;

            case 'cancelado':

                // Verificar se participante não é ilimitado e retornar pontos e total de cafés
                // resetando contador de café e voltando pontos
                await firestore.collection('events')
                    .doc(event.evento).collection('participantes')
                    .doc(barista.idPlayerEvent).set({
                        cafes: admin.firestore.FieldValue.increment(-1),
                        pontosCorrente: admin.firestore.FieldValue.increment(participante.coffeeUnlimited ? 0 : evento.barista.points),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                await sendNotification(
                    client,
                    null,
                    `whatsapp:${participante.phoneNumber}`,
                    evento.barista.messages.cancelled,
                    evento.barista.messageServiceSID
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

                await firestore.collection('events').doc(event.evento)
                    .collection('participantes').doc(barista.idPlayerEvent).set({
                        ultimoResgateBarista: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });


            
                let mensagem = [];

                mensagem.push(replaceVariablesTemplateMessage(evento.barista.messages.ready,
                    {
                        'code': codigo,
                        'nextOrderInterval': evento.barista.tempoMinimoResgate
                }));

                await sendNotification(
                    client,
                    null,
                    `whatsapp:${participante.phoneNumber}`,
                    mensagem.join('\n\n'),
                    evento.barista.messageServiceSID
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

    }


    callback(null, 'OK');
};
