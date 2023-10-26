// Adicionar pedido de café

const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams, replaceVariablesTemplateMessage } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');

const { LIMITE_RESGATES_BARISTA } = process.env;


// TODO: verificar tempo mínimo pedido

// TODO: verify .enabled and .pouring variables



const NomeCafe = (tipo) => {
    console.log('TIPO', tipo);
    switch(tipo) {
        // VAMOS LATAM 2023
        case 'COFFEE_ESPRESSO': return 'Espresso';
        case 'COFFEE_MACCHIATO': return 'Macchiato';
        case 'COFFEE_CAPPUCCINO': return 'Cappuccino';

        // // Codecon Summit 2023
        // case 'COFFEE_ESPRESSO': return 'Espresso';
        // case 'COFFEE_ESPRESSOLEITE': return 'Espresso com Leite';
        // case 'COFFEE_LATTE': return 'Latte';
        // case 'COFFEE_MACCHIATO': return 'Macchiato';
        // case 'COFFEE_CAPPUCCINO': return 'Cappuccino';
        // case 'COFFEE_CARAMELO': return 'Caramelo Macchiato';

        // // TDC Connections 2023
        // case 'COFFEE_RAFAELOLIVEIRA': return 'Rafael Oliveira';
        // case 'COFFEE_JOAOWALTERAMARAL': return 'João Walter Amaral';
        // case 'COFFEE_JOSEALDO': return 'José Aldo';

        // // TDC Business 2023
        // case 'COFFEE_JOSEALDO': return 'José Aldo';
        // case 'COFFEE_JOAOPAULO': return 'João Paulo Capobianco';
        // case 'COFFEE_ALESSANDRAMICHEL': return 'Alessandra e Michel';

        default: return tipo;

    }
}



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
        mensagem: 'You have a pending coffee order.\n\nYou will be allowed to request more once your previous request is completed.'
        // mensagem: 'Você possui um pedido de café pendente ou em preparo.\n\nSerá possível solicitar novamente quando não tiver nenhum pedido em fila.'
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
    // 2023-08-23 - Removida informação de localidade
    // if (!['Recife', 'Belo Horizonte'].includes(participante.cidade)) {
    //     callback(null, {
    //         mensagem: 'O café está disponível apenas para a modalidade presencial!'
    //     });
    //     return;
    // }

    // Verificar último pedido

    // Verificar se participante tem pedido liberado
    if (!participante.coffeeUnlimited) {
        console.log('PARTICIPANTE COM LIMITE DE CAFES');

        // Verificar se participante atingiu o limite
        if (!participante.cafes) {
            participante.cafes = 0;
        }

        if (evento.barista.limit) {

            if (participante.cafes >= evento.barista.limit) {
                callback(null, {
                    mensagem: evento.barista.messages.reachedMaximumAmount || 'Você já resgatou o máximo de cafés disponíveis para seu registro!'
                });
                return;
            }
            
            // Verificar se participante tem pontos suficientes para pedir
            if (participante.pontosCorrente < evento.barista.points) {
                console.log('SEM PONTUACAO SUFICIENTE!');
                callback(null, {
                    mensagem: replaceVariablesTemplateMessage(evento.barista.messages.needMorePoints, {
                        'points': evento.barista.points,
                        'pontosCorrente': participante.pontosCorrente
                    }) || `Você precisa de ${evento.barista.points} pontos para pedir seu café.\n\nNo momento você tem ${participante.pontosCorrente} ponto${participante.pontosCorrente > 1 ? 's disponíveis': ' disponível'}.`
                });
                return;
            }
        }

        if (evento.barista.tempoMinimoResgate) {

            // Verificar tempo mínimo de resgate/pedido
            if (!(participante.isAdmin || participante.twilion) && participante.ultimoResgateBarista) {
                // if (participante.ultimoResgateBarista) {
        
                // evento.limiteTempoResgate
                const current_timestamp = admin.firestore.Timestamp.fromDate(new Date());
                const tempo = (current_timestamp.toDate().getTime() - participante.ultimoResgateBarista.toDate().getTime())/1000/60;
        
                
                if (tempo < evento.barista.tempoMinimoResgate) {
                    let mensagem = [];
                    let minutes = Math.ceil(evento.barista.tempoMinimoResgate - tempo);
                    
                    mensagem.push(replaceVariablesTemplateMessage(evento.barista.messages.timeLimit, {
                        minutes
                    }) || `Você ainda não pode solicitar um novo café.\nAguarde ${minutes} minutos para solicitar novamente.`);

                    return callback(null, { mensagem: mensagem.join('\n') });
                }
        
            }
        
        }


    }


    // Adicionar pedido na fila
    let idBarista = await firestore.collection('events')
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
            // cidade: participante.cidade
        }).then(s => {
            return s.id
        });


    await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).set({
            cafes: admin.firestore.FieldValue.increment(1),
            pontosCorrente: admin.firestore.FieldValue.increment(participante.coffeeUnlimited ? 0 : -1 * evento.barista.points),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });



    // Add Impressao de etiqueta de café
    if (evento.barista.label) {
        let id = await firestore.collection('labels')
            .add({
                type: 'coffee',
                participanteId,
                idPlayerEvent,
                id: idBarista,
                cafe: NomeCafe(event.cafe).toUpperCase(),
                telefone: escondeNumero(limpaNumero(event.from)),
                printer: evento.barista.printer,
                evento: event.evento,
                participanteId: participanteId
            }).then(s => {
                return s.id
            });

    }

    const numero = limpaNumero(event.from);
    const codigo = numero.substr(numero.length - 4 )




    if (!participante.coffeeUnlimited && evento.barista.limit) {
        callback(null, {
            // mensagem: `VOCÊ ESTÁ NA FILA VIRTUAL!\n\nVocê receberá uma mensagem quando seu café for preparado e somente deverá ir até o barista para retirá-lo.\n\n\nInforme o *CÓDIGO ${codigo}*\n\n\nVocê pode resgatar até ${evento.barista.limit} cafés.`
            // mensagem: `Seu pedido foi feito com sucesso e será preparado.\n\nQuando estiver pronto, enviaremos uma nova mensagem!`
            mensagem:     replaceVariablesTemplateMessage(evento.barista.messages.confirmation, {
                'code': codigo
            }) || `Your order has been done!\n\nYou will receive a message when it's ready to pick up.`
        });
    } else {
        callback(null, {
            // mensagem: `VOCÊ ESTÁ NA FILA VIRTUAL!\n\nVocê receberá uma mensagem quando seu café for preparado e somente deverá ir até o barista para retirá-lo.\n\n\nInforme o *CÓDIGO ${codigo}*`
            // mensagem: `Seu pedido foi feito com sucesso e será preparado.\n\nQuando estiver pronto, enviaremos uma nova mensagem!`
            mensagem:     replaceVariablesTemplateMessage(evento.barista.messages.confirmation, {
                'code': codigo
            }) || `Your order has been done!\n\nYou will receive a message when it's ready to pick up.`
        
        });

    }
};
