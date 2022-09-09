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

    // Registrar participante na base geral
    await firestore.collection('participantes')
        .doc(participanteId).set({
            phoneNumber: limpaNumero(event.from),
            profileName: event.profileName,
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
        .doc(participanteId).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            await firestore.collection('events')
                .doc(event.evento).collection('participantes')
                .doc(participanteId).set({
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    phoneNumber: limpaNumero(event.from),
                    profileName: event.profileName,
                    pontosAcumulados: 0,
                    pontosCorrente: 0,
                    recebeuOptin: false,
                    ativouNetworking: false,
                    impressoesNetworking: 0
                });
            return {
                pontosAcumulados: 0,
                pontosCorrente: 0,
                recebeuOptin: false,
                ativouNetworking: false,
                impressoesNetworking: 0
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
        .doc(participanteId).get().then( s => {
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
            .get().then(s => {
                return s.size + 1;
        });
        agendamento.posicao = agendamentoPosicao;
    }
    
    let data = {
        participante: {
            ...participante,
            twilion: participanteGeral.twilion,
            isAdmin: participanteGeral.twilion || participanteGeral.isAdmin,
            gerenciaSorteio: participanteGeral.gerenciaSorteio,
            videomatikUnlimited: participanteGeral.videomatikUnlimited
        },
        agendamento,
        agendamentoPosicao,
        agendamentoTotal
    };

    let mensagem = [];

    switch (event.evento) {
        case 'tdcbusiness':
        
            mensagem.push(`Boas-vindas da Twilio!`);
            // Resumo de pontos
            if (participante.pontosCorrente > 0 ) {
                mensagem.push(`Você acumulou ${participante.pontosAcumulados} pontos e ainda pode trocar *${participante.pontosCorrente} pontos* no estande da Twilio.`);
            } else {
                if (participante.pontosAcumulados == 0) {
                    mensagem.push(`Você pode acumular pontos e trocar por brindes da Twilio.\nFaça networking utilizando nossa ferramenta!`);
                } else {
                    mensagem.push(`Você já acumulou e gastou ${participante.pontosAcumulados} pontos.`)
                }
            }

            if (participanteGeral.videomatikUnlimited) {
                mensagem.push(`✅ Videomatik *ILIMITADO!* ✅`);
                
            } else {
                mensagem.push(`Se você deseja criar um *vídeo dinâmico* do TDC pela Videomatik, basta enviar uma foto diretamente por aqui.`)
            }

            // Comandos para Twilions
            if (participanteGeral.twilion) {
                mensagem.push([
                    `🚨 *TWILION* 🚨`,
                    `Envie *BRINDE* para trocar pontos de participante.`
                ].join('\n'));
            }

            // Comandos para equipe TDC
            if (participanteGeral.gerenciaSorteio) {
                mensagem.push([
                    `🚨 *SORTEIO STADIUM* 🚨`,
                    `Envie *SORTEIO* para gerenciar algum sorteio.`
                ].join('\n'));

            }

            // mensagem.push('Envie *ROGADX* para participar do sorteio!');

            // TDC Business
            mensagem.push('');
            mensagem.push(`O que você deseja fazer hoje?`);

            if (agendamento) {
                if (agendamento.status == 'fila') {
                    mensagem.push(`1. Sair da fila de foto profissional.\n(você está em *${agendamentoPosicao}º lugar*)`);
                } else {
                    mensagem.push(`1. Sair da fila de foto profissional.\n(atendimento em andamento)`);
                }
            } else {
                mensagem.push(`1. Entrar na fila de foto profissional. ${agendamentoTotal && agendamentoTotal > 0 ? agendamentoTotal + ' pessoa(s) na fila.' : '*SEM FILA!* '}`);
            }

            // if (!participante.ativouNetworking) {
                mensagem.push(`2. Participar do Networking Premiado da Twilio.`);
            // }

            mensagem.push(`3. Enviar foto para gerar vídeo dinâmico.`);

            mensagem.push(`Envie o *número* da opção desejada.`);
            mensagem.push(`Você também pode enviar uma foto para gerar um vídeo.`)
            break;
        case 'conarec':
        case 'hacktown':
            // Carregar dados de vendingmachine
            // {{widgets.verifica-participante.parsed.vendingmachine.codigos}}
            let vendingmachine = await firestore.collection('vendingmachine')
                .doc(process.env.VENDINGMACHINE_DEFAULT).collection('estoque').get().then(s => {

                    return {
                        codigos: s.docs.map(d => d.id),
                        items: s.docs.reduce((prev, current) => {
                            // console.log('CURR', current.id, '>', current.data());
                            prev[current.id] = current.data();
                            return prev;
                        }, {})
                    };
            });
            // console.log('VENDING MACHINE', vendingmachine);
            data.vendingmachine = vendingmachine;
        
            break;
    }
    
    data.mensagem = mensagem.join('\n\n');

    // TODO: verifica palavras-chave de sorteios em aberto
    








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
