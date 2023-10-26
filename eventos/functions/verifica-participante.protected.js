const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams, adicionaNove } = require(Runtime.getFunctions()['util'].path);
const { checkUser } = require(Runtime.getFunctions()['codecon'].path);


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

    console.log('EVENT PARTICIPANTE', event);


    let evento = await firestore.collection('events')
        .doc(event.evento).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return null;
        }
    });


    // Registrar participante na base geral
    await firestore.collection('participantes')
        .doc(participanteId).set({
            phoneNumber: limpaNumero(event.from),
            idPlayerEvent: idPlayerEvent,
            profileName: event.profileName || '',
            ultimoEvento: event.evento,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    
    let participanteGeral = await firestore.collection('participantes')
        .doc(participanteId).get().then(async s => {
            if (s.exists) {
                return s.data();
            } else {
                return {}
            }
    });

    let participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            await firestore.collection('events')
                .doc(event.evento).collection('participantes')
                .doc(idPlayerEvent).set({
                    idPlayerEvent,
                    participanteId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    phoneNumber: limpaNumero(event.from),
                    profileName: event.profileName || '',
                    pontosAcumulados: 0,
                    pontosCorrente: 0,
                    recebeuOptin: false,
                    ativouNetworking: false,
                    possuiRegistro: false,
                    impressoes: 0,
                    codeconAtivado: false
                });
            return {
                pontosAcumulados: 0,
                pontosCorrente: 0,
                recebeuOptin: false,
                ativouNetworking: false,
                possuiRegistro: false,
                impressoes: 0,
                codeconAtivado: false
            };
        }
    });

    let agendamentoTotal = null;
    let agendamentoPosicao = null;


    // TODO: verificar opt-in
    // /events/{eventId}/participantes/{participanteId}/ [recebeuOptin, aceitouOptin]
    // data.recebeuOptin = participante.recebeuOptin || false;


    // Verificar se tem agendamento de foto profissional, posição na fila e tempo
    // /events/{eventId}/agendamento/{participanteId}


    let agendamento = await firestore.collection('events')
        .doc(event.evento).collection('agendamento')
        .doc(idPlayerEvent).get().then( s => {
            if (s.exists) {
                return s.data();
            } else {
                return null;
            }
    });

    if (agendamento) {
        agendamentoTotal = await firestore.collection('events')
            .doc(event.evento).collection('agendamento')
            .get().then(s => {
                return s.size;
        });
            
        agendamentoPosicao = await firestore.collection('events')
            .doc(event.evento).collection('agendamento')
            .where('posicao', '<', agendamento.posicao)
            .where('status', '==', 'fila')
            .get().then(s => {
                return s.size + 1;
        });
        agendamento.posicao = agendamentoPosicao;
    }


    let podeResgatar = true;
    let podeResgatarBarista = true;
    let proximoResgate = ''
    let proximoResgateBarista = '';


    if (participante.ultimoResgate && evento.tempoMinimoResgate) {

        // evento.limiteTempoResgate
        const current_timestamp = admin.firestore.Timestamp.fromDate(new Date());
        const tempo = (current_timestamp.toDate().getTime() - participante.ultimoResgate.toDate().getTime())/1000/60;

        podeResgatar = tempo >= evento.tempoMinimoResgate;
        proximoResgate = Math.ceil(evento.tempoMinimoResgate - tempo);

    }

    if (evento.barista) {
        if (participante.ultimoResgateBarista && evento.barista.tempoMinimoResgate) {

            // evento.limiteTempoResgate
            const current_timestamp = admin.firestore.Timestamp.fromDate(new Date());
            const tempo = (current_timestamp.toDate().getTime() - participante.ultimoResgateBarista.toDate().getTime())/1000/60;
    
            podeResgatarBarista = tempo >= evento.barista.tempoMinimoResgate;
            proximoResgateBarista = Math.ceil(evento.barista.tempoMinimoResgate - tempo);
    
        }
    
    }


    let data = {
        participante: {
            ...participante,
            podeResgatar,
            proximoResgate,
            twilion: participanteGeral.twilion,
            isAdmin: participanteGeral.twilion || participanteGeral.isAdmin || participante.twilion || participante.isAdmin,
            gerenciaSorteio: participanteGeral.gerenciaSorteio || participante.gerenciaSorteio,
            videomatikUnlimited: participanteGeral.videomatikUnlimited,
            coffeeUnlimited: participanteGeral.coffeeUnlimited
        },
        evento,
        agendamento,
        agendamentoPosicao,
        agendamentoTotal,
        videomatik: evento.videomatik
    };

    let mensagem = [];
    let vendingmachine = null;

    const IS_ADMIN = participanteGeral.isAdmin || participanteGeral.twilion || participante.isAdmin || participante.twilion;
    const GERENCIA_SORTEIO = participanteGeral.gerenciaSorteio || participante.gerenciaSorteio;



    switch (event.evento) {

        case 'signalsingapore2023':
            mensagem.push(`Welcome to *SIGNAL Singapore*!`);

            if (evento.barista && evento.barista.enabled) {
                if (evento.barista && evento.barista.enabled) {
                    if (participanteGeral.coffeeUnlimited || participante.coffeeUnlimited) {
                        mensagem.push(`☕️ Café *ILIMITADO!* ☕️ Envie *BARISTA* para pedir o seu.`);
                    } else {
                        if (!podeResgatarBarista) {
                            mensagem.push(`Você pode resgatar seu próximo ☕️ em ${proximoResgateBarista} minuto(s).`)
                        } else {
                            mensagem.push(`Quer um café especial? Envie *BARISTA* para pedir o seu.`);
                        }
        
                    }

                }
            }

            break;
    }
    


    // Main Admin Settings
    if (IS_ADMIN) {
        mensagem.push([
            `🚨 *ADMIN* 🚨`,
            `Send participant ID to manage points and settings.`,
            // `Envie *ESTOQUE* para gerenciar a vending machine.`
        ].join('\n'));

        let totalParticipantes = (await firestore.collection('events')
            .doc(event.evento).collection('participantes').get()).size;

        mensagem.push(`Total Participants: *${totalParticipantes}*`);
        // mensagem.push(`Participantes: *${totalParticipantes}*\nResgates: *${evento.resgates}*\nVideomatik: *${evento.stats.videomatik}*`);

    }

    // Raffle Admin Settings
    if (GERENCIA_SORTEIO) {
        mensagem.push([
            `🚨 *RAFFLES* 🚨`,
            `Send *SORTEIO* to manage a raffle.`
        ].join('\n'));
    }


    data.mensagem = mensagem.join('\n\n');
    callback(null, data);

};
