// Adicionar pedido de café

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

const { LIMITE_RESGATES_BARISTA } = process.env;


/*
    event: evento, palestraId, from, choice, 
*/
exports.handler = async function(context, event, callback) {
    const palestraId = event.palestraId;
    const participanteId = await md5(limpaNumero(event.from));
    const idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);
    const tipoCafe = event.tipoCafe;


    console.log('Add Barista');

    
    // TODO: Verificar se já não tem pedido em andamento para este participante
    let baristaQueue = await firestore.collection('events')
        .doc(event.evento).collection('barista')
        .where('idPlayerEvent', '==', idPlayerEvent)
        .where('status','in', [
          'pendente',
          'preparo',
        ]).get().then( async s => {
          return s.size;
        });

    console.log('baristaQueue', baristaQueue);
    if (baristaQueue > 0) {

      callback(null, {
        mensagem: 'Você possui um pedido de café pendente ou em preparo.\n\nSerá possível solicitar novamente quando não tiver nenhum pedido em fila.'
      })
      return;
    }


    let evento = await firestore.collection('events')
        .doc(event.evento).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return null;
        }
    });

    // Verificar se possui pontuação mínima para pedido
    let participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).get().then(async s => {
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

    // Verificar se participante está em Recife ou BH
    if (!['Recife', 'Belo Horizonte'].includes(participante.cidade)) {
        callback(null, {
            mensagem: 'O café está disponível apenas para a modalidade presencial!'
        });
        return;
    }

    // Verificar se participante tem pedido liberado
    if (!participante.coffeeUnlimited) {
        console.log('PARTICIPANTE COM LIMITE DE CAFES');

        // Verificar se participante atingiu o limite
        if (!participante.cafes) {
            participante.cafes = 0;
        }
        if (participante.cafes >= evento.barista.limit) {
            callback(null, {
                mensagem: 'Você já resgatou o máximo de cafés disponíveis para seu registro!'
            });
            return;
        }
        
        // Verificar se participante tem pontos suficientes para pedir
        if (participante.pontosCorrente < evento.barista.points) {
            console.log('SEM PONTUACAO SUFICIENTE!');
            callback(null, {
                mensagem: `Você precisa de ${evento.barista.points} pontos para pedir seu café.\n\nNo momento você tem ${participante.pontosCorrente} ponto${participante.pontosCorrente > 1 ? 's disponíveis': ' disponível'}.`
            });
            return;
        }

    }

    // Adicionar pedido na fila
    await firestore.collection('events')
        .doc(event.evento).collection('barista')
        .add({
            idPlayerEvent,
            participanteId,
            evento: event.evento,
            telefone: escondeNumero(limpaNumero(event.from)),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            cafe: event.cafe,
            status: 'pendente',
            cidade: participante.cidade
        });

    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).set({
            cafes: admin.firestore.FieldValue.increment(1),
            pontosCorrente: admin.firestore.FieldValue.increment(participante.coffeeUnlimited ? 0 : -1 * evento.barista.points),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });


    if (!participante.coffeeUnlimited && evento.barista.limit) {
        callback(null, {
            mensagem: `Seu pedido foi realizado com sucesso!\n\nVocê receberá uma mensagem quando seu café for preparado e deverá ir até o barista no estande da Twilio.\n\n\nVocê pode resgatar até ${evento.barista.limit} cafés.`
        });
    } else {
        callback(null, {
            mensagem: `Seu pedido foi realizado com sucesso!\n\nVocê receberá uma mensagem quando seu café for preparado e deverá ir até o barista no estande da Twilio.`
        });

    }
};
