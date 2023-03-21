const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
    admin.initializeApp({});
} else {
    admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');


const MENSAGEM_CONEXAO = 'Aqui está o LinkedIn da pessoa que você escaneou: {{1}}\n\n';
const MENSAGEM_CONECTADO = 'Uma nova pessoa que acabou de se conectar com você: {{1}}\n\n';
// const MENSAGEM_CONEXAO = 'Aqui está a URL do LinkedIn: {{1}}\n\n';
// const MENSAGEM_CONECTADO = 'Uma nova pessoa que acabou de se conectar com você: {{1}}\n\n';


/*
    event: evento, token, from, to
*/
exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    console.log('NETWORKING', event);

    let participanteId = await md5(limpaNumero(event.from));
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    let idPlayerEventNetworked = event.token.toLowerCase();

    if (idPlayerEvent.toLowerCase() == idPlayerEventNetworked) {
        return callback(null, {
            retornaEvento: false,
            mensagem: '✋ Atenção ✋\n\nVocê está informando seu próprio registro! 😉'
        });
    }


    const participante = await firestore
        .collection('events').doc(event.evento)
        .collection('participantes').doc(idPlayerEvent).get();

    // Verificar se participante existe
    if (!participante.exists) {
        return callback(null, {
            retornaEvento: true,
            mensagem: '✋ Atenção ✋\n\nVocê ainda não fez o registro no evento para poder receber o LinkedIn da pessoa informada.'
        });
    }

    // Verificar se participante possui LinkedIn
    const participanteData = participante.data();
    if (!participanteData.linkedin) {
        // TODO: parâmetro para informar que precisa registrar e adicionar loop no studio para pedir linkedin e depois recomeçar.

        return callback(null, {
            retornaEvento: true,
            mensagem: '✋ Atenção ✋\n\nAinda não informou seu LinkedIn para participar.\n\nÉ necessário fazer seu registro no evento.'
        });
    }


    // Verificar se conexão informada existe na tabela de participantes do evento
    const participanteConectado = await firestore
        .collection('events').doc(event.evento)
        .collection('participantes').doc(idPlayerEventNetworked).get();

    const participanteConectadoData = participanteConectado.data();
    if (!participanteConectado.exists) {
        return callback(null, {
            retornaEvento: false,
            mensagem: '✋ Atenção ✋\n\nIdentificador de participante informado não foi encontrado.'
        });
    }
    


    // // Verificar se conexão informada existe na tabela de participantes
    // const participanteConectado = await firestore.collection('participantes').doc(playerEventData.participanteId).get();
    // if (!participanteConectado.exists) {
    //     return callback(null, {
    //         retornaEvento: false,
    //         mensagem: '✋ Atenção ✋\n\nIdentificador de participante informado não foi encontrado.'
    //     });
    // }


    if (!participanteConectadoData.linkedin) {
        return callback(null, {
            retornaEvento: false,
            mensagem: '✋ Atenção ✋\n\nIdentificador de participante informado não possui LinkedIn vinculado.'
        });
    }



    // Montar mensagem base para quem informou o codigo
    let networkedProfile = ['\n'];
    if (participanteConectadoData.nome) networkedProfile.push(`*${participanteConectadoData.nome}*`);
    if (participanteConectadoData.linkedin) networkedProfile.push(`*${participanteConectadoData.linkedin}*`);
    let participanteMensagem = MENSAGEM_CONEXAO.split('{{1}}').join(networkedProfile.join('\n'));

    // Montar mensagem base para conexão informada
    let participanteProfile = ['\n'];
    if (participanteData) {
        if (participanteData.nome) participanteProfile.push(`*${participanteData.nome}*`);
        if (participanteData.linkedin) participanteProfile.push(`*${participanteData.linkedin}*`);
    }
    let networkedMensagem = MENSAGEM_CONECTADO.split('{{1}}').join(participanteProfile.join('\n'));
    // let networkedMensagem = MENSAGEM_CONECTADO.split('{{1}}').join(limpaNumero(event.from));

    


    // Verificar se networking já foi realizado entre as pessoas
    const networked = await firestore.collection('events').doc(event.evento).collection('networking')
        .where('connection', 'in', [`${idPlayerEvent}_${idPlayerEventNetworked}`, `${idPlayerEventNetworked}_${idPlayerEvent}`])
        .get()
        .then(s => {
            return s.size > 0
        });


    if (!networked) {

        let pointsToGive = 0;
        let pointsToReceive = 0;

        // carregar pontuação padrão do evento
        const eventoData = await firestore.collection('events').doc(event.evento).get().then(s => {
            if (s.exists) {
                return s.data();
            } else {
                return {}
            }
        });


        // TODO: carregar pontuação manual do participante e da conexão
        pointsToGive = 0;
        pointsToReceive = 0;
        
        if (eventoData.networkingPoints) {


            // 
            if (!participanteData.dontReceivePoints && participanteData.game) {
                pointsToReceive = eventoData.pointsToReceive || 1;
            }
            if (
                (participanteConectadoData.pointsToGive) // && participanteConectadoData.pointsToGive> 0
                && !participanteData.dontReceivePoints) {
                pointsToReceive = participanteConectadoData.pointsToGive;
            }

            if (!participanteConectadoData.dontReceivePoints && participanteConectadoData.game) {
                pointsToGive = eventoData.pointsToGive || 2;
            }
            if (
                (participanteData.pointsToGive) // && participanteData.pointsToGive> 0
                && !participanteConectadoData.dontReceivePoints) {
                pointsToGive = participanteData.pointsToGive
            }
            if (participanteData.pointsToGive && participanteData.pointsToGive < 0) {
                networkedMensagem += `🚨🚨🚨🚨\nVocê encontrou um *monstro* no jogo!\n\n`;
            }
            if (participanteData.pointsToGive && participanteData.pointsToGive > 0) {
                networkedMensagem += `🚨🚨🚨🚨\nVocê encontrou um pokemon raro no jogo!\n\n`;
            }
            if (participanteConectadoData.pointsToGive && participanteConectadoData.pointsToGive < 0) {
                participanteMensagem +=  `🚨🚨🚨🚨\nVocê encontrou um *monstro* no jogo!\n\n`;
            }
            if (participanteConectadoData.pointsToGive && participanteConectadoData.pointsToGive > 0) {
                networkedMensagem += `🚨🚨🚨🚨\nVocê encontrou um pokemon raro no jogo!\n\n`;
            }
                
            

        }


        // Registrar pontuação no evento
        await firestore.collection('score')
            .doc(event.evento)
            .collection('participantes')
            .doc(event.token)
            .set({
                pontosCorrente: admin.firestore.FieldValue.increment(pointsToGive),
                pontosAcumulados: admin.firestore.FieldValue.increment(pointsToGive),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        await firestore.collection('score')
            .doc(event.evento)
            .collection('participantes')
            .doc(idPlayerEvent)
            .set({
                pontosCorrente: admin.firestore.FieldValue.increment(pointsToReceive),
                pontosAcumulados: admin.firestore.FieldValue.increment(pointsToReceive),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });



            
        // Registrar pontuação no SCORE
        await firestore.collection('events')
            .doc(event.evento)
            .collection('participantes')
            .doc(event.token)
            .set({
                pontosCorrente: admin.firestore.FieldValue.increment(pointsToGive),
                pontosAcumulados: admin.firestore.FieldValue.increment(pointsToGive),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        await firestore.collection('events')
            .doc(event.evento)
            .collection('participantes')
            .doc(idPlayerEvent)
            .set({
                pontosCorrente: admin.firestore.FieldValue.increment(pointsToReceive),
                pontosAcumulados: admin.firestore.FieldValue.increment(pointsToReceive),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

    

            
        // Incluir registro de networking no evento
        await firestore.collection('events').doc(event.evento).collection('networking').add({
            connection: `${idPlayerEvent}_${idPlayerEventNetworked}`,
            participanteId,
            idPlayerEvent,
            idPlayerEventNetworked: idPlayerEventNetworked,
            evento: event.evento,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            pointsToGive,
            pointsToReceive
        });

        // Registrar contador de networking
        await firestore.collection('events').doc(event.evento).collection('participantes')
        .doc(idPlayerEvent).set({
            networking: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });


        // Adicionar mensagem de pontuação se for o caso
        if (pointsToReceive > 0) {
            participanteMensagem += `Você ganhou *${pointsToReceive} ponto${pointsToReceive > 1 ? 's' : ''}*.\n`;
            networkedMensagem += `A pessoa ganhou *${pointsToReceive} ponto${pointsToReceive > 1 ? 's' : ''}*.\n`;
        }
        if (pointsToGive > 0) {
            participanteMensagem += `A pessoa ganhou *${pointsToGive} ponto${pointsToGive > 1 ? 's' : ''}*.\n`;
            networkedMensagem += `Você ganhou *${pointsToGive} ponto${pointsToGive > 1 ? 's' : ''}*.\n`;
        }


        // increment stats
        await firestore.collection('events')
        .doc(event.evento).set({
            stats: {
                conexoes: admin.firestore.FieldValue.increment(1)
            }
        }, { merge: true });

        await firestore.collection('events')
        .doc(event.evento).set({
            stats: {
                pontos: admin.firestore.FieldValue.increment(pointsToReceive + pointsToGive)
            }
        }, { merge: true });


    }

    

    // Enviar mensagem para a conexão informada
    await sendNotification(
        client,
        event.to,
        `whatsapp:${participanteConectadoData.phoneNumber}`,
        networkedMensagem
    );

    return callback(null, {
        retornaEvento: false,
        mensagem: participanteMensagem
    });

    callback(null, {

    });

};
