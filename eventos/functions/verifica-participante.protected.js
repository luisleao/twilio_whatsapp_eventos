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

const AGENDAMENTO_ATIVADO = false;


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
                    impressoes: 0
                });
            return {
                pontosAcumulados: 0,
                pontosCorrente: 0,
                recebeuOptin: false,
                ativouNetworking: false,
                impressoes: 0
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
            videomatikUnlimited: participanteGeral.videomatikUnlimited,
            coffeeUnlimited: participanteGeral.coffeeUnlimited
        },
        agendamento,
        agendamentoPosicao,
        agendamentoTotal
    };

    let mensagem = [];
    let vendingmachine = null;

    switch (event.evento) {
        case 'cssconf2023':
        
            mensagem.push(`Boas-vindas da *Twilio na Conferência CSS Brasil*!`);
            mensagem.push(`Informe a palavra-chave para registrar no sorteio.`);
            // mensagem.push(`Envie sua selfie ou a palavra-chave para ativar sorteios.`);
            
            if (participanteGeral.videomatikUnlimited) {
                mensagem.push(`✅ Videomatik *ILIMITADO!* ✅`);
            } else {
                // mensagem.push(`Se você deseja criar um *vídeo dinâmico* da CSS Conf pela Videomatik, basta enviar uma selfie diretamente por aqui.`)
            }

            // Comandos para Twilions
            if (participanteGeral.twilion) {
                mensagem.push([
                    `🚨 *TWILION* 🚨`,
                    `Envie o código de participante para gerenciar pontos e outras configurações.`
                ].join('\n'));
            }

            // Comandos para equipe TDC
            if (participanteGeral.gerenciaSorteio) {
                mensagem.push([
                    `🚨 *SORTEIO ATIVADO* 🚨`,
                    `Envie *SORTEIO* para gerenciar algum sorteio.`
                ].join('\n'));

            }

            // mensagem.push('Envie *ROGADX* para participar do sorteio!');

            // TODO: mudar de TDC Business para TDC Future
            // mensagem.push('');
            // mensagem.push(`O que você deseja fazer hoje?`);

            break;


        case 'devfest2022-sul':
        
            mensagem.push(`Boas-vindas da *Twilio no GDG DevFest Sul*!`);
            // mensagem.push(`Envie sua selfie ou a palavra-chave para ativar sorteios.`);
            
            if (participanteGeral.videomatikUnlimited) {
                mensagem.push(`✅ Videomatik *ILIMITADO!* ✅`);
            } else {
                mensagem.push(`Se você deseja criar um *vídeo dinâmico* do DevFest pela Videomatik, basta enviar uma selfie diretamente por aqui.`)
            }

            // Comandos para Twilions
            if (participanteGeral.twilion) {
                mensagem.push([
                    `🚨 *TWILION* 🚨`,
                    `Envie o código de participante para gerenciar pontos e outras configurações.`
                ].join('\n'));
            }

            // Comandos para equipe TDC
            if (participanteGeral.gerenciaSorteio) {
                mensagem.push([
                    `🚨 *SORTEIO ATIVADO* 🚨`,
                    `Envie *SORTEIO* para gerenciar algum sorteio.`
                ].join('\n'));

            }

            // mensagem.push('Envie *ROGADX* para participar do sorteio!');

            // TODO: mudar de TDC Business para TDC Future
            // mensagem.push('');
            // mensagem.push(`O que você deseja fazer hoje?`);

            break;


        case 'tdcbusiness':
        case 'tdcbusiness2022':
        case 'tdcfuture2022':
        case 'tdcconnections2023':
        
            mensagem.push(`Boas-vindas da *Twilio no TDC Connections 2023*!`);
            // mensagem.push(`Envie sua selfie ou a palavra-chave para ativar sorteios.`);
            
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
                mensagem.push(`Se você deseja criar um *vídeo dinâmico* do TDC pela Videomatik, basta enviar uma selfie diretamente por aqui.`)
            }


            // Comandos para Twilions
            if (participanteGeral.twilion) {
                mensagem.push([
                    `🚨 *TWILION* 🚨`,
                    `Envie o código de participante para gerenciar pontos e outras configurações.`
                ].join('\n'));
            }

            // Comandos para equipe TDC
            if (participanteGeral.gerenciaSorteio) {
                mensagem.push([
                    `🚨 *SORTEIO STADIUM E TRILHAS* 🚨`,
                    `Envie *SORTEIO* para gerenciar algum sorteio.`
                ].join('\n'));
            }
            if (evento.barista) {
                // TODO: verificar se participante definiu a cidade
                // TODO: não exibir mensagem caso participante seja ONLINE

                if (participanteGeral.coffeeUnlimited || participante.coffeeUnlimited) {
                    mensagem.push(`☕️ Café *ILIMITADO!* ☕️`);
                } else {        
                    if(participante.pontosCorrente > evento.barista.points ) {
                        if (evento.barista.enabled) {
                            mensagem.push('Peça seu ☕️!\nVocê já possui pontos suficiente.\nEnvie *CAFÉ* para entrar na fila!');
                        } else {
                            mensagem.push('Quer um ☕️?\nEm algum momento nosso barista pode estar em funcionamento.\nConfira no estande da Twilio!');
                        }
                    } else {
                        mensagem.push(`O que acha de um ☕️?\nAcumule ${evento.barista.points} pontos para garantir o seu!`);
                    }
                }

            }
            // TODO: mudar de TDC Business para TDC Future
            mensagem.push('');
            // mensagem.push(`O que você deseja fazer hoje?`);

            if (AGENDAMENTO_ATIVADO) {
                if (agendamento) {
                    if (agendamento.status == 'fila') {
                        mensagem.push(`1. Sair da fila de foto profissional.\n(você está em *${agendamentoPosicao}º lugar*)`);
                    } else {
                        mensagem.push(`1. Sair da fila de foto profissional.\n(atendimento em andamento)`);
                    }
                } else {
                    mensagem.push(`1. Entrar na fila de foto profissional. ${agendamentoTotal && agendamentoTotal > 0 ? agendamentoTotal + ' pessoa(s) na fila.' : '*SEM FILA!* '}`);
                }
            }

            if (!participante.ativouNetworking) {
                mensagem.push(`Quer participar do Networking Premiado da Twilio e acumular pontos? Envie *JOGAR* para configurar seu perfil`);
            }

            break;

        case 'conarec':
        case 'hacktown':
            // Carregar dados de vendingmachine
            // {{widgets.verifica-participante.parsed.vendingmachine.codigos}}
            vendingmachine = await firestore.collection('vendingmachine')
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

        case 'cdc2022':
            mensagem.push(`*Twilio* welcomes you to the *Caribbean Developer Conference*!`);
            mensagem.push(`Are you enjoyng the event? Send your selfie here and we will build a video for you to share into your social media channels.`);
            mensagem.push(`You can also use the promo-code CDC2022 to get $10 into your Twilio account. Don't have an account? Create yours in https://www.twilio.com/try-twilio?promo=CDC2022`);
            // mensagem.push(`If you like to create a video with your selfie telling about you attended this event, please send a picture here.`);
            // mensagem.push(`And if you love swags 🎁, talk with a Twilion at the event or try one of quick-deploy solutions from our Code Exchange repository at https://www.twilio.com/code-exchange?q=&f=serverless and show to us. `)
            break;

        case 'tslsingapore':
            mensagem.push(`Welcome to Twilio Startup Lab in Singapore!`);

            // Carregar dados de vendingmachine
            // {{widgets.verifica-participante.parsed.vendingmachine.codigos}}
            vendingmachine = await firestore.collection('vendingmachine')
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
